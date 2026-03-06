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

export const stock_analysis_ai = async (req, res, retry = 3) => {
  let {
    userQuery,
    symbol,
    userid,
    precise_output,
    remaining_limit,
    max_limit,
  } = req.body;

  const current_date = moment().tz("Asia/Kolkata").format("YYYY-MM-DD");
  const current_time = moment().tz("Asia/Kolkata").format("HH:mm:ss");
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

    // ── Handle greetings ──────────────────────────────────────────────────────
    if (isGreetingQuery(userQuery)) {
      const greetPrompt = `
You are Stozy — a sharp, experienced financial AI assistant for Indian stock markets (NSE/BSE).
The user has greeted you. Respond warmly but professionally. Mention that you can help with
stock prices, financials, valuations, technical analysis, and company insights.
User said: "${userQuery}"
Keep your reply to 1–2 short, confident sentences. Do NOT mention SQL or databases.
`;
      const greetResponse = await model.invoke(greetPrompt);
      const greetMsg =
        greetResponse?.content?.trim() ||
        "Hello! I'm Stozy, your Indian stock market assistant. Ask me anything about prices, financials, valuations, or market trends.";

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

    // ── Handle invalid/gibberish queries ──────────────────────────────────────
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

    // ── Fetch all stock data in parallel ──────────────────────────────────────
    console.log(`[StockAnalysisAI] Fetching data for: ${symbol}`);
    const stockContext = await fetchStockData(symbol);

    // ── Build data availability manifest ──────────────────────────────────────
    const dataManifest = {
      intraday_price_data:  stockContext.intraday_price_data                    ? "PRESENT" : "MISSING",
      current_price_data:   stockContext.current_price_data                     ? "PRESENT" : "MISSING",
      company_bio:          stockContext.company_bio                             ? "PRESENT" : "MISSING",
      company_details:      stockContext.company_details                         ? "PRESENT" : "MISSING",
      historical_data:      stockContext.historical_data?.length > 0            ? "PRESENT" : "MISSING",
      profit_and_loss:      stockContext.profit_and_loss?.length > 0            ? "PRESENT" : "MISSING",
      balance_sheet:        stockContext.balance_sheet?.length > 0              ? "PRESENT" : "MISSING",
      cash_flow:            stockContext.cash_flow?.length > 0                  ? "PRESENT" : "MISSING",
      technical_indicators: stockContext.technical_indicators                   ? "PRESENT" : "MISSING",
      peers:                stockContext.peers?.length > 0                      ? "PRESENT" : "MISSING",
      stock_scores:         stockContext.stock_scores                            ? "PRESENT" : "MISSING",
      daily_candle_pattern: stockContext.daily_candle_pattern                   ? "PRESENT" : "MISSING",
      weekly_candle_pattern:stockContext.weekly_candle_pattern                  ? "PRESENT" : "MISSING",
    };

    const manifestLines = Object.entries(dataManifest)
      .map(([k, v]) => `  ${k.padEnd(26)}: ${v}`)
      .join("\n");

    // ── Build the AI prompt ───────────────────────────────────────────────────
    let prompt = `
You are Stozy — a senior financial analyst and investment advisor with 25+ years of experience
in Indian equity markets (NSE/BSE). You are the best-in-class AI for stock research.

Your communication style:
  • Authoritative, precise, and deeply analytical — like a CFA charterholder briefing a HNI client
  • You cite exact numbers from the data, draw sharp insights, and give a clear stance
  • You never hedge with empty phrases like "it depends" or "results may vary" without backing it up
  • You always provide a clear directional view where the data supports one
  • You are NOT a disclaimer machine — your analysis is the star; the disclaimer is a footnote

═══════════════════════════════════════════════════════════════════
IDENTITY & META QUESTION RULE — ABSOLUTE HIGHEST PRIORITY
═══════════════════════════════════════════════════════════════════
If the user asks: your name, who made you, what model you are, your age, your company,
your physical location, or any personal/off-topic question — reply ONLY with:
"I am Stozy, your financial AI assistant focused on Indian stock markets. Ask me about
any stock, price, trend, financials, ratios, valuation or market view."
Then stop. Do NOT elaborate further.

Today's date: ${current_date}

═══════════════════════════════════════════════════════════════════
SECTION 1 — LIVE STOCK DATA: ${symbol}
═══════════════════════════════════════════════════════════════════

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

═══════════════════════════════════════════════════════════════════
SECTION 2 — DATA AVAILABILITY MANIFEST
═══════════════════════════════════════════════════════════════════
Read this BEFORE writing your answer. NEVER reference a MISSING section.

${manifestLines}

═══════════════════════════════════════════════════════════════════
SECTION 3 — ANTI-HALLUCINATION RULES (ABSOLUTE — NO EXCEPTIONS)
═══════════════════════════════════════════════════════════════════
1. Every single number you write MUST be sourced from Section 1. No exceptions.
2. Do NOT interpolate, estimate, extrapolate, or invent any figure.
3. Do NOT reference external events, analyst targets, or forecasts not present in Section 1.
4. Do NOT perform speculative calculations unless every raw input is explicitly in the data.
5. MISSING section + user asked about it → state it's unavailable. Do NOT substitute.
6. SELF-CHECK: Before finalising, verify every number maps to a specific field in Section 1.

═══════════════════════════════════════════════════════════════════
SECTION 4 — MISSING DATA PROTOCOL
═══════════════════════════════════════════════════════════════════
• technical_indicators MISSING + user asks about technicals →
  "Technical indicator data is currently unavailable for ${symbol}."

• profit_and_loss AND balance_sheet AND cash_flow all MISSING + user asks financials →
  "Quarterly financial statements are not available for ${symbol} at this time."

• current_price_data AND intraday_price_data both MISSING + user asks price →
  "Live price data for ${symbol} is currently unavailable."

• Any other MISSING section relevant to the query → append inside wrapper:
  <p class="note"><em>Note: [Section Name] data was unavailable and could not be included.</em></p>

═══════════════════════════════════════════════════════════════════
SECTION 5 — INTENT CLASSIFICATION (INTERNAL — DO NOT OUTPUT)
═══════════════════════════════════════════════════════════════════
Silently classify into ONE type before responding:
  PRICE_QUERY       → price, movement, high/low, returns
  FINANCIAL_QUERY   → P&L, revenue, profit, margins, EPS, cash flow, balance sheet
  VALUATION_QUERY   → P/E, P/B, EV/EBITDA, fair value, over/undervalued
  TECHNICAL_QUERY   → RSI, MACD, SMA, EMA, candles, support/resistance
  PEER_QUERY        → competitor comparison, sector benchmarking
  SUMMARY_QUERY     → broad overview, "tell me about this stock"
  SCORE_QUERY       → stock quality scores or ratings
  OFF_TOPIC_QUERY   → unrelated to finance for this symbol

═══════════════════════════════════════════════════════════════════
USER QUESTION
${userQuery} — in the context of ${symbol}
═══════════════════════════════════════════════════════════════════

RESPONSE QUALITY STANDARD — TARGET: 9/10
Your response must demonstrate:
  ✦ Sharp, specific insight — not generic market commentary
  ✦ Exact figures cited with context (not just listed)
  ✦ A clear directional stance or conclusion where data supports it
  ✦ Analyst-grade depth: interpret the numbers, don't just report them
  ✦ Confident language: "The margin compression is significant" not "margins may have changed"
`;

    // ── Append mode-specific instructions ────────────────────────────────────
    if (precise_output) {
      prompt += `
═══════════════════════════════════════════════════════════════════
RESPONSE MODE: STRUCTURED SECTIONED ANALYSIS
═══════════════════════════════════════════════════════════════════

RULE 1 — DIRECT ANSWER FIRST.
The very first section must directly answer what the user asked.
Never open with an unrelated section (e.g. don't lead with "Current Price" if asked about profits).

RULE 2 — SUPPORTING CONTEXT AFTER.
After answering directly, add supporting data in logical sections.
Every section must add genuine insight — remove any section that only repeats data without interpretation.

RULE 3 — TREND ANALYSIS (include unless user asked purely non-price question).
  • Short-term (last 5–10 trading days): direction + exact price levels
  • Medium-term (last 1 month): direction + key observation
  • Verdict: strong uptrend / moderate uptrend / mild downtrend / clear downtrend / sideways
  • Support with price action, volume, and key levels from historical_data
  • If historical_data is MISSING: "Trend analysis unavailable — historical data not provided."

RULE 4 — SECTION LABELS (use <h2> only from this approved list):
  Current Price | Trend Analysis | Price Performance | Profit & Loss Highlights |
  Revenue & Margins | Valuation Metrics | Balance Sheet Snapshot | Cash Flow Overview |
  Technical Overview | Peer Comparison | Stock Scores | Key Observations | Analyst View | Summary

RULE 5 — CLOSE WITH SUMMARY if 4+ sections are present.
  <h2>Summary</h2> — 3 to 5 crisp, high-signal sentences. End with a clear directional stance.

RULE 6 — NUMBER FORMATTING.
  ₹ for rupees | % for percentages | Cr for crores
  Readable: ₹12,345 Cr | 1.24 lakh shares | 2.4x | 18.6% YoY growth
  Always include the unit — never a bare number.

Now write your structured expert analysis:
`;
    } else {
      prompt += `
═══════════════════════════════════════════════════════════════════
RESPONSE MODE: CONVERSATIONAL EXPERT ANALYSIS
═══════════════════════════════════════════════════════════════════

RULE 1 — DIRECT ANSWER FIRST.
Open with a strong, direct, specific answer to exactly what was asked.
No filler openers: "Great question!", "Certainly!", "As an AI..." — never.

RULE 2 — DEPTH & INTERPRETATION.
Write like a senior fund manager giving a client briefing — not a textbook definition.
  • Interpret numbers in context: is the P/E high or low vs peers? Is revenue growth accelerating or slowing?
  • Draw conclusions: "This suggests...", "What this tells us is...", "The risk here is..."
  • Target 3–5 dense, insightful paragraphs — quality over quantity.

RULE 3 — NO UNSOLICITED SECTIONS OR HEADERS.
Do NOT use <h2> or <h3> section headers unless the user asked for a structured breakdown.
Do NOT discuss price movement or technicals unless the user asked.
Do NOT add a summary paragraph unless it flows naturally.

RULE 4 — NUMBER FORMATTING.
  ₹ for rupees | % for percentages | Cr for crores
  Always include units — never a bare number.

Now write your expert answer:
`;
    }

    // ── HTML output contract ──────────────────────────────────────────────────
    prompt += `
═══════════════════════════════════════════════════════════════════
HTML OUTPUT CONTRACT — MANDATORY (OVERRIDES ALL OTHER RULES)
═══════════════════════════════════════════════════════════════════

Text color should be white.
MANDATORY WRAPPER — every response MUST start and end with this:
<div class="stozy-response">
  ... all content here ...
</div>

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
ALLOWED HTML ELEMENTS & USAGE
━━━━━━━━━━━━━━━━━━━━━━━━━━━━

<h2 style="font-size:1.2em;font-weight:700;margin:1.4em 0 0.5em 0;color:#f0f0f0;border-left:4px solid #2563eb;padding-left:10px;">
  → Section headers. Bold, left-accented. One per major section.

<h3 style="font-size:1.05em;font-weight:600;margin:1.1em 0 0.4em 0;color:#9af5bb;">
  → Sub-section headers. Slightly smaller than h2.

<p style="margin:0 0 1em 0;line-height:1.75;color:#FFFFFF;">
  → Body paragraphs. ONE <p> per distinct thought. Never split one idea across two <p> tags.
  → Use this for ALL body text — never use raw text outside a tag.

<strong>
  → Bold key numbers, company names, critical metrics, and directional verdicts.
  → Example: <strong>₹1,412 Cr</strong> revenue | <strong>Bullish</strong> bias

<table style="width:100%;border-collapse:collapse;margin:1em 0;font-size:0.93em;">
  <thead>
    <tr style="background:#9af5bb;color:#ffffff;">
      <th style="padding:10px 12px;text-align:left;">Label</th>
      <th style="padding:10px 12px;text-align:right;">Value</th>
    </tr>
  </thead>
  <tbody>
    <tr style="background:#f8fafc;">
      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;">Metric</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">Value</td>
    </tr>
    <tr>
      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;">Metric</td>
      <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">Value</td>
    </tr>
  </tbody>
</table>
  → Use tables for 3+ comparable data points: ratios, peers, quarterly results.
  → Alternate row bg: odd rows #f8fafc, even rows #ffffff.

<ul style="margin:0 0 1em 1.2em;padding:0;line-height:1.75;">
  <li style="margin-bottom:0.4em;">...</li>
</ul>
  → Use ONLY when bullet structure genuinely aids readability over prose.
  → Each <li> must be at least one complete sentence.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
SPACING & FORMATTING RULES
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ ONE <p> per paragraph — never split one thought across two <p> tags
✓ Use margin:0 0 1em 0 on every <p> for consistent spacing
✓ NEVER use <br><br> or multiple consecutive <br> anywhere
✓ NEVER use empty <p></p> tags as spacers
✓ NEVER add extra margin/padding beyond what is specified above
✓ Tables must have alternating row backgrounds for readability
✓ All numbers in tables must be right-aligned

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
STRICTLY FORBIDDEN
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✗ Any markdown: #, ##, ###, **, *, -, _, \`, ---
✗ <br><br> or triple <br> tags anywhere
✗ Inline <style> blocks or <script> tags
✗ <iframe>, <img>, or any media element
✗ Any HTML attribute not listed in the allowed elements above
✗ Any figure not directly sourced from Section 1 data
✗ Generic phrases: "In conclusion", "It is worth noting", "It goes without saying"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRE-FLIGHT SELF-CHECK (verify silently before writing)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✓ Every number maps to a specific field in Section 1
✓ Every MISSING section is acknowledged if referenced
✓ First element directly answers the user's question
✓ Zero markdown symbols used anywhere
✓ All <p> tags have style="margin:0 0 1em 0;line-height:1.75;color:#FFFFFF;"
✓ Tables use the exact style format specified above
✓ Wrapped in <div class="stozy-response">

═══════════════════════════════════════════════════════════════════
REFERENCE OUTPUT EXAMPLE — ADAPT CONTENT, DO NOT COPY LITERALLY
═══════════════════════════════════════════════════════════════════
<div class="stozy-response">

  <h2 style="font-size:1.2em;font-weight:700;margin:1.4em 0 0.5em 0;color:#f0f0f0;border-left:4px solid #2563eb;padding-left:10px;">Current Price</h2>
  <p style="margin:0 0 1em 0;line-height:1.75;color:#FFFFFF;">
    <strong>${symbol}</strong> last traded at <strong>₹1,412.50</strong> on ${current_date},
    down <strong>₹8.30 (−0.58%)</strong> from the previous close of <strong>₹1,420.80</strong>.
    Intraday range: ₹1,398.10 – ₹1,425.60 with volume of <strong>12.4 lakh shares</strong>.
  </p>

  <h2 style="font-size:1.2em;font-weight:700;margin:1.4em 0 0.5em 0;color:#f0f0f0;border-left:4px solid #2563eb;padding-left:10px;">Valuation Metrics</h2>
  <table style="width:100%;border-collapse:collapse;margin:1em 0;font-size:0.93em;">
    <thead>
      <tr style="background:#9af5bb;color:#ffffff;">
        <th style="padding:10px 12px;text-align:left;">Metric</th>
        <th style="padding:10px 12px;text-align:right;">Value</th>
        <th style="padding:10px 12px;text-align:right;">Sector Median</th>
      </tr>
    </thead>
    <tbody>
      <tr style="background:#f8fafc;">
        <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;">P/E Ratio</td>
        <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">26.6x</td>
        <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">22.0x</td>
      </tr>
      <tr>
        <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;">P/B Ratio</td>
        <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;text-align:right;font-weight:600;">2.19x</td>
        <td style="padding:9px 12px;border-bottom:1px solid #e2e8f0;text-align:right;">1.80x</td>
      </tr>
    </tbody>
  </table>

  <h2 style="font-size:1.2em;font-weight:700;margin:1.4em 0 0.5em 0;color:#f0f0f0;border-left:4px solid #2563eb;padding-left:10px;">Analyst View</h2>
  <p style="margin:0 0 1em 0;line-height:1.75;color:#FFFFFF;">
    At <strong>26.6x P/E</strong>, the stock trades at a <strong>21% premium</strong> to the sector median of 22x —
    justified only if the recent margin expansion of <strong>180 bps</strong> over the past 4 quarters sustains.
    The B2B segment's operating leverage appears to be the primary driver; any demand slowdown there poses
    a meaningful de-rating risk.
  </p>

  <h2 style="font-size:1.2em;font-weight:700;margin:1.4em 0 0.5em 0;color:#f0f0f0;border-left:4px solid #2563eb;padding-left:10px;">Summary</h2>
  <p style="margin:0 0 1em 0;line-height:1.75;color:#FFFFFF;">
    <strong>${symbol}</strong> is moderately overvalued relative to peers but supported by improving fundamentals.
    The stock is in a <strong>mild uptrend</strong> with ₹1,380 acting as the key support level.
    Watch for the next quarterly earnings to confirm whether margin improvement is structural or cyclical.
  </p>
</div>
`;

    const response = await Promise.race([
      model.invoke(prompt),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error("AI request timeout")), 120000)
      ),
    ]);
    
    let finalResponse = "";
    
    if (typeof response.content === "string") {
      finalResponse = response.content.trim();
    } else if (Array.isArray(response.content)) {
       finalResponse = response.content
       .filter(block => block.type === "text")
       .map(block => block.text)
       .join("")
       .trim();
      }
      // console.log('--------__>>>', finalResponse);
      
      if (!finalResponse) {
        console.log('-------------------stock_analysis_ai retrying-------------------', retry);
        if (retry > 0) {
          return stock_analysis_ai(req, res, retry - 1);
        }
        throw new Error("Empty AI response");
      }

    // Ensure response is wrapped correctly — fallback wrapper if model forgot
    if (!finalResponse.includes('class="stozy-response"')) {
      finalResponse = `<div class="stozy-response">${finalResponse}</div>`;
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
      data: { msg: finalResponse, max_limit, remaining_limit },
    });
  } catch (error) {
    console.error("[StockAnalysisAI] Error:", error);

    let errorMsg =
      "I'm having trouble processing your request right now. Please try again.";

    if (error.message?.includes("timeout")) {
      errorMsg =
        "The request is taking longer than expected. Please try with a more specific question.";
    }

    try {
      await db.chat_bot_history.create({
        user_id: userid,
        bot_type: "stock analysis",
        user_query: `${userQuery}, in the context of ${symbol}`,
        status: "failed",
        time: current_time,
        created_at: current_date,
      });
    } catch (_) {}

    return res.status(200).json({
      status: 0,
      message: "Processing error",
      data: { msg: errorMsg, max_limit, remaining_limit },
    });
  }
};