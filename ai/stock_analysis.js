import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from "dotenv";
import db from "../models/index.js";
import moment from "moment";
import { getModelInstance } from "../utils/ai_models.js";
dotenv.config();

const tableDescriptions = {
  nse_eq_stock_data_daily:
    "This table contains live stock data for the current trading day.",
  nse_eq_stock_historical_daily:
    "This table contains end-of-day (EOD) data for previous trading days.",
  nse_eq_stock_data_intraday_daily:
    "This table contains intraday stock price data captured during market hours.",
  nse_company_bio:
    "This table contains company biography and summary. Highly relevant for general 'Tell me about SYMBOL' queries.",
  nse_company_details:
    "This table contains financial and ratio analysis data. Use when the query is about company performance.",
  nse_company_peers:
    "This table contains peer comparison data for companies based on similar industry or sector.",
  nse_stock_profit_loss:
    "This table contains profit and loss (income statement) data for NSE stocks, including key metrics like revenue, net income, EBIT, expenses, and tax provisions.",
  nse_stock_cash_flow:
    "This table contains cash flow statement data for NSE stocks, including operating, investing, financing cash flows, capex, free cash flow, and changes in working capital.",
  nse_stock_balance_sheet:
    "This table contains balance sheet data for NSE stocks, including assets (cash, receivables, property), liabilities (debt, payables), equity, and totals like total assets and shareholders' equity.",
  nse_eq_stock_candle_pettern_per_week:
    "Stores weekly candlestick pattern information for NSE equity stocks.",
  nse_eq_stock_candle_pettern_per_day:
    "Stores daily candlestick pattern information for NSE equity stocks.",
};

let cachedTrainingData = null;

// Conversation history cache (in production, use Redis or database)
const conversationHistory = new Map();

const getTrainingData = async () => {
  if (cachedTrainingData) return cachedTrainingData;

  const tables = Object.keys(tableDescriptions);
  const trainingData = {};

  for (const table_name of tables) {
    try {
      let columns;
      let sampleRows;

      if (
        [
          "nse_stock_cash_flow",
          "nse_stock_balance_sheet",
          "nse_stock_profit_loss",
        ].includes(table_name)
      ) {
        columns = await db.sequelize.query(`
          SELECT DISTINCT item_name as column_name 
          FROM ${table_name}
          ORDER BY item_name;
        `);
        [columns] = columns;

        const verticalData = await db.sequelize.query(`
          SELECT
            symbol_name, 
            period,
            EXTRACT(YEAR FROM period)::int AS year,
            jsonb_object_agg(item_name, amount) AS items
          FROM ${table_name}
          WHERE duration_type = 'quarterly'
          GROUP BY symbol_name, period
          ORDER BY period DESC
          LIMIT 1;
        `);
        [sampleRows] = verticalData;

        if (sampleRows && sampleRows.length > 0) {
          sampleRows = sampleRows.map((data) => ({
            symbol_name: data.symbol_name,
            period: data.period,
            year: data.year,
            ...data.items,
          }));
        }
      } else {
        columns = await db.sequelize.query(`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = '${table_name}'
          ORDER BY ordinal_position
        `);
        [columns] = columns;

        sampleRows = await db.sequelize.query(`
          SELECT * FROM ${table_name} 
          ORDER BY created_at DESC 
          LIMIT 1
        `);
        [sampleRows] = sampleRows;
      }

      const columnNames = columns.map((col) => col.column_name);

      trainingData[table_name] = {
        description:
          tableDescriptions[table_name] || "No description provided.",
        columns: columnNames,
        sample_rows: sampleRows,
      };
    } catch (error) {
      console.error(`Error fetching data for table ${table_name}:`, error);
      trainingData[table_name] = {
        description:
          tableDescriptions[table_name] || "No description provided.",
        columns: [],
        sample_rows: [],
      };
    }
  }

  cachedTrainingData = trainingData;
  return trainingData;
};

