import dotEnv from "dotenv";
import db from "../models/index.js";
import moment from "moment";
import { getModelInstance } from "../utils/ai_models.js";

dotEnv.config();

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

// Conversation history for screener
const screenerHistory = new Map();

const getTrainingData = async () => {
  if (cachedTrainingData) return cachedTrainingData;

  const tables = Object.keys(tableDescriptions);
  const trainingData = {};

  await Promise.all(
    tables.map(async (table_name) => {
      try {
        let columns;

        if (
          [
            "nse_stock_cash_flow",
            "nse_stock_balance_sheet",
            "nse_stock_profit_loss",
          ].includes(table_name)
        ) {
          [columns] = await db.sequelize.query(
            `SELECT DISTINCT item_name as column_name FROM ${table_name} LIMIT 50`,
            { raw: true }
          );
        } else {
          [columns] = await db.sequelize.query(
            `SELECT column_name FROM information_schema.columns WHERE table_name = '${table_name}' ORDER BY ordinal_position`,
            { raw: true }
          );
        }

        const columnNames = columns.map((col) => col.column_name);

        trainingData[table_name] = {
          description:
            tableDescriptions[table_name] || "No description provided.",
          columns: columnNames,
        };
      } catch (error) {
        console.error(`Error fetching data for table ${table_name}:`, error);
        trainingData[table_name] = {
          description:
            tableDescriptions[table_name] || "No description provided.",
          columns: [],
        };
      }
    })
  );

  cachedTrainingData = trainingData;
  return trainingData;
};

// Get conversation history
const getScreenerHistory = (userId) => {
  if (!screenerHistory.has(userId)) {
    screenerHistory.set(userId, []);
  }
  return screenerHistory.get(userId);
};

// Add to history
const addToScreenerHistory = (userId, role, content) => {
  const history = getScreenerHistory(userId);
  history.push({ role, content, timestamp: Date.now() });
  
  if (history.length > 8) {
    history.shift();
  }
  
  screenerHistory.set(userId, history);
};

// Clear old histories
const clearOldScreenerHistories = () => {
  const ONE_HOUR = 60 * 60 * 1000;
  const now = Date.now();
  
  for (const [key, history] of screenerHistory.entries()) {
    if (history.length > 0) {
      const lastMessage = history[history.length - 1];
      if (now - lastMessage.timestamp > ONE_HOUR) {
        screenerHistory.delete(key);
      }
    }
  }
};

// Generate follow-up suggestions for screener
const generateScreenerSuggestions = (userQuery, results) => {
  const suggestions = [];
  const queryLower = userQuery.toLowerCase();
  
  if (queryLower.includes('top') || queryLower.includes('best')) {
    suggestions.push(
      "Show me stocks with highest volume",
      "Which stocks are most volatile today?",
      "List stocks with best PE ratios"
    );
  } else if (queryLower.includes('volume') || queryLower.includes('traded')) {
    suggestions.push(
      "Show me top gainers today",
      "Which stocks crossed ₹1000 today?",
      "List stocks with market cap above 10000 crores"
    );
  } else if (queryLower.includes('sector') || queryLower.includes('industry')) {
    suggestions.push(
      "Show me banking sector stocks",
      "List IT sector top performers",
      "Compare pharma sector stocks"
    );
  } else if (queryLower.includes('price') || queryLower.includes('above') || queryLower.includes('below')) {
    suggestions.push(
      "Show me stocks below ₹100",
      "Which stocks doubled in the last month?",
      "List penny stocks with high volume"
    );
  } else {
    suggestions.push(
      "Show me top 10 stocks by market cap",
      "Which stocks are near 52-week high?",
      "List stocks with PE ratio below 15"
    );
  }
  
  return suggestions.slice(0, 3);
};

// Get market context
const getMarketContext = () => {
  const currentHour = moment().tz("Asia/Kolkata").hour();
  const isMarketHours = currentHour >= 9 && currentHour < 16;
  const day = moment().tz("Asia/Kolkata").format("dddd");
  const isWeekend = day === "Saturday" || day === "Sunday";
  
  return {
    isMarketOpen: isMarketHours && !isWeekend,
    marketSession: isMarketHours && !isWeekend ? "during live trading" : "after market close",
    marketDate: moment().tz("Asia/Kolkata").format("MMMM D, YYYY"),
    dayOfWeek: day
  };
};

