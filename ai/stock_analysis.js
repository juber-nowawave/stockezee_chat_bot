import dotenv from "dotenv";

import db from "../models/index.js";

import moment from "moment";

import { getBedrockLangChainInstance } from "../utils/ai_models.js";

import { fetchStockData } from "../utils/stock_data_fetcher.js";

dotenv.config();

const isGreetingQuery = (query) => {
  const greetingPatterns =
    /^(hi|hello|hey|good\s*(morning|evening|afternoon|night)|how\s+are\s+you|what'?s?\s+up|namaste|hii+|hellooo)/i;

  return greetingPatterns.test(query.trim());
};

const isInvalidQuery = (query) => {
  const validCharRatio =
    (query.match(/[a-zA-Z0-9\s?]/g) || []).length / query.length;

  return validCharRatio < 0.5;
};

export const stock_analysis_ai = async (req, res) => {
  let {
    userQuery,
    symbol,
    userid,
    precise_output,
    remaining_limit,
    max_limit,
  } = req.body;

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

      const greetMsg =
        greetResponse?.content?.trim() ||
        "Hey! How can I help you with your stock analysis today?";

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
    } // ── Handle obviously invalid / gibberish queries ─────────────────────────

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
    } // ── Fetch all stock data in parallel ─────────────────────────────────────

    console.log(`[StockAnalysisAI] Fetching data for: ${symbol}`);

    const stockContext = await fetchStockData(symbol); // ── Build data availability manifest ─────────────────────────────────────

    const dataManifest = {
      intraday_price_data: stockContext.intraday_price_data
        ? "PRESENT"
        : "MISSING",

      current_price_data: stockContext.current_price_data
        ? "PRESENT"
        : "MISSING",

      company_bio: stockContext.company_bio ? "PRESENT" : "MISSING",

      company_details: stockContext.company_details ? "PRESENT" : "MISSING",

      historical_data:
        stockContext.historical_data?.length > 0 ? "PRESENT" : "MISSING",

      profit_and_loss:
        stockContext.profit_and_loss?.length > 0 ? "PRESENT" : "MISSING",

      balance_sheet:
        stockContext.balance_sheet?.length > 0 ? "PRESENT" : "MISSING",

      cash_flow: stockContext.cash_flow?.length > 0 ? "PRESENT" : "MISSING",

      technical_indicators: stockContext.technical_indicators
        ? "PRESENT"
        : "MISSING",

      peers: stockContext.peers?.length > 0 ? "PRESENT" : "MISSING",

      stock_scores: stockContext.stock_scores ? "PRESENT" : "MISSING",

      daily_candle_pattern: stockContext.daily_candle_pattern
        ? "PRESENT"
        : "MISSING",

      weekly_candle_pattern: stockContext.weekly_candle_pattern
        ? "PRESENT"
        : "MISSING",
    };

    const manifestLines = Object.entries(dataManifest)

      .map(([k, v]) => `  ${k.padEnd(26)}: ${v}`)

      .join("\n"); // ── Build the AI prompt ───────────────────────────────────────────────────

    let prompt = `

You are Stozy — a dedicated financial AI assistant specialized in Indian stock markets (NSE/BSE).

You act as a strong, senior financial advisor with over 25 years of experience.

You speak with authority, confidence, precision and directness — like a battle-hardened market veteran who has navigated multiple bull runs, crashes, and sideways phases.

You give clear, no-nonsense professional opinions. You are not overly chatty or casual.



IDENTITY & META QUESTION RULE (ABSOLUTE HIGHEST PRIORITY):

If the user asks about your name, who you are, what model you are, whether you are AI or human, your age, your company, your location, your capabilities outside of stock analysis, or any personal / meta / off-topic question — answer ONLY with this one sentence and redirect immediately:

"I am Stozy, your financial AI assistant focused on Indian stock markets. Ask me about any stock, price, trend, financials, ratios, valuation or market view."

Do NOT elaborate, play along, or answer personal questions in any further detail.



Today's date is ${current_date}.



═══════════════════════════════════════════════════════════

SECTION 1 — STOCK DATA FOR: ${symbol}

═══════════════════════════════════════════════════════════



[INTRADAY PRICE DATA]

${stockContext.intraday_price_data ? JSON.stringify(stockContext.intraday_price_data, null, 2) : "NOT AVAILABLE"}



[CURRENT PRICE DATA]

${stockContext.current_price_data ? JSON.stringify(stockContext.current_price_data, null, 2) : "NOT AVAILABLE"}



[COMPANY PROFILE / BIO]

${stockContext.company_bio ? JSON.stringify(stockContext.company_bio, null, 2) : "NOT AVAILABLE"}



[COMPANY DETAILS & KEY RATIOS]

${stockContext.company_details ? JSON.stringify(stockContext.company_details, null, 2) : "NOT AVAILABLE"}



[HISTORICAL STOCK DATA — LAST 30 DAYS]

${stockContext.historical_data?.length > 0 ? JSON.stringify(stockContext.historical_data, null, 2) : "NOT AVAILABLE"}



[PROFIT & LOSS — LAST 8 QUARTERS]

${stockContext.profit_and_loss?.length > 0 ? JSON.stringify(stockContext.profit_and_loss, null, 2) : "NOT AVAILABLE"}



[BALANCE SHEET — LAST 8 QUARTERS]

${stockContext.balance_sheet?.length > 0 ? JSON.stringify(stockContext.balance_sheet, null, 2) : "NOT AVAILABLE"}



[CASH FLOW STATEMENT — LAST 8 QUARTERS]

${stockContext.cash_flow?.length > 0 ? JSON.stringify(stockContext.cash_flow, null, 2) : "NOT AVAILABLE"}



[TECHNICAL INDICATORS]

${stockContext.technical_indicators ? JSON.stringify(stockContext.technical_indicators, null, 2) : "NOT AVAILABLE"}



[PEER COMPARISON]

${stockContext.peers?.length > 0 ? JSON.stringify(stockContext.peers, null, 2) : "NOT AVAILABLE"}



[STOCK SCORES]

${stockContext.stock_scores ? JSON.stringify(stockContext.stock_scores, null, 2) : "NOT AVAILABLE"}



[DAILY CANDLE PATTERN]

${stockContext.daily_candle_pattern ? JSON.stringify(stockContext.daily_candle_pattern, null, 2) : "NOT AVAILABLE"}



[WEEKLY CANDLE PATTERN]

${stockContext.weekly_candle_pattern ? JSON.stringify(stockContext.weekly_candle_pattern, null, 2) : "NOT AVAILABLE"}



═══════════════════════════════════════════════════════════

SECTION 2 — DATA AVAILABILITY MANIFEST

═══════════════════════════════════════════════════════════

Read this manifest BEFORE composing your answer.

You MUST NOT reference, derive any insight from, or mention any section listed as MISSING.



${manifestLines}



═══════════════════════════════════════════════════════════

SECTION 3 — ANTI-HALLUCINATION RULES (NON-NEGOTIABLE)

═══════════════════════════════════════════════════════════

1. Every number you state MUST be sourced directly from Section 1 above. No exceptions.

2. Do NOT interpolate, estimate, extrapolate, or invent any figure whatsoever.

3. Do NOT reference external events, analyst targets, or forecasts not found in Section 1.

4. Do NOT perform speculative multi-hop calculations (e.g. projecting future EPS) unless every raw input is explicitly present in the data.

5. If a section is MISSING and the user asks about it, explicitly state it is unavailable — do NOT substitute with a related number or a general statement.

6. SELF-CHECK: Before writing your final answer, ask yourself — "Can I point to the exact field in Section 1 for every number I have written?" If no for any number, remove it or clearly caveat it with the source limitation.



═══════════════════════════════════════════════════════════

SECTION 4 — MISSING DATA PROTOCOL

═══════════════════════════════════════════════════════════

Apply exactly these responses (wording unmodified) when data is absent:



• technical_indicators is MISSING and user asks about technicals:

  Reply: "Technical indicator data is currently unavailable for ${symbol}."



• profit_and_loss AND balance_sheet AND cash_flow are all MISSING and user asks about financials:

  Reply: "Quarterly financial statements are not available for ${symbol} at this time."



• current_price_data AND intraday_price_data are both MISSING and user asks about price:

  Reply: "Live price data for ${symbol} is currently unavailable."



• Any other MISSING section relevant to the query:

  Append at the end of your response (inside the wrapper):

  <p><em>Note: [Section Name] data was unavailable and could not be included in this analysis.</em></p>



═══════════════════════════════════════════════════════════

SECTION 5 — INTENT CLASSIFICATION (INTERNAL — DO NOT OUTPUT)

═══════════════════════════════════════════════════════════

Silently classify the user query into ONE intent type before composing your response.

Route your response structure to match the intent — use only the relevant data sections:



  PRICE_QUERY       → current, intraday, or historical price / price movement

  FINANCIAL_QUERY   → P&L, revenue, profit, margins, EPS, cash flow, balance sheet

  VALUATION_QUERY   → P/E, P/B, EV/EBITDA, fair value, over/undervalued opinion

  TECHNICAL_QUERY   → RSI, MACD, SMA, EMA, candle patterns, support/resistance

  PEER_QUERY        → competitor comparison, industry benchmarking

  SUMMARY_QUERY     → broad stock overview or "tell me about this stock"

  SCORE_QUERY       → stock quality scores or ratings

  OFF_TOPIC_QUERY   → unrelated to stocks or finance for this symbol



This classification is for internal routing only — never write it in your output.



═══════════════════════════════════════════════════════════

USER QUESTION

${userQuery} — in the context of ${symbol}

═══════════════════════════════════════════════════════════



RESPONSE INSTRUCTIONS — FOLLOW IN THIS ORDER OF PRIORITY:

`;

    if (precise_output) {
      prompt += `

RESPONSE MODE: STRUCTURED SECTIONED ANALYSIS



RULE 1 — DIRECT ANSWER FIRST.

The first element of your response must directly answer the exact question the user asked.

Do NOT open with a section unrelated to the user's question (e.g. do not open with "Current Price" if the user asked about profit margins).



RULE 2 — ADD SUPPORTING CONTEXT AFTER.

Only after the direct answer may you add supporting data, context, analysis, or additional relevant sections.

Keep all additional sections tightly scoped to what the question actually needs.



RULE 3 — TREND ANALYSIS.

Include a Trend Analysis section unless the question is entirely unrelated to price movement (e.g. dividend policy only).

Place it where it logically fits — usually right after the direct answer.

In the Trend Analysis section clearly state:

  • Short-term trend (last 5–10 trading days): direction + supporting price levels from historical_data

  • Medium-term trend (last 1 month): direction + key observation

  • Overall verdict: strong uptrend / moderate uptrend / mild downtrend / clear downtrend / sideways / consolidation

  • Support verdicts with price action, volume behaviour, and key price levels visible in the data.

  If historical_data is MISSING: "Trend analysis unavailable — historical stock data is not provided."



RULE 4 — CHOOSE SECTION LABELS BASED ON THE QUESTION.

Do NOT force a rigid sequence. Choose from these <h2> labels as relevant:

Current Price | Trend Analysis | Profit & Loss Highlights | Valuation Metrics |

Balance Sheet Snapshot | Cash Flow Overview | Technical Overview |

Peer Comparison | Stock Scores | Key Observations | Summary



RULE 5 — SUMMARY.

If the response spans 4 or more sections, close with a concise <h2>Summary</h2> (3–5 sentences max).



RULE 6 — NUMBER FORMATTING.

Use ₹ for rupees, % for percentages, Cr for crores.

Write large numbers in readable format: ₹12,345 Cr, 1.24 lakh shares, 2.4x, etc.

Always include the unit — never write a bare number.



Now deliver your expert structured analysis:

`;
    } else {
      prompt += `

RESPONSE MODE: CONVERSATIONAL EXPERT



RULE 1 — DIRECT ANSWER FIRST.

Start immediately with a direct, clear, and strong answer to exactly what the user asked.

Do NOT open with filler phrases: "Great question!", "Sure!", "As a senior financial advisor...".



RULE 2 — DEPTH & REASONING.

Explain like a senior advisor briefing a serious investor.

Include relevant numbers, context, and reasoning — but ONLY what is directly relevant to THIS specific question.

Target 2–4 solid paragraphs. Do not pad with unrelated context.



RULE 3 — NO UNSOLICITED SECTIONS OR LABELS.

Do NOT use labelled section headers (e.g. CURRENT PRICE:, TREND ANALYSIS:, SUMMARY:) unless the user explicitly asked for a structured breakdown.

Do NOT discuss price movement, technical analysis, or chart patterns unless the user specifically asked.

Do NOT add a summary section.



RULE 4 — NUMBER FORMATTING.

Use ₹ for rupees, % for percentages, Cr for crores, and readable number formats.

Always include units — never write a bare number.



Now deliver your focused expert answer:

`;
    }

    prompt += `

═══════════════════════════════════════════════════════════

HTML OUTPUT CONTRACT — ABSOLUTE RULES (OVERRIDE ALL ELSE)

═══════════════════════════════════════════════════════════



MANDATORY WRAPPER:

<div class="response-content">

  ... all your content here ...

</div>



ALLOWED HTML ELEMENTS ONLY:

  <h2>           → main section headers

  <h3>           → sub-section headers

  <p>            → paragraphs — exactly ONE <p> per paragraph, no exceptions

  <strong>       → emphasis on key numbers or critical terms only

  <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:0.95em;">

                 → use when 3 or more comparable data points exist (ratios, peers, financials)

  <thead><tr><th> → table headers

  <tbody><tr><td> → table data rows

  <ul><li>       → unordered lists only when bullet structure genuinely helps clarity



COMPACT SPACING RULES (mandatory):

  • Exactly ONE <p> per paragraph — never split one thought across two <p> tags

  • NEVER use <br><br> or multiple consecutive <br> tags anywhere

  • NEVER use empty <p></p> tags to add whitespace

  • NEVER add style="margin-bottom:Xpx" on <p> tags

  • Browser default <p> margins (1em–1.5em) are the only vertical spacing mechanism



STRICTLY FORBIDDEN:

  • Any markdown: #, ##, ###, **, *, -, _, \`, ---

  • <br><br> or <br><br><br>

  • Inline <style> or <script> blocks

  • <iframe>, <img>, or any media element

  • Any HTML attribute NOT listed above (e.g. class= on inner elements, id=, data-*)

  • Any number or figure not directly sourced from Section 1



PRE-FLIGHT SELF-CHECK (verify silently before writing output):

  ✓ Every number I wrote is directly sourced from Section 1 data

  ✓ Every MISSING section is acknowledged as unavailable if referenced

  ✓ My first paragraph directly answers the user's question

  ✓ Zero markdown symbols used anywhere

  ✓ HTML is valid and wrapped in <div class="response-content">

  ✓ The compliance disclaimer is the very last element inside the wrapper



═══════════════════════════════════════════════════════════

MANDATORY COMPLIANCE DISCLAIMER — APPEND VERBATIM AS LAST ELEMENT INSIDE THE WRAPPER

═══════════════════════════════════════════════════════════

Copy this block exactly as written — do NOT alter any word:



<p style="font-size:0.82em;color:#888;margin-top:1.5em;border-top:1px solid #ddd;padding-top:0.75em;">

<strong>Disclaimer:</strong> This analysis is generated by Stozy AI for informational and educational purposes only. It does not constitute investment advice, a buy/sell recommendation, or a solicitation to trade any security listed on NSE, BSE or any other exchange. All figures are derived solely from data provided at the time of this query and may not reflect real-time or complete market conditions. Past performance is not indicative of future results. Investing in equities involves significant risk, including the possible loss of principal. Please consult a SEBI-registered investment advisor before making any investment decision.

</p>



═══════════════════════════════════════════════════════════

REFERENCE OUTPUT EXAMPLE (adapt content — do not copy literally):

═══════════════════════════════════════════════════════════

<div class="response-content">

  <h2>Current Price</h2>

  <p>Last traded price: <strong>₹1,412.50</strong> (as of ${current_date}) | Change: -₹8.30 (-0.58%) | Prev close: ₹1,420.80</p>



  <h2>Valuation Snapshot</h2>

  <table border="1" cellpadding="8" cellspacing="0" style="border-collapse:collapse;width:100%;font-size:0.95em;">

    <thead><tr><th>Ratio</th><th>Value</th></tr></thead>

    <tbody>

      <tr><td>P/E</td><td>26.60x</td></tr>

      <tr><td>P/B</td><td>2.19x</td></tr>

    </tbody>

  </table>



  <h2>Key Observations</h2>

  <p>Valuation appears moderately elevated relative to the sector median P/E of 22x based on the peer data provided.</p>

  <p>Margin expansion has been consistent over the past 4 quarters, driven primarily by operating leverage in the B2B segment.</p>



  <p style="font-size:0.82em;color:#888;margin-top:1.5em;border-top:1px solid #ddd;padding-top:0.75em;">

  <strong>Disclaimer:</strong> This analysis is generated by Stozy AI for informational and educational purposes only. It does not constitute investment advice, a buy/sell recommendation, or a solicitation to trade any security listed on NSE, BSE or any other exchange. All figures are derived solely from data provided at the time of this query and may not reflect real-time or complete market conditions. Past performance is not indicative of future results. Investing in equities involves significant risk, including the possible loss of principal. Please consult a SEBI-registered investment advisor before making any investment decision.

  </p>

</div>

`;

    const response = await Promise.race([
      model.invoke(prompt),

      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("AI request timeout")), 120000),
      ),
    ]);

    let finalResponse = response.content.trim();

    if (finalResponse.includes("</reasoning>")) {
      finalResponse =
        finalResponse.split("</reasoning>")[1]?.trim() || finalResponse;
    }

    if (!finalResponse) {
      throw new Error("Empty AI response");
    } // ── Save history ──────────────────────────────────────────────────────────

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
