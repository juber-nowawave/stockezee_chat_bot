import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotEnv from "dotenv";
import { sequelize as db } from "../models/index.js";
import { getModelInstance } from "../utils/ai_models.js";

dotEnv.config();

const gemini_keys = [
  "AIzaSyD7pZbsR0TTYanab0tWo4YLuAslgQm99m8",
  "AIzaSyA_WI8rxxY3J3UFApsqPwDgTvRzm9WP1pw",
  "AIzaSyAcq-na7B01r4jmW04wFiQq1fId2hfJluI",
  "AIzaSyD0q1BotGSOkyfUQll08f7P-MhOlJD4CYI",
  "AIzaSyAjXKODb8JtQoxMCLAFmN9piqArr_qbc6c",
  "AIzaSyDO3fMZJbsgiFA0WUm4b_X_jG8DvkNtpHU",
  "AIzaSyATNF479QLaGILiipviMSxGLB1hKVsRyO8",
  "AIzaSyBtmcRALIuS9N9fVSURXJ2VnMYN8DN7VuU",
  "AIzaSyDRfJXVsrvLhhkC4egQ3icVLjnJKBQ7drI",
  "AIzaSyBZWWu249O2rB6yESZm2yF-9pfC8cJuuBM",
];

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
  nse_company_shareholding:
    "This table contains shareholding pattern data of companies, including promoters, FIIs, DIIs, etc.",
  nse_insider_corporate_scraped_data:
    "This table contains insider trading and corporate action data scraped from NSE.",
  nse_slbs_scraped_data:
    "This table contains Securities Lending and Borrowing Scheme (SLBS) data from NSE.",
  nse_eq_stock_candle_pettern_per_week:
    "Stores weekly candlestick pattern information for NSE equity stocks.",
  nse_eq_stock_candle_pettern_per_day:
    "Stores daily candlestick pattern information for NSE equity stocks.",
  nse_company_financials:
    "Contains detailed company financial data such as net profit, expenses, period, and profit before tax.",
  nse_company_profile:
    "Contains company profile information including name, series, industry, sector, trading status, board status, FFMC, and total market capitalization.",
  global_mcx_equity_stock_data_daily:
    "Contains daily data for global commodities and currencies.",
  global_eq_stock_data_daily: "Contains daily data for global equity stocks.",
  fii_buying_scrape_data:
    "Contains Foreign Institutional Investor (FII) buying data scraped from NSE.",
};

let cachedTrainingData = null;