// Format number with Indian system
const formatNumber = (value, key = '') => {
  if (value === null || value === undefined) return 'N/A';
  
  if (typeof value === 'number') {
    const keyLower = key.toLowerCase();
    
    if (keyLower.includes('price') || keyLower.includes('close') || 
        keyLower.includes('high') || keyLower.includes('low') ||
        keyLower.includes('open')) {
      return '₹' + value.toFixed(2);
    } else if (keyLower.includes('percent') || keyLower.includes('change') ||
               keyLower.includes('margin') || keyLower.includes('ratio')) {
      return value.toFixed(2) + '%';
    } else if (value > 10000000) {
      return (value / 10000000).toFixed(2) + ' Cr';
    } else if (value > 100000) {
      return (value / 100000).toFixed(2) + ' L';
    } else {
      return value.toLocaleString('en-IN');
    }
  } else if (value instanceof Date) {
    return moment(value).format('MMM D, YYYY');
  }
  
  return value;
};

// Generate enhanced HTML response
const generateEnhancedHTML = async (results, userQuery, model) => {
  const marketContext = getMarketContext();
  
  const prompt = `
You are an expert financial analyst creating insightful stock market reports.

MARKET CONTEXT:
- Date: ${marketContext.marketDate} (${marketContext.dayOfWeek})
- Market Status: ${marketContext.isMarketOpen ? "LIVE TRADING" : "CLOSED"}
- Session: ${marketContext.marketSession}

USER QUERY: "${userQuery}"

DATA RECEIVED:
${JSON.stringify(results, null, 2)}

TASK:
Create a **professional, modern HTML report** with the following structure:

1. **Executive Summary Section**
   - <h2> with an engaging title that captures the key insight
   - 2-3 <p> paragraphs providing:
     * Context about the data (what the user asked for)
     * Key highlights and interesting patterns
     * Market implications or observations
   - Use conversational, advisor-like tone

2. **Data Table Section**
   - Clean, professional HTML <table> with ALL data from the results
   - Column headers should be human-readable (not snake_case)
   - Format numbers properly:
     * Currency: ₹2,450.50
     * Percentages: 2.45%
     * Large numbers: 1,234.56 Cr or 45.67 L
     * Volume: 1.25 Cr shares
   - Highlight noteworthy values (top performers, unusual patterns)
   - Add a row number/rank column if it's a ranking query

3. **Insights & Analysis Section**
   - <h3> heading: "Key Insights"
   - Bullet points (<ul>) highlighting:
     * Top performer and their metrics
     * Notable patterns or trends
     * Risk factors or opportunities
     * Comparative analysis if applicable

4. **Professional Touches**
   - Use semantic HTML (proper headings hierarchy)
   - Keep it clean and scannable
   - No CSS/inline styles - just structure
   - No markdown, no code blocks, no backticks
   - Ready for direct HTML rendering

TONE & STYLE:
- Professional yet accessible
- Data-driven but not dry
- Insightful, not just descriptive
- Use active voice and engaging language

EXAMPLE STRUCTURE:

<h2>🔥 Top 10 High-Volume Stocks Trading Above ₹1,000</h2>

<p>Based on today's market activity (${marketContext.marketDate}), I've identified the most actively traded stocks in the premium segment. These stocks are seeing significant investor interest ${marketContext.marketSession}.</p>

<p>The data reveals strong institutional participation, with trading volumes indicating robust market confidence. Let's break down the top performers:</p>

<table border="1" cellpadding="8" cellspacing="0">
  <thead>
    <tr>
      <th>Rank</th>
      <th>Stock Symbol</th>
      <th>Current Price</th>
      <th>Day High</th>
      <th>Day Low</th>
      <th>Volume</th>
      <th>Change %</th>
    </tr>
  </thead>
  <tbody>
    <!-- Data rows here -->
  </tbody>
</table>

<h3>📊 Key Insights</h3>
<ul>
  <li><strong>Market Leader:</strong> [Symbol] dominates with [metric], indicating [insight]</li>
  <li><strong>Volume Surge:</strong> [Observation about trading volumes]</li>
  <li><strong>Price Action:</strong> [Analysis of price movements]</li>
  <li><strong>Opportunity:</strong> [Forward-looking insight]</li>
</ul>

<p>This data suggests [overall market interpretation]. Investors might want to [actionable insight or consideration].</p>

Generate the complete HTML now:
`;

  const response = await Promise.race([
    model.invoke(prompt),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("HTML generation timeout")), 30000)
    ),
  ]);

  return response?.content
    ?.trim()
    ?.replace(/^```html/i, "")
    ?.replace(/^```/, "")
    ?.replace(/```$/, "")
    ?.trim();
};

// Generate single stock HTML
const generateSingleStockHTML = async (result, userQuery, model) => {
  const marketContext = getMarketContext();
  
  const prompt = `
You are a financial advisor providing personalized stock insights.

MARKET CONTEXT:
- Date: ${marketContext.marketDate}
- Market: ${marketContext.isMarketOpen ? "OPEN" : "CLOSED"}

USER QUERY: "${userQuery}"

STOCK DATA:
${JSON.stringify(result, null, 2)}

TASK:
Create engaging HTML (no CSS) with:

1. <h2> with stock symbol and compelling title
2. 2-3 <p> paragraphs with:
   - Current status and key metrics
   - Context and analysis
   - What this means for investors

3. <div> with key metrics in a clean layout (use simple formatting)

4. Brief outlook or consideration

STYLE:
- Conversational and confident
- Focus on insights, not just data
- Professional advisor tone
- No markdown, no CSS, just HTML

Example:
<h2>📈 RELIANCE - Strong Performance in Energy Sector</h2>
<p>As of ${marketContext.marketSession}, Reliance Industries is trading at ₹[price]...</p>

Generate HTML now:
`;

  const response = await Promise.race([
    model.invoke(prompt),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error("HTML generation timeout")), 20000)
    ),
  ]);

  return response?.content
    ?.trim()
    ?.replace(/^```html/i, "")
    ?.replace(/^```/, "")
    ?.replace(/```$/, "")
    ?.trim();
};