// Get or initialize conversation history
const getConversationHistory = (userId, symbol) => {
  const key = `${userId}_${symbol}`;
  if (!conversationHistory.has(key)) {
    conversationHistory.set(key, []);
  }
  return conversationHistory.get(key);
};

// Add message to conversation history
const addToHistory = (userId, symbol, role, content) => {
  const key = `${userId}_${symbol}`;
  const history = getConversationHistory(userId, symbol);
  
  history.push({ role, content, timestamp: Date.now() });
  
  // Keep only last 10 messages to avoid token limits
  if (history.length > 10) {
    history.shift();
  }
  
  conversationHistory.set(key, history);
};

// Clear old conversation histories (call this periodically)
const clearOldHistories = () => {
  const ONE_HOUR = 60 * 60 * 1000;
  const now = Date.now();
  
  for (const [key, history] of conversationHistory.entries()) {
    if (history.length > 0) {
      const lastMessage = history[history.length - 1];
      if (now - lastMessage.timestamp > ONE_HOUR) {
        conversationHistory.delete(key);
      }
    }
  }
};

// Generate follow-up suggestions
const generateFollowUpSuggestions = (userQuery, symbol, results) => {
  const suggestions = [];
  const queryLower = userQuery.toLowerCase();
  
  if (queryLower.includes('price') || queryLower.includes('close')) {
    suggestions.push(
      `What is ${symbol}'s trading volume today?`,
      `Show me ${symbol}'s price trend over the last week`,
      `Compare ${symbol} with its peers`
    );
  } else if (queryLower.includes('revenue') || queryLower.includes('profit')) {
    suggestions.push(
      `What is ${symbol}'s profit margin?`,
      `Show me ${symbol}'s cash flow`,
      `How has ${symbol}'s revenue grown over time?`
    );
  } else if (queryLower.includes('company') || queryLower.includes('about')) {
    suggestions.push(
      `What are ${symbol}'s key financial metrics?`,
      `Who are ${symbol}'s competitors?`,
      `What is ${symbol}'s current stock price?`
    );
  } else {
    suggestions.push(
      `Tell me about ${symbol}'s financial performance`,
      `What is ${symbol}'s current market position?`,
      `Show me ${symbol}'s key ratios`
    );
  }
  
  return suggestions.slice(0, 3);
};

// Get market context (you can enhance this by calling a market API)
const getMarketContext = async () => {
  const currentHour = moment().tz("Asia/Kolkata").hour();
  const isMarketHours = currentHour >= 9 && currentHour < 16;
  
  return {
    isMarketOpen: isMarketHours,
    marketSession: isMarketHours ? "during market hours" : "after market close",
    marketDate: moment().tz("Asia/Kolkata").format("MMMM D, YYYY")
  };
};

