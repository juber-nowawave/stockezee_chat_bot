import dotenv from "dotenv";
import { getModelInstance } from "../utils/ai_models.js";
import { Json } from "sequelize/lib/utils";
dotenv.config();

const gemini_keys = [
  "AIzaSyA-YKPJUaPlC5LPofHKPF_LJdK18v-GWT8",
  "AIzaSyCA1XUqpt1cvjEOfy2IJQIIwzAEmePw5gM",
  "AIzaSyAc5AWjumFjj4ihjZMPbCkaa-y-Ae9maG0",
  "AIzaSyDOf_cDWy8y3M8dyeEHW00YaTtnqh_H3Zc",
  "AIzaSyCJQH7qEiRjSBQtwEYeePb0ClhMUIxqOEI",
  "AIzaSyC6zFQbgaEg2_rTo1CJ372kA0SRX9xg_q8",
  "AIzaSyAXYMvZ8lgomxNXOwCwKO8XZaWWHKeIHlM",
  "AIzaSyAbCa3uw9asML_V0s6NODpb-XZLVYE6stc",
  "AIzaSyCA-JW3-aQJpXv3UuWtHIVB_oPueUozB5Y",
  "AIzaSyCUUHc36Tm-EYp08hee-L9rM0kIczgkAi0",
  "AIzaSyBYOJhdLKcggWUor6e04nDYKfqB6ETM8Vw",
  "AIzaSyBzbZ4sgepOE90moLAobd0fVOtnNewv8dc",
  "AIzaSyAskzMHVhgVtBru8W34bZ1zYEfHQk2dMtc",
];

export const company_strength_analysis_ai = async (data, symbol) => {
  try {
    const gemini_api_key = process.env.MAIN_GEMINI_KEY;
    const model = getModelInstance(gemini_api_key);
    const prompt = `
You are an expert financial analyst and data assistant specializing in equity research. Your task is to perform a comprehensive SWOT analysis based on the provided structured company data, including ratio analysis, historical stock performance, profit/loss statements, cash flow, balance sheet, and company bio. Generate a natural, engaging yet professional summary tailored for investors seeking actionable insights.

Enhanced Guidelines:
1. Tone: Professional, concise, and investor-friendly—use clear language, avoid jargon overload, and infuse subtle optimism or caution where data supports it.
2. "STRENGTHS": Focus on internal positives like strong financial ratios (e.g., low P/E, high ROE/ROCE), consistent revenue/profit growth from historical data, healthy balance sheet (low debt-to-equity, positive cash flows), stable promoter holdings, and competitive positioning from bio/industry context.
3. "WEAKNESSES": Highlight internal risks such as declining metrics (e.g., negative quarterly profit variance, high volatility from stock data), elevated debt levels, poor cash flow trends, low dividend yields, or governance issues like fluctuating shareholdings.
4. "OPPORTUNITIES": Emphasize external growth drivers like sector trends (e.g., infrastructure boom for minerals), market expansion (emerging regions), regulatory tailwinds, product innovation from bio, or improving economic indicators that could boost demand/revenue.
5. "THREATS": Identify external challenges including competitive pressures, raw material volatility, regulatory hurdles (e.g., environmental for mining), economic slowdowns impacting sales, or global events affecting trade.
6. Data Integration: Draw from all sections—e.g., use 5Y CAGR for growth trends, quarterly variances for recency, cash flow for liquidity health, balance sheet for leverage, and 5-day/52W stock data for momentum. Cite specific numbers (e.g., ROE 16.30%, sales growth 7.20%) and trends (e.g., EPS CAGR 20.93% over 5Y).
7. Validity: Only include points that are strongly supported by data. If no valid, data-backed points for a section, use an empty array []—do not force invalid or weak points.
8. Limit: Each section can contain 0 to 5 points (not mandatory to have 5; can be 1, 2, 3, or 4 based on data strength). Prioritize the most impactful, unique ones.
9. Avoid overlap: Ensure points are unique across sections.
10. Length: Each point must be approximately 10 words (8-12 range). Count words precisely—aim for punchy, insightful phrases without fluff.
11. Output: Strictly JSON schema only—no intro, no explanations. Ensure valid JSON.

Schema:
{
  "STRENGTHS": [
    "Point 1 (approx. 10 words)",
    "Point 2 (approx. 10 words)",
    ...
  ],
  "WEAKNESSES": [
    "Point 1 (approx. 10 words)",
    ...
  ],
  "OPPORTUNITIES": [
    "Point 1 (approx. 10 words)",
    ...
  ],
  "THREATS": [
    "Point 1 (approx. 10 words)",
    ...
  ]
}

Always include all keys, even with empty arrays. Analyze deeply for ${symbol}.

DATA:
${JSON.stringify(data, null, 2)}

TASK: Deliver a precise SWOT JSON based on the full dataset.
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

    let finalResponse = JSON.parse(cleanedResponse);

    if (finalResponse) {
      return finalResponse;
    } else {
      finalResponse = `I couldn't find any strengths and weaknesses for ${symbol}`;
      return finalResponse;
    }
  } catch (error) {
    let errorMsg =
      "I'm having trouble processing your request right now. Please try again.";

    if (error.message.includes("timeout")) {
      errorMsg =
        "The request is taking longer than expected. Please try with a simpler query.";
    }
    return errorMsg;
  }
};