export const stock_screener_ai = async (req, res) => {
  let { userQuery, userid, remaining_limit, max_limit } = req.body;
  const current_date = moment().tz("Asia/kolkata").format("YYYY-MM-DD");
  const current_time = moment().tz("Asia/kolkata").format("HH:mm:ss");
  
  try {
    if (!userQuery) {
      return res.status(400).json({
        status: 0,
        message: "Missing parameters",
        data: { msg: "Missing parameters", max_limit, remaining_limit },
      });
    }

    // Clean old histories
    if (Math.random() < 0.1) {
      clearOldScreenerHistories();
    }

    let query_status = "success";
    const trainingData = await getTrainingData();
    const gemini_api_key = process.env.MAIN_GEMINI_KEY;
    const model = getModelInstance(gemini_api_key);

    // Get conversation history
    const history = getScreenerHistory(userid);
    const conversationContext = history.length > 0 
      ? `\n\nPREVIOUS CONVERSATION:\n${history.map(h => `${h.role}: ${h.content}`).join('\n')}\n`
      : '';

    // Get market context
    const marketContext = getMarketContext();

    const prompt = `
You are an expert stock market analyst and financial advisor specializing in Indian equity markets. You help investors discover and analyze stocks using sophisticated screening criteria.

CURRENT MARKET CONTEXT:
- Date: ${marketContext.marketDate} (${marketContext.dayOfWeek})
- Market Status: ${marketContext.isMarketOpen ? "LIVE TRADING SESSION" : "MARKET CLOSED"}
- Trading Session: ${marketContext.marketSession}

DATABASE STRUCTURE:
${JSON.stringify(trainingData, null, 2)}

${conversationContext}

CORE RESPONSIBILITIES:

1. **Query Analysis & Classification:**
   - Determine if query is STOCK-SPECIFIC (single company) or MARKET-LEVEL (multiple stocks/rankings)
   - Identify user intent: screening, comparison, ranking, filtering, or analysis
   - Consider conversation history for follow-up questions
   - Detect screening criteria: price ranges, volume, ratios, sectors, patterns

2. **SQL Generation Rules:**
   - Select the most relevant table from schema
   - NO UNION operations - use single table queries
   - For STOCK-SPECIFIC: Always filter by symbol_name or symbol
   - For MARKET-LEVEL: Support rankings, filters, comparisons
   - Apply LIMIT 20 for multi-row results (hard limit)
   - Always use NULLIF for division to prevent errors: col1 / NULLIF(col2, 0)
   - Order results meaningfully (DESC for rankings, ASC for ascending)
   - Include relevant columns for analysis

3. **Smart Query Handling:**
   - For vague queries ("TCS", "profit", "good stocks"): Request clarification, set sql: null
   - For greetings: Respond warmly, set sql: null
   - For invalid input (gibberish, symbols): Guide back politely, set sql: null
   - For clear queries: Generate accurate SQL

4. **Conversational Intelligence:**
   - Reference previous conversation naturally
   - Build on earlier context
   - Understand implied follow-ups
   - Maintain professional yet friendly tone

QUERY EXAMPLES & EXPECTED BEHAVIOR:

**Market-Level Queries:**
- "Show me top 10 stocks by volume" → Rank by volume DESC LIMIT 10
- "Stocks above ₹1000" → WHERE close > 1000
- "Best performers today" → ORDER BY change_percent DESC
- "Banking sector stocks" → Filter by sector
- "Stocks with PE below 15" → WHERE pe_ratio < 15

**Stock-Specific Queries:**
- "Tell me about RELIANCE" → WHERE symbol_name = 'RELIANCE'
- "TCS price" → WHERE symbol_name = 'TCS', select price data
- "INFY financials" → WHERE symbol_name = 'INFY', financial metrics

**Vague Queries (Require Clarification):**
- "TCS" → "Would you like to know TCS's current price, company details, or financial performance?"
- "profit" → "Are you looking for profitable stocks, or specific company's profit data?"
- "good stocks" → "What criteria define 'good' for you? High returns, low PE, high dividend?"

FORMATTING REQUIREMENTS:

Output JSON with three keys:
{
  "sql": "PostgreSQL query or null",
  "explanation": "Natural explanation (used for single stock or no-SQL responses)",
  "suggestions": ["Follow-up 1?", "Follow-up 2?", "Follow-up 3?"]
}

- NO markdown, HTML tags, escape characters (\\n, \\t)
- For explanations: Use {{column_name}} placeholders
- Keep explanations conversational and insightful
- Include 3 relevant follow-up suggestions

TONE & STYLE:

- **Professional Advisor:** Confident, knowledgeable, trustworthy
- **Conversational:** Natural language, not robotic
- **Insightful:** Context and implications, not just numbers
- **Engaging:** Active voice, varied sentence structure
- **Client-Focused:** Their success is your priority

Examples:
- Good: "I've identified the top 10 high-volume stocks for you. These are seeing significant institutional interest today..."
- Avoid: "Here is the query result showing stocks."

USER QUERY: "${userQuery}"

Analyze the query, generate appropriate SQL (or null), craft an insightful explanation, and suggest relevant follow-ups.

Return JSON now:
`;

    const response = await Promise.race([
      model.invoke(prompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("AI request timeout")), 30000)
      ),
    ]);

    const cleanedResponse = response?.content
      ?.trim()
      ?.replace(/^```json/i, "")
      ?.replace(/^```/, "")
      ?.replace(/```$/, "")
      ?.trim();

    if (!cleanedResponse) {
      query_status = "failed";
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

    // Handle non-SQL responses (greetings, clarifications)
    if (!parsedResponse.sql && finalResponse) {
      addToScreenerHistory(userid, 'user', userQuery);
      addToScreenerHistory(userid, 'assistant', finalResponse);

      if (suggestions.length === 0) {
        suggestions = generateScreenerSuggestions(userQuery, null);
      }

      const history_record_data = {
        user_id: userid,
        bot_type: "stock screener",
        user_query: userQuery,
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
          suggestions,
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
          setTimeout(() => reject(new Error("Database timeout")), 20000)
        ),
      ]);

      if (results.length > 1) {
        // Multiple results - generate enhanced HTML table
        finalResponse = await generateEnhancedHTML(results, userQuery, model);
        
        if (!finalResponse) {
          throw new Error("Failed to generate HTML response");
        }

      } else if (results.length === 1) {
        // Single result - generate single stock HTML
        finalResponse = await generateSingleStockHTML(results[0], userQuery, model);
        
        if (!finalResponse) {
          throw new Error("Failed to generate HTML response");
        }

      } else {
        // No results
        query_status = "failed";
        finalResponse = `
          <div style="padding: 20px; text-align: center;">
            <h2>No Results Found</h2>
            <p>I couldn't find any stocks matching your criteria. This could be because:</p>
            <ul style="text-align: left; display: inline-block;">
              <li>The stock symbol doesn't exist in our database</li>
              <li>No stocks currently meet the specified filters</li>
              <li>The data might not be available for today</li>
            </ul>
            <p>Try modifying your search criteria or ask me for suggestions!</p>
          </div>
        `;
      }

      // Generate suggestions if not provided
      if (suggestions.length === 0) {
        suggestions = generateScreenerSuggestions(userQuery, results);
      }

      // Add to conversation history
      addToScreenerHistory(userid, 'user', userQuery);
      addToScreenerHistory(userid, 'assistant', 'Generated stock analysis');

    } catch (queryError) {
      query_status = "failed";
      console.error("Database query error:", queryError);
      
      finalResponse = `
        <div style="padding: 20px;">
          <h2>⚠️ Query Error</h2>
          <p>I encountered an issue while fetching the data. This might be due to:</p>
          <ul>
            <li>Invalid stock symbol or filter criteria</li>
            <li>Temporary database connectivity issue</li>
            <li>Complex query that needs refinement</li>
          </ul>
          <p>Please try rephrasing your question or use one of the suggestions below.</p>
        </div>
      `;
      
      suggestions = [
        "Show me top 10 stocks by market cap",
        "Which stocks are above ₹500?",
        "List high-volume stocks today"
      ];
    }

    // Store query history
    const history_record_data = {
      user_id: userid,
      bot_type: "stock screener",
      user_query: userQuery,
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
        conversationId: userid
      },
    });
    
  } catch (error) {
    console.error("Stock screener error:", error);
    
    let errorMsg = `
      <div style="padding: 20px;">
        <h2>⚠️ Processing Error</h2>
        <p>I'm having trouble processing your request right now. Please try again in a moment.</p>
      </div>
    `;
    
    let suggestions = [
      "Show me top stocks by volume",
      "Which stocks crossed ₹1000?",
      "List IT sector stocks"
    ];

    if (error.message.includes("timeout")) {
      errorMsg = `
        <div style="padding: 20px;">
          <h2>⏱️ Request Timeout</h2>
          <p>Your request is taking longer than expected. Please try:</p>
          <ul>
            <li>Asking a simpler question</li>
            <li>Reducing the number of stocks requested</li>
            <li>Breaking complex queries into smaller parts</li>
          </ul>
        </div>
      `;
    } else if (error.message.includes("Invalid JSON")) {
      errorMsg = `
        <div style="padding: 20px;">
          <h2>🔧 Technical Issue</h2>
          <p>I encountered a technical issue while processing your request. Please rephrase your question and try again.</p>
        </div>
      `;
    }

    const history_record_data = {
      user_id: userid,
      bot_type: "stock screener",
      user_query: userQuery,
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

// Clear conversation endpoint
export const clearScreenerConversation = async (req, res) => {
  const { userid } = req.body;
  
  if (!userid) {
    return res.status(400).json({
      status: 0,
      message: "Missing user ID"
    });
  }
  
  screenerHistory.delete(userid);
  
  res.status(200).json({
    status: 1,
    message: "Screener conversation history cleared"
  });
};