export const stock_analysis_ai = async (req, res) => {
  let { userQuery, symbol, userid, remaining_limit, max_limit } = req.body;
  const current_date = moment().tz("Asia/kolkata").format("YYYY-MM-DD");
  const current_time = moment().tz("Asia/kolkata").format("HH:mm:ss");
  
  try {
    if (!userQuery || !symbol) {
      return res.status(400).json({
        status: 0,
        message: "Missing parameters",
        data: { msg: "Missing parameters", max_limit, remaining_limit },
      });
    }

    // Clean old histories periodically
    if (Math.random() < 0.1) { // 10% chance
      clearOldHistories();
    }

    let query_status = "success";
    const contextualQuery = userQuery.concat(` in the context of ${symbol}`);
    const trainingData = await getTrainingData();
    const gemini_api_key = process.env.MAIN_GEMINI_KEY;

    // Get conversation history
    const history = getConversationHistory(userid, symbol);
    const conversationContext = history.length > 0 
      ? `\n\nPREVIOUS CONVERSATION:\n${history.map(h => `${h.role}: ${h.content}`).join('\n')}\n`
      : '';

    // Get market context
    const marketContext = await getMarketContext();

    const model = getModelInstance(gemini_api_key);
    
    // Enhanced prompt with conversation history and market context
    const prompt = `
You are an expert financial advisor AI assistant with deep knowledge of Indian stock markets and financial analysis. Your role is to help users understand their investments with clear, insightful, and conversational responses.

CURRENT MARKET CONTEXT:
- Date: ${marketContext.marketDate}
- Market Status: ${marketContext.isMarketOpen ? "OPEN" : "CLOSED"}
- Session: ${marketContext.marketSession}

DATABASE STRUCTURE:
${JSON.stringify(trainingData, null, 2)}

${conversationContext}

CORE RESPONSIBILITIES:

1. **Query Understanding & SQL Generation:**
   - Analyze the user's question to identify their true intent
   - Consider previous conversation context for follow-up questions
   - Select the most relevant table(s) from the schema
   - Generate accurate PostgreSQL queries
   - Always include symbol_name in WHERE clauses
   - Use only one table per query (no UNION operations)
   - For time-based queries, use appropriate date filters
   - Handle multiple data points when needed (e.g., comparing periods)

2. **Conversational Interaction:**
   - Maintain context from previous messages in the conversation
   - Reference earlier points naturally when relevant
   - For greetings (Hello, Hi, Hey): Respond warmly and ask how you can help
   - For casual questions (How are you?): Reply naturally and redirect to stock assistance
   - For follow-up questions: Use conversation history to provide contextual answers
   - For invalid/nonsensical input: Politely guide user to ask valid stock questions
   - In casual cases, set "sql" to null

3. **Response Crafting:**
   - Write explanations as if you're a trusted financial advisor speaking to a client
   - Use natural, flowing language - not robotic or templated
   - Provide context and insights, not just raw numbers
   - Add relevant observations about trends, comparisons, and implications
   - When market is open, mention real-time nature of data
   - When market is closed, clarify you're showing end-of-day data
   - Use professional but approachable and engaging tone
   - Vary your language - avoid repetitive sentence structures
   - Show personality while maintaining professionalism

FORMATTING REQUIREMENTS:

- Output ONLY valid JSON with "sql", "explanation", and "suggestions" keys
- NO markdown, HTML, code blocks, or escape characters like \\n
- Use {{column_name}} placeholders for database values in explanations
- Available placeholders: {{close}}, {{high}}, {{low}}, {{volume}}, {{revenue}}, {{net_income}}, {{pe_ratio}}, {{market_cap}}, etc.
- Never use generic placeholders (X, Y, Z) - always use actual column names
- Include 2-3 relevant follow-up question suggestions in the "suggestions" array

RESPONSE QUALITY GUIDELINES:

**For Price Queries:**
- Excellent: "As of ${marketContext.marketSession}, ${symbol} is trading at ₹{{close}}, marking a {{change_percent}}% ${marketContext.isMarketOpen ? 'movement' : 'change'} from yesterday's close. The stock touched a high of ₹{{high}} and a low of ₹{{low}} during today's session, with healthy trading volume of {{volume}} shares."
- Good: "As of the latest trading session, ${symbol} closed at ₹{{close}}, showing {{change_percent}}% movement from the previous close."
- Avoid: "The closing price is {{close}}"

**For Company Information:**
- Excellent: "${symbol} is a prominent player in the {{sector}} sector, specializing in {{business_description}}. The company has built a strong reputation through {{key_strength}} and maintains a competitive edge with {{competitive_advantage}}. Their market presence is further solidified by {{additional_context}}."
- Good: "${symbol} operates in the {{sector}} sector and is known for {{business_description}}."
- Avoid: "The company is {{company_name}}"

**For Financial Metrics:**
- Excellent: "Looking at ${symbol}'s recent financials, the company posted revenue of ₹{{revenue}} crores for {{period}}, representing robust {{growth_rate}}% year-over-year growth. The net profit margin of {{net_margin}}% indicates {{interpretation}}, which is {{comparison}} compared to industry standards. This performance suggests {{forward_looking_insight}}."
- Good: "${symbol} reported revenue of ₹{{revenue}} crores for {{period}}, showing {{growth_rate}}% growth."
- Avoid: "Revenue is {{revenue}}"

**For Comparative Analysis:**
- Include industry context when relevant
- Mention peer performance if applicable
- Provide balanced perspective on strengths and concerns
- Add forward-looking insights when appropriate

**Tone Examples:**
- Informative: "The data reveals an interesting pattern..."
- Insightful: "This suggests that the company is..."
- Professional: "Based on the financial indicators..."
- Approachable: "Here's what's happening with ${symbol}..."
- Engaging: "Let me walk you through ${symbol}'s performance..."

**Conversation Continuity:**
- If user asks follow-up: "Building on what we discussed earlier..."
- If clarifying: "To add more detail to that..."
- If changing topic: "Now, looking at a different aspect..."

CURRENT QUERY: "${contextualQuery}"

Generate a response that:
1. Accurately answers the user's question with full context
2. Considers conversation history if available
3. Provides valuable insights beyond just data
4. Uses clear, professional, yet engaging language
5. Feels like talking to an expert advisor who knows you
6. Includes 2-3 relevant follow-up suggestions

Return JSON in this exact format:
{
  "sql": "PostgreSQL query or null",
  "explanation": "Natural, insightful explanation with {{placeholders}}",
  "suggestions": ["Question 1?", "Question 2?", "Question 3?"]
}
`;

    const response = await Promise.race([
      model.invoke(prompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("AI request timeout")), 100000)
      ),
    ]);

    const cleanedResponse = response?.content
      ?.trim()
      ?.replace(/^```json/i, "")
      ?.replace(/^```/, "")
      ?.replace(/```$/, "")
      ?.trim();

    if (!cleanedResponse) {
      throw new Error("Empty AI response");
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      query_status = "failed";
      throw new Error("Invalid JSON response from AI");
    }

    let finalResponse = parsedResponse.explanation;
    let suggestions = parsedResponse.suggestions || [];

    // Handle non-SQL responses (greetings, casual chat)
    if (!parsedResponse.sql && finalResponse) {
      // Add to conversation history
      addToHistory(userid, symbol, 'user', userQuery);
      addToHistory(userid, symbol, 'assistant', finalResponse);

      const history_record_data = {
        user_id: userid,
        bot_type: "stock analysis",
        user_query: `${userQuery}, in the context of ${symbol}`,
        status: query_status,
        time: current_time,
        created_at: current_date,
      };
      await db.chat_bot_history.create(history_record_data);

      remaining_limit =
        query_status === "success" ? remaining_limit - 1 : remaining_limit;
      return res.status(200).json({
        status: 1,
        message: "Success",
        data: {
          msg: finalResponse,
          suggestions: suggestions.length > 0 ? suggestions : generateFollowUpSuggestions(userQuery, symbol, null),
          max_limit,
          remaining_limit,
        },
      });
    }

    if (!parsedResponse.sql) {
      query_status = "failed";
      throw new Error("No SQL query generated");
    }

    // Execute SQL query
    try {
      const [results] = await Promise.race([
        db.sequelize.query(parsedResponse.sql),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Database timeout")), 5000)
        ),
      ]);

      if (results.length > 0) {
        let result = results[0];
        
        // Replace all placeholders with actual values
        for (let key in result) {
          const value = result[key];
          let formattedValue = value;
          
          if (value === null || value === undefined) {
            formattedValue = 'N/A';
          } else if (typeof value === 'number') {
            // Format based on column type
            if (key.toLowerCase().includes('price') || 
                key.toLowerCase().includes('close') || 
                key.toLowerCase().includes('high') || 
                key.toLowerCase().includes('low') ||
                key.toLowerCase().includes('open')) {
              formattedValue = '₹' + value.toFixed(2);
            } else if (key.toLowerCase().includes('percent') || 
                       key.toLowerCase().includes('change') ||
                       key.toLowerCase().includes('margin') ||
                       key.toLowerCase().includes('ratio')) {
              formattedValue = value.toFixed(2) + '%';
            } else if (value > 10000000) { // Format crores
              formattedValue = (value / 10000000).toFixed(2) + ' crores';
            } else if (value > 100000) { // Format lakhs
              formattedValue = (value / 100000).toFixed(2) + ' lakhs';
            } else {
              formattedValue = value.toLocaleString('en-IN');
            }
          } else if (value instanceof Date) {
            formattedValue = moment(value).format('MMM D, YYYY');
          }
          
          finalResponse = finalResponse.replace(
            new RegExp(`\\{\\{${key}\\}\\}`, 'g'), 
            formattedValue
          );
        }
        
        // Clean up any remaining unreplaced placeholders
        finalResponse = finalResponse.replace(/\{\{[^}]+\}\}/g, 'N/A');
        
        // Generate suggestions if not provided by AI
        if (suggestions.length === 0) {
          suggestions = generateFollowUpSuggestions(userQuery, symbol, results);
        }

        // Add to conversation history
        addToHistory(userid, symbol, 'user', userQuery);
        addToHistory(userid, symbol, 'assistant', finalResponse);
        
      } else {
        query_status = "failed";
        finalResponse = `I couldn't find any data for ${symbol}. This could mean the symbol doesn't exist in our database, or there might not be recent data available. Please verify the stock symbol and try again.`;
        suggestions = [
          `List all available stocks`,
          `Search for companies in a specific sector`,
          `Show me popular stocks`
        ];
      }
    } catch (queryError) {
      console.error("Database query error:", queryError);
      query_status = "failed";
      finalResponse = `I encountered an issue while fetching data for ${symbol}. This might be due to an invalid query or temporary database issue. Please try rephrasing your question or verify the stock symbol.`;
      suggestions = [
        `What is ${symbol}'s current price?`,
        `Tell me about ${symbol}`,
        `Show ${symbol}'s financial summary`
      ];
    }

    // Store query history
    const history_record_data = {
      user_id: userid,
      bot_type: "stock analysis",
      user_query: `${userQuery}, in the context of ${symbol}`,
      status: query_status,
      time: current_time,
      created_at: current_date,
    };
    await db.chat_bot_history.create(history_record_data);

    remaining_limit =
      query_status === "success" ? remaining_limit - 1 : remaining_limit;
      
    res.status(200).json({
      status: 1,
      message: "Success",
      data: {
        msg: finalResponse,
        suggestions,
        max_limit,
        remaining_limit,
        conversationId: `${userid}_${symbol}` // For frontend to track conversations
      },
    });
  } catch (error) {
    console.log(error);

    let errorMsg =
      "I'm having trouble processing your request right now. Please try again in a moment.";
    let suggestions = [
      `What is ${symbol}'s current price?`,
      `Tell me about ${symbol}`,
      `Show ${symbol}'s key metrics`
    ];

    if (error.message.includes("timeout")) {
      errorMsg =
        "Your request is taking longer than expected. Please try asking a simpler question or breaking it into smaller parts.";
    } else if (error.message.includes("Invalid JSON")) {
      errorMsg =
        "I encountered a technical issue while processing your request. Please rephrase your question and try again.";
    }

    const history_record_data = {
      user_id: userid,
      bot_type: "stock analysis",
      user_query: `${userQuery}, in the context of ${symbol}`,
      status: "failed",
      time: current_time,
      created_at: current_date,
    };
    await db.chat_bot_history.create(history_record_data);

    res.status(200).json({
      status: 0,
      message: "Processing error",
      data: {
        msg: errorMsg,
        suggestions,
        max_limit,
        remaining_limit,
      },
    });
  }
};

// Optional: Add endpoint to clear conversation history
export const clearConversation = async (req, res) => {
  const { userid, symbol } = req.body;
  
  if (!userid || !symbol) {
    return res.status(400).json({
      status: 0,
      message: "Missing parameters"
    });
  }
  
  const key = `${userid}_${symbol}`;
  conversationHistory.delete(key);
  
  res.status(200).json({
    status: 1,
    message: "Conversation history cleared"
  });
};