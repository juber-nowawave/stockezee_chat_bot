
import dotenv from "dotenv";
import db from "../models/index.js";
import moment from "moment";
import { getBedrockLangChainInstance } from "../utils/ai_models.js";
import { fetchStockData } from "../utils/stock_data_fetcher.js";
dotenv.config();
const isGreetingQuery = (query) => {
  const greetingPatterns = /^(hi|hello|hey|good\s*(morning|evening|afternoon|night)|how\s+are\s+you|what'?s?\s+up|namaste|hii+|hellooo)/i;
  return greetingPatterns.test(query.trim());
};

const isInvalidQuery = (query) => {
  const validCharRatio = (query.match(/[a-zA-Z0-9\s?]/g) || []).length / query.length;
  return validCharRatio < 0.5;
};

export const stock_analysis_ai = async (req, res) => {
  let { userQuery, symbol, userid, precise_output ,remaining_limit, max_limit } = req.body;
  const current_date = moment().tz("Asia/kolkata").format("YYYY-MM-DD");
  const current_time = moment().tz("Asia/kolkata").format("HH:mm:ss");

  let query_status = "success";

  try {
    if (!userQuery || !symbol) {
      return res.status(400).json({
        status: 0,
        message: "Missing parameters",
        data: { msg: "Missing parameters", max_limit, remaining_limit },
      });
    }

    const openai_api_key = process.env.OPENAI_API_KEYS;
    if (!openai_api_key) {
      throw new Error("OPENAI_API_KEYS not found in environment variables");
    }

    const model = getBedrockLangChainInstance(openai_api_key);

    if (isGreetingQuery(userQuery)) {
      const greetPrompt = `
You are Stockezee AI — a friendly, professional stock market assistant for Indian markets.
The user has greeted you. Respond warmly and briefly, and let them know you can help with stock analysis, financials, price data, and company insights.
User said: "${userQuery}"
Keep your reply to 1-2 short sentences. Do NOT mention SQL or databases.
`;
      const greetResponse = await model.invoke(greetPrompt);
      const greetMsg = greetResponse?.content?.trim() || "Hey! How can I help you with your stock analysis today?";

      await db.chat_bot_history.create({
        user_id: userid,
        bot_type: "stock analysis",
        user_query: `${userQuery}, in the context of ${symbol}`,
        status: "success",
        time: current_time,
        created_at: current_date,
      });

      remaining_limit = remaining_limit - 1;
      return res.status(200).json({
        status: 1,
        message: "Success",
        data: { msg: greetMsg, max_limit, remaining_limit },
      });
    }

    // ── Handle obviously invalid / gibberish queries ─────────────────────────
    if (isInvalidQuery(userQuery)) {
      await db.chat_bot_history.create({
        user_id: userid,
        bot_type: "stock analysis",
        user_query: `${userQuery}, in the context of ${symbol}`,
        status: "success",
        time: current_time,
        created_at: current_date,
      });

      remaining_limit = remaining_limit - 1;
      return res.status(200).json({
        status: 1,
        message: "Success",
        data: {
          msg: "Sorry, I couldn't understand your query. Please enter a valid stock question — for example, try asking about a company's financials, balance sheet, revenue, or stock price.",
          max_limit,
          remaining_limit,
        },
      });
    }

    // ── Fetch all stock data in parallel ─────────────────────────────────────
    console.log(`[StockAnalysisAI] Fetching data for: ${symbol}`);
    const stockContext = await fetchStockData(symbol);
    console.log(JSON.stringify(stockContext));
    
    // ── Build the AI prompt ───────────────────────────────────────────────────
let prompt = `
You are Stozy — a dedicated financial AI assistant specialized in Indian stock markets (NSE/BSE).  
You act as a strong, senior financial advisor with over 25 years of experience.  
You speak with authority, confidence, precision and directness — like a battle-hardened market veteran who has navigated multiple bull runs, crashes, and sideways phases.  
You give clear, no-nonsense professional opinions. You are not overly chatty or casual.

Important rule — identity & meta questions:  
If the user asks about your name, who you are, what model you are, whether you are AI or human, your age, your company, your location, your capabilities outside of stock analysis, or any personal / meta / off-topic question —  
you answer ONLY with one short sentence and redirect immediately:

"I am Stozy, your financial AI assistant focused on Indian stock markets. Ask me about any stock, price, trend, financials, ratios, valuation or market view."

Do NOT give long explanations, do NOT play along, do NOT answer personal questions in detail.

Today's date is ${current_date}.

You are given comprehensive real-time financial data for ${symbol} below.
Answer the user's question using ONLY the data provided. Never invent or assume numbers.

---
STOCK DATA FOR ${symbol}
Intraday Price Data
${stockContext.intraday_price_data ? JSON.stringify(stockContext.intraday_price_data, null, 2) : "Not available"}

Current Price Data
${stockContext.current_price_data ? JSON.stringify(stockContext.current_price_data, null, 2) : "Not available"}

Company Profile / Bio
${stockContext.company_bio ? JSON.stringify(stockContext.company_bio, null, 2) : "Not available"}

Company Details & Key Ratios
${stockContext.company_details ? JSON.stringify(stockContext.company_details, null, 2) : "Not available"}

Historical Stock Data (Last 30 Days)
${stockContext.historical_data.length > 0 ? JSON.stringify(stockContext.historical_data, null, 2) : "Not available"}

Profit & Loss (Last 8 Quarters)
${stockContext.profit_and_loss.length > 0 ? JSON.stringify(stockContext.profit_and_loss, null, 2) : "Not available"}

Balance Sheet (Last 8 Quarters)
${stockContext.balance_sheet.length > 0 ? JSON.stringify(stockContext.balance_sheet, null, 2) : "Not available"}

Cash Flow Statement (Last 8 Quarters)
${stockContext.cash_flow.length > 0 ? JSON.stringify(stockContext.cash_flow, null, 2) : "Not available"}

Technical Indicators
${stockContext.technical_indicators ? JSON.stringify(stockContext.technical_indicators, null, 2) : "Not available"}

Peer Comparison
${stockContext.peers.length > 0 ? JSON.stringify(stockContext.peers, null, 2) : "Not available"}

Stock Scores
${stockContext.stock_scores ? JSON.stringify(stockContext.stock_scores, null, 2) : "Not available"}

Daily and Weekly Candle Pattern
${stockContext.daily_candle_pattern ? JSON.stringify(stockContext.daily_candle_pattern, null, 2) : "Not available"}
${stockContext.weekly_candle_pattern ? JSON.stringify(stockContext.weekly_candle_pattern, null, 2) : "Not available"}

---
USER QUESTION
${userQuery} — in the context of ${symbol}

---
RESPONSE INSTRUCTIONS — FOLLOW THESE RULES STRICTLY AND IN THIS ORDER OF PRIORITY
`

if(precise_output){
   prompt += `1. The very first paragraph(s) must directly answer the exact question the user asked — start immediately with the core information they want.
   Do NOT begin with CURRENT PRICE or any other fixed section unless that is literally what the user is asking about.

   2. Only after delivering the direct answer to the question may you add supporting context, analysis or additional relevant sections.

   3. Always include a TREND ANALYSIS section somewhere in the response (unless the question is extremely narrow and clearly unrelated to price movement, e.g. only dividend policy or shareholding pattern).
   Place TREND ANALYSIS where it logically fits — usually soon after the main answer.

   4. In the TREND ANALYSIS section clearly state:
   - short-term trend (last 5–10 trading days)
   - medium-term trend (last 1 month)
   - overall direction (strong uptrend / moderate uptrend / mild downtrend / clear downtrend / sideways / consolidation)
   - support it with recent price action, volume behaviour and key levels visible in the data

   5. Use only plain text. Never use #, ##, **, *, -, _, \`, --- or any markdown/formatting symbols.

   6. Separate ideas with blank lines. Use clear uppercase labels followed by colon when you create sections, for example:
   CURRENT PRICE:
   TREND ANALYSIS:
   PROFIT & LOSS HIGHLIGHTS:
   VALUATION METRICS:
   KEY POINTS:
   SUMMARY:

   7. Choose section labels and their order based on what the question actually requires. Do not force a fixed sequence.

   8. Use ₹ for rupees, % for percentages, Cr for crores.
   Write large numbers in readable format (₹12,345 Cr, 1.24 lakh shares, etc.).

   9. Speak with the confidence and directness of a senior market professional.

   10. If the full answer is long, end with a concise SUMMARY: section.

   Now deliver your expert analysis:
  ` 
 }else{
   prompt += `
   1. Give a direct, clear and strong answer to exactly what the user asked.
   2. Explain properly — like a senior advisor giving a thoughtful, detailed explanation to a serious investor.
   3. Include relevant numbers, context, reasoning and important insights — but ONLY what helps answer THIS question well.
   4. Write a complete, high-quality explanation — not one-liner. Aim for enough depth so the user really understands (usually several sentences / good paragraph(s)).
   5. Do NOT use any section labels (CURRENT PRICE:, TREND ANALYSIS:, SUMMARY:, etc.) unless the user explicitly asked about that exact topic.
   6. Do NOT talk about trend, momentum, up/down movement, chart patterns or technicals UNLESS the user specifically asked about price direction / trend / movement.
   7. Do NOT add a separate summary section.
   8. Write in natural paragraphs. Use blank lines for readability when needed.
   9. Use ₹ for rupees, % for percentages, Cr for crores, and readable number formats.
   10. Keep tone confident, professional, direct — no fluff, no irrelevant information.
  `
 }

    const response = await Promise.race([
      model.invoke(prompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("AI request timeout")), 120000)
      ),
    ]);

    let finalResponse = response.content.trim();

    if (finalResponse.includes("</reasoning>")) {
      finalResponse = finalResponse.split("</reasoning>")[1]?.trim() || finalResponse;
    }

    if (!finalResponse) {
      throw new Error("Empty AI response");
    }

    // ── Save history ──────────────────────────────────────────────────────────
    await db.chat_bot_history.create({
      user_id: userid,
      bot_type: "stock analysis",
      user_query: `${userQuery}, in the context of ${symbol}`,
      status: query_status,
      time: current_time,
      created_at: current_date,
    });

    remaining_limit = remaining_limit - 1;

    return res.status(200).json({
      status: 1,
      message: "Success",
      data: {
        msg: finalResponse,
        max_limit,
        remaining_limit,
      },
    });
  } catch (error) {
    console.error("[StockAnalysisAI] Error:", error);

    let errorMsg =
      "I'm having trouble processing your request right now. Please try again.";

    if (error.message?.includes("timeout")) {
      errorMsg =
        "The request is taking longer than expected. Please try with a more specific question.";
    }

    const history_record_data = {
      user_id: userid,
      bot_type: "stock analysis",
      user_query: `${userQuery}, in the context of ${symbol}`,
      status: "failed",
      time: current_time,
      created_at: current_date,
    };
    try {
      await db.chat_bot_history.create(history_record_data);
    } catch (_) {}

    return res.status(200).json({
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
