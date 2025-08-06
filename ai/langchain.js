import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from "dotenv";
import { sequelize as db } from "../models/index.js";

dotenv.config();

// Gemini Api Keys
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

// Table descriptions
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
};

// Fetch schema and sample data
const getTrainingData = async () => {
  const [tables] = await db.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
  `);

  const trainingData = {};

  for (const { table_name } of tables) {
    const [columns] = await db.query(`
      SELECT column_name
      FROM information_schema.columns
      WHERE table_name = '${table_name}'
    `);

    const columnNames = columns.map((col) => col.column_name);

    const [sampleRows] = await db.query(`
      SELECT * FROM ${table_name} LIMIT 3
    `);

    trainingData[table_name] = {
      description: tableDescriptions[table_name] || "No description provided.",
      columns: columnNames,
      sample_rows: sampleRows,
    };
  }

  return trainingData;
};

// Main controller
export const generateSQLFromText = async (req, res) => {
  try {
    const gemini_api_key = gemini_keys[Math.floor(Math.random() * gemini_keys.length)];

    let { userQuery, symbol } = req.body;

    if (!userQuery || !symbol) {
      return res
        .status(400)
        .json({
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
  "explanation": "natural, conversational explanation as if you're directly answering the user's question about stock data, not about database operations"
}
5. For the explanation, respond as if you're a financial assistant answering their stock question directly.
6. Examples of good explanations:
   - Query: "closing price of RELIANCE" → Explanation: "I'll get you the latest closing price for Reliance Industries stock."
   - Query: "Tell me about TCS" → Explanation: "I'll provide you with detailed company information about Tata Consultancy Services, including their business overview and key details."
   - Query: "compare INFY with peers" → Explanation: "I'll show you how Infosys performs compared to its industry peers in terms of key financial metrics."

User Query:
"${userQuery}"
`;

    // console.log("Prompt:\n", prompt);

    const response = await model.invoke(prompt);
    // console.log("Gemini response:\n", response);

    // Clean the response
    const cleanedResponse = response?.content
      ?.trim()
      ?.replace(/^```json/i, "")
      ?.replace(/^```/, "")
      ?.replace(/```$/, "")
      ?.trim();

    if (!cleanedResponse) {
      return res.status(500).json({
        success: false,
        message: "Gemini did not return a valid response.",
      });
    }

    // Try to parse JSON response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(cleanedResponse);
    } catch (parseError) {
      console.error("Error parsing JSON response:", parseError);

      // Fallback: treat the entire response as SQL (backward compatibility)
      const fallbackSQL = cleanedResponse;
      return res.json({
        success: true,
        sql: fallbackSQL,
        explanation:
          "SQL query generated based on your request. Please execute to see the results.",
      });
    }

    // Validate the parsed response
    if (!parsedResponse.sql) {
      return res.status(500).json({
        success: false,
        message: "Invalid response format: missing SQL query.",
      });
    }

    // Execute the query to get actual data for better explanation
    let queryResults = [];
    let actualExplanation = parsedResponse.explanation;

    try {
      const [results] = await db.query(parsedResponse.sql);
      queryResults = results;

      // Generate explanation with actual data
      if (results.length > 0) {
        const dataExplanationPrompt = `
You are a financial assistant. The user asked: "${userQuery}"

The query returned this data:
${JSON.stringify(results.slice(0, 3), null, 2)}
Total records: ${results.length}

Provide a natural, conversational response that directly answers the user's question using the actual data values. 

Guidelines:
1. Use specific numbers/values from the results
2. Be conversational like a financial advisor
3. Don't mention database or technical details
4. If it's price data, format it properly (₹XXX.XX)
5. If it's company info, summarize key points naturally
6. Keep it concise but informative

Examples:
- For price: "KPIGREEN's latest closing price is ₹985.50"
- For company info: "KPIGREEN is a renewable energy company focused on solar power solutions..."
`;

        const explanationModel = new ChatGoogleGenerativeAI({
          model: process.env.GOOGLE_MODEL || "gemini-1.5-flash",
          apiKey: gemini_api_key,
        });

        const explanationResponse = await explanationModel.invoke(
          dataExplanationPrompt
        );
        actualExplanation =
          explanationResponse?.content?.trim() || parsedResponse.explanation;
      } else {
        actualExplanation = `I couldn't find any data for your query about ${userQuery}. The company symbol might not exist in our database or there might be no recent data available.`;
      }
    } catch (queryError) {
      console.error("Error executing query for explanation:", queryError);
      // Keep the original explanation if query fails
    }

    // res.json({
    //   success: true,
    //   sql: parsedResponse.sql,
    //   explanation: actualExplanation,
    //   data: queryResults.slice(0, 10), // Include first 10 records
    //   totalRecords: queryResults.length
    // });

    res
      .status(200)
      .json({
        status: 1,
        message: "Success",
        data: { msg: actualExplanation },
      });
  } catch (error) {
    console.error("Error generating SQL:", error);
    res
      .status(500)
      .json({
        status: 0,
        message: "Server error",
        data: { msg: "Server error" },
      });
  }
};

// Optional: Add a separate endpoint for executing the query and getting human-readable results
// export const executeAndExplainSQL = async (req, res) => {
//   try {
//     const { sql, userQuery } = req.body;

//     if (!sql) {
//       return res.status(400).json({
//         success: false,
//         message: "SQL query is required."
//       });
//     }

//     // Execute the SQL query
//     const [results] = await db.query(sql);

//     if (results.length === 0) {
//       return res.json({
//         success: true,
//         data: [],
//         explanation: "No data found matching your query criteria.",
//         summary: "The query executed successfully but returned no results."
//       });
//     }

//     // Generate human-readable explanation of the results
//     const model = new ChatGoogleGenerativeAI({
//       model: process.env.GOOGLE_MODEL || "gemini-1.5-flash",
//       apiKey: gemini_api_key,
//     });

//     const explanationPrompt = `
// You are a financial assistant providing insights on stock market data to a user.

// Original user query: "${userQuery || 'Data query'}"
// Query results: ${JSON.stringify(results.slice(0, 5), null, 2)}
// Total records: ${results.length}

// Provide a natural, conversational response as if you're directly answering the user's question about stocks/financial data.

// Guidelines:
// 1. Answer their question directly with the actual data
// 2. Use the stock/company names naturally
// 3. Include relevant numbers/values from the results
// 4. Add brief context or insights if helpful
// 5. Don't mention database tables or technical query details
// 6. Keep it concise and business-focused

// Examples:
// - If they asked for closing price: "KPIGREEN's latest closing price is ₹XXX"
// - If they asked about company info: "TCS is a leading IT services company..."
// - If they asked for historical data: "Here's the price movement for the stock over the requested period..."
// `;

//     const explanationResponse = await model.invoke(explanationPrompt);

//     // res.json({
//     //   success: true,
//     //   data: results,
//     //   explanation: explanationResponse?.content?.trim() || "Data retrieved successfully.",
//     //   summary: `Found ${results.length} record(s) matching your query.`
//     // });
//     res.status(200).json({status:1 ,message:"Success", data:{msg: explanationResponse?.content?.trim() || "Something wrong!"}})
//   } catch (error) {
//     console.error("Error executing and explaining SQL:", error);
//     res.status(500).json({status:0 ,message: error.message, data:{msg:"Error executing query"}});
//   }
// };
