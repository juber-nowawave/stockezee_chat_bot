import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from "dotenv";
import { sequelize as db } from "../models/index.js";

dotenv.config();

const gemini_keys = [
  "AIzaSyD7pZbsR0TTYanab0tWo4YLuAslgQm99m8",
  "AIzaSyA_WI8rxxY3J3UFApsqPwDgTvRzm9WP1pw",
  "AIzaSyBY3JWyJ8rEyZDHvsvSBNQdKVUiYVeM2go",
  "AIzaSyAok5PFvom8yNNfeEB-2ssFaxA-OyvvXbg",
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
    const [columns] = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = '${table_name}'
    `);

    const columnNames = columns.map((col) => col.column_name);

    const [[sampleRows]] = await db.query(`
      SELECT * FROM ${table_name} LIMIT 1
    `);
    trainingData[table_name] = {
      description: tableDescriptions[table_name] || "No description provided.",
      columns: columnNames,
      sample_rows: sampleRows,
    };
  }

  cachedTrainingData = trainingData;
  return trainingData;
};

export const generateSQLFromText = async (req, res) => {
  try {
    const gemini_api_key =
      gemini_keys[Math.floor(Math.random() * gemini_keys.length)];

    let { userQuery, symbol } = req.body;

    if (!userQuery || !symbol) {
      return res.status(400).json({
        status: 0,
        message: "Missing parameters",
        data: { msg: "Missing parameters" },
      });
    }

    userQuery = userQuery.concat(` in the context of ${symbol} ?`);

    const trainingData = await getTrainingData();

    const model = new ChatGoogleGenerativeAI({
      model: process.env.GOOGLE_MODEL || "gemini-1.5-flash",
      apiKey: gemini_api_key,
    });

    const prompt = `
You are a financial data assistant helping users get stock market information. Generate SQL queries and provide user-friendly explanations.

Here is the structure of the database, including table descriptions, column names, and sample rows:
${JSON.stringify(trainingData, null, 2)}

Instructions:
1. From the user's query, identify the single **most relevant** table or a **maximum of 2**.
2. Do NOT use UNION. Prefer selecting from just one logical table.
3. Use relevant columns to generate a valid PostgreSQL SQL query.
4. Return your response in the following JSON format:
{
  "sql": "your SQL query here",
  "initial_explanation": "brief explanation of what you're looking for",
  "success_template": "template for when data is found - use {DATA_SUMMARY} placeholder for actual results",
  "no_data_explanation": "explanation for when no data is found"
}

5. For success_template, create a natural response template that will be filled with actual data
6. Use {DATA_SUMMARY} as placeholder where actual data details should go
7. Examples:
   - Query: "closing price of RELIANCE" → success_template: "RELIANCE's latest closing price is {DATA_SUMMARY}"
   - Query: "Tell me about TCS" → success_template: "Here's information about TCS: {DATA_SUMMARY}"

User Query:
"${userQuery}"
`;

    const response = await model.invoke(prompt);

    const cleanedResponse = response?.content
      ?.trim()
      ?.replace(/^```json/i, "")
      ?.replace(/^```/, "")
      ?.replace(/```$/, "")
      ?.trim();

    if (!cleanedResponse) {
      return res.status(500).json({
        success: false,
        message: "Please try again!",
      });
    }

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("Error parsing JSON response:", parseError);
      const fallbackSQL = cleanedResponse;
      return res.json({
        success: true,
        sql: fallbackSQL,
        explanation:
          "SQL query generated based on your request. Please execute to see the results.",
      });
    }

    console.log('---------->',parsedResponse);
    

    if (!parsedResponse.sql) {
      return res.status(500).json({
        success: false,
        message: "Invalid response format: missing SQL query.",
      });
    }

    let actualExplanation =
      parsedResponse.initial_explanation || "Processing your request...";

    try {
      const [results] = await db.query(parsedResponse.sql);

      if (results.length > 0) {
        let dataSummary = "";

        if (results.length === 1) {
          const result = results[0];
          const keyValues = Object.entries(result)
            .filter(([key, value]) => value !== null && value !== undefined)
            .slice(0, 5)
            .map(([key, value]) => {
              if (
                typeof value === "number" &&
                (key.toLowerCase().includes("price") ||
                  key.toLowerCase().includes("value"))
              ) {
                return `${key}: ₹${value.toFixed(2)}`;
              }
              return `${key}: ${value}`;
            });
          dataSummary = keyValues.join(", ");
        } else {
          dataSummary = `Found ${results.length} records. Key data includes relevant information about ${symbol}`;
        }

        actualExplanation = parsedResponse.success_template
          ? parsedResponse.success_template.replace(
              "{DATA_SUMMARY}",
              dataSummary
            )
          : `Here's the information for ${symbol}: ${dataSummary}`;
      } else {
        actualExplanation =
          parsedResponse.no_data_explanation ||
          `I couldn't find any data for your query about ${symbol}. The company symbol might not exist in our database or there might be no recent data available.`;
      }
    } catch (queryError) {
      console.error("Error executing query for explanation:", queryError);
      actualExplanation =
        parsedResponse.initial_explanation ||
        "There was an error processing your request.";
    }

    res.status(200).json({
      status: 1,
      message: "Success",
      data: { msg: actualExplanation },
    });
  } catch (error) {
    console.error("Error generating SQL:", error);
    res.status(500).json({
      status: 0,
      message: "Server error",
      data: { msg: "Server error" },
    });
  }
};