const getTrainingData = async () => {
  if (cachedTrainingData) return cachedTrainingData;

  const tables = Object.keys(tableDescriptions);
  const trainingData = {};

  for (const table_name of tables) {
    try {
      const [columns] = await db.query(`
        SELECT column_name
        FROM information_schema.columns
        WHERE table_name = '${table_name}'
        ORDER BY ordinal_position
      `);

      const columnNames = columns.map((col) => col.column_name);

      const [sampleRows] = await db.query(`
        SELECT * FROM ${table_name} 
        ORDER BY created_at DESC 
        LIMIT 1
      `);

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

export const market_details_ai = async (req, res) => {
  try {
    let { userQuery } = req.body;

    if (!userQuery) {
      return res.status(400).json({
        status: 0,
        message: "Missing parameters",
        data: { msg: "Missing parameters" },
      });
    }

    const contextualQuery = userQuery;
    const trainingData = await getTrainingData();
    const gemini_api_key =
      gemini_keys[Math.floor(Math.random() * gemini_keys.length)];
    const model = getModelInstance(gemini_api_key);

    const prompt = `
You are a financial data assistant that generates PostgreSQL queries AND crafts natural, conversational explanations based on the query results.

DATABASE STRUCTURE:
${JSON.stringify(trainingData, null, 2)}

TASK:
Given a user’s query, do BOTH in one step:
1. Determine if the query is STOCK-SPECIFIC (about a single symbol/company) or MARKET-LEVEL (about multiple stocks or rankings).
2. Identify the most relevant table from the schema above.
3. Do NOT use UNION. Prefer selecting from just one logical table.
4. Write a valid PostgreSQL SELECT query using the correct column names.
5. For STOCK-SPECIFIC queries:
   - Always include symbol or symbol_name in the WHERE clause.
6. For MARKET-LEVEL queries:
   - Handle filters (e.g., high > 1000), rankings (e.g., top 5 by close), or comparisons (e.g., biggest gainers).
7. Assume you have run the query and seen the actual values — use those values to create a human-friendly explanation.
8. The explanation should be conversational, like a financial advisor talking to a client.
9. If the user greets you formally with phrases like "Hey", "Hello", etc., you should also respond formally with replies such as "Hey, how can I help you?" or "Hello, how can I assist you today" etc
10. If the user enters an inappropriate or invalid query — such as random symbols ($@$%#@#@#@), empty input, meaningless text, excessively long gibberish, or queries that don’t match any valid stock, company, or filter — respond politely with a message like: "Sorry, I couldn’t understand your query. Please enter a valid stock query." Always guide the user back to providing a meaningful financial query.

FORMATTING RULES:
- Output only a JSON object with "sql" and "explanation" keys.
- Do not include HTML tags, markdown, or escape characters like \\n or \\t.
- For prices, display column names in double curly braces, e.g., {{close}}, {{high}}, {{low}}, {{open}}.
- For company info, summarize naturally in full sentences.
- if user asked for large data greater than 20 so Maximum data limit should be 20 , add limit in sql query
- Always handle division by zero using NULLIF in the denominator (e.g., col1 / NULLIF(col2, 0)).
- Keep explanations concise but insightful.

AI Output should be:  
[[{symbol_name}: ₹{current_price}]]
STYLE GUIDELINES FOR EXPLANATION:
- STOCK-SPECIFIC: “KPIGREEN’s latest closing price is ₹{{close}}, with today’s high at ₹{{high}} and low at ₹{{low}}.”
- MARKET-LEVEL: “Here are the top 5 stocks by closing price: RELIANCE at ₹{{close}}, TCS at ₹{{close}}, …” 
- Avoid technical jargon like ‘query’ or ‘SQL’.
- Speak in a confident, client-focused advisor tone.

USER QUERY: "${contextualQuery}"

Return JSON in this format:
{
  "sql": "PostgreSQL query here",
  "explanation": "Natural, advisor-style explanation using the fetched data"
}
`;

    const response = await Promise.race([
      model.invoke(prompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("AI request timeout")), 10000)
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
      throw new Error("Invalid JSON response from AI");
    }

    let finalResponse = parsedResponse.explanation;

    if (!parsedResponse.sql && finalResponse) {
      return res.status(200).json({
        status: 1,
        message: "Success",
        data: {
          msg: finalResponse,
        },
      });
    }

    if (!parsedResponse.sql) {
      throw new Error("No SQL query generated");
    }

    try {
      const [results] = await Promise.race([
        db.query(parsedResponse.sql),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Database timeout")), 20000)
        ),
      ]);

      if (results.length > 1) {
        const prompt2 = `
You are a financial data assistant.
You are given an array of JSON objects representing stock or financial data:
${JSON.stringify(results, null, 2)}

TASK:
Generate a **complete HTML block** containing:
1. A <h2> heading summarizing the data type and context.
2. One or more <p> paragraphs providing an enhanced, conversational explanation of the data.
3. An HTML <table> showing all rows from the array above.
   - Include column headers from the object keys.
   - Format numbers with commas.
   - If a value represents currency, prefix it with ₹.
   - Make the table clean and minimal with borders, padding, and alternating row colors.
4. The final HTML should be ready for direct embedding (no Markdown, no JSON, no backticks).

Example structure:
<h2>Top 5 Stocks with Price Above ₹1,000</h2>
<p>Here’s a list of stocks currently trading well above the ₹1,000 mark...</p>
<table>...</table>
<p>From the above table, we can see that...</p>
`;

        const response2 = await Promise.race([
          model.invoke(prompt2),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("AI request timeout")), 20000)
          ),
        ]);
        const cleanedHTML = response2?.content
          ?.trim()
          ?.replace(/^```html/i, "")
          ?.replace(/^```/, "")
          ?.replace(/```$/, "")
          ?.trim();

        if (!cleanedHTML) {
          throw new Error("Empty AI HTML response");
        }

        finalResponse = cleanedHTML;
      } else if (results.length === 1) {
        const result = results[0];
        const prompt2 = `
You are a financial data assistant.
You are given this stock data:
${JSON.stringify(result, null, 2)}

TASK:
Generate a **complete HTML block** containing:
1. A <h2> heading summarizing the stock.
2. One or more <p> paragraphs explaining the key details in plain language.
3. No table needed since this is only one record.
4. The final HTML should be ready for direct embedding (no Markdown, no JSON, no backticks).
`;

        const response2 = await Promise.race([
          model.invoke(prompt2),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error("AI request timeout")), 20000)
          ),
        ]);

        const cleanedHTML = response2?.content
          ?.trim()
          ?.replace(/^```html/i, "")
          ?.replace(/^```/, "")
          ?.replace(/```$/, "")
          ?.trim();

        if (!cleanedHTML) {
          throw new Error("Empty AI HTML response");
        }

        finalResponse = cleanedHTML;
      } else {
        finalResponse = `<p>I couldn't find any data for ${symbol}. The symbol might not exist in our database or there might be no recent data available.</p>`;
      }
    } catch (queryError) {
      console.error("Database query error:", queryError);
      finalResponse = `Unable to fetch data. Please try again`;
    }

    res.status(200).json({
      status: 1,
      message: "Success",
      data: {
        msg: finalResponse,
      },
    });
  } catch (error) {
    let errorMsg =
      "I'm having trouble processing your request right now. Please try again.";
    if (error.message.includes("timeout")) {
      errorMsg =
        "The request is taking longer than expected. Please try with a simpler query.";
    }
    res.status(200).json({
      status: 0,
      message: "Processing error",
      data: {
        msg: errorMsg,
      },
    });
  }
};
