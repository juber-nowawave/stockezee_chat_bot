import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from "dotenv";
import db from "../models/index.js";
import moment from "moment";
import { getModelInstance } from "../utils/ai_models.js";
dotenv.config();

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
  nse_stock_profit_loss:
    "This table contains profit and loss (income statement) data for NSE stocks, including key metrics like revenue, net income, EBIT, expenses, and tax provisions.",
  nse_stock_cash_flow:
    "This table contains cash flow statement data for NSE stocks, including operating, investing, and financing cash flows, capex, free cash flow, and changes in working capital.",
  nse_stock_balance_sheet:
    "This table contains balance sheet data for NSE stocks, including assets (cash, receivables, property), liabilities (debt, payables), equity, and totals like total assets and shareholders' equity.",
  nse_eq_stock_candle_pettern_per_week:
    "Stores weekly candlestick pattern information for NSE equity stocks.",
  nse_eq_stock_candle_pettern_per_day:
    "Stores daily candlestick pattern information for NSE equity stocks.",
};

let cachedTrainingData = null;

const getTrainingData = async () => {
  if (cachedTrainingData) return cachedTrainingData;

  const tables = Object.keys(tableDescriptions);
  const trainingData = {};

  for (const table_name of tables) {
    try {
      let columns;
      let sampleRows;

      // Handle vertical format tables
      if (
        [
          "nse_stock_cash_flow",
          "nse_stock_balance_sheet",
          "nse_stock_profit_loss",
        ].includes(table_name)
      ) {
        // Get distinct item names as columns for vertical format tables
        columns = await db.sequelize.query(`
          SELECT DISTINCT item_name as column_name 
          FROM ${table_name}
          ORDER BY item_name;
        `);
        [columns] = columns;

        // Get sample data and transform from vertical to horizontal format
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

        // Transform the data to include all fields
        if (sampleRows && sampleRows.length > 0) {
          sampleRows = sampleRows.map((data) => ({
            symbol_name: data.symbol_name,
            period: data.period,
            year: data.year,
            ...data.items,
          }));
        }
      } else {
        // Handle regular horizontal format tables
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

    let query_status = "success";
    const contextualQuery = userQuery.concat(` in the context of ${symbol}`);
    const trainingData = await getTrainingData();
    const gemini_api_key = process.env.MAIN_GEMINI_KEY;

    const model = getModelInstance(gemini_api_key);
    const prompt = `
You are a financial data assistant that generates PostgreSQL queries AND crafts natural, conversational explanations based on the query results.

DATABASE STRUCTURE:
${JSON.stringify(trainingData, null, 2)}

TASK:
Given a user’s query, do BOTH in one step:
1. Identify the single most relevant table from the schema above.
2. Do NOT use UNION. Prefer selecting from just one logical table.
3. Write a valid PostgreSQL SELECT query using the correct column names.
4. Always include symbol_name in the WHERE clause.
5. Assume you have run the query and seen the actual values — use those values to create a human-friendly explanation.
6. The explanation should be conversational, like a financial advisor talking to a client.
7. If the user greets you formally with phrases like "Hey", "Hello", etc., you should also respond formally with replies such as "Hey, how can I help you?" or "Hello, how can I assist you today", etc. user query such as "how are you" etc so you have to response like "I am fine what about you" etc and in this case do'nt generate sql query and Set the "sql" key in the JSON output to null
8. If the user enters an inappropriate or invalid query — such as random symbols ($@$%#@#@#@), etc — respond politely with a message like: "Sorry, I couldn’t understand your query. Please enter a valid stock query." Always guide the user back to providing a meaningful financial query.

FORMATTING RULES:
- Output only a JSON object with "sql" and "explanation" keys.
- Do not include HTML tags, markdown, line breaks like \n\n, \\n, or extra symbols.
- For ALL values from the database (not just prices), display the **actual column names** inside double curly braces, e.g., {{close}}, {{high}}, {{promoters}}, {{fiis}}, {{diis}}, {{government}}, {{public}} , do'nt add curly braces {{}} in sql query.
- Never use generic placeholders like X, Y, Z, A, B. Always use the real column name from the table.
- For company info, summarize naturally in full sentences.
- Keep explanations concise but informative — not too short.

STYLE GUIDELINES FOR EXPLANATION:
- For price data: “KPIGREEN’s latest closing price is ₹985.50”
- For company info: “KPIGREEN is a renewable energy company focused on solar power solutions…”
- Avoid mentioning databases, SQL, or technical terms.
- Speak in an advisor tone — clear, confident, and client-focused.

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

    if (!parsedResponse.sql && finalResponse) {
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
          max_limit,
          remaining_limit,
        },
      });
    }

    if (!parsedResponse.sql) {
      query_status = "failed";
      throw new Error("No SQL query generated");
    }
    try {
      const [results] = await Promise.race([
        db.sequelize.query(parsedResponse.sql),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Database timeout")), 5000)
        ),
      ]);

      if (results.length > 0) {
        let result = results[0];
        for (let key in result) {
          finalResponse = finalResponse.replace(`{{${key}}}`, result[key]);
        }
      } else {
        query_status = "failed";
        finalResponse = `I couldn't find any data for ${symbol}. The symbol might not exist in our database or there might be no recent data available.`;
      }
    } catch (queryError) {
      console.error("Database query error:", queryError);
      query_status = "failed";
      finalResponse = `Unable to fetch data for ${symbol}. Please try again or check if the symbol or query is valid.`;
    }

    // store query history
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
        max_limit,
        remaining_limit,
      },
    });
  } catch (error) {
    console.log(error);

    let errorMsg =
      "I'm having trouble processing your request right now. Please try again.";

    if (error.message.includes("timeout")) {
      errorMsg =
        "The request is taking longer than expected. Please try with a simpler query.";
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
        max_limit,
        remaining_limit,
      },
    });
  }
};
