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
    const gemini_api_key =
      gemini_keys[Math.floor(Math.random() * gemini_keys.length)];
    const model = getModelInstance(gemini_api_key);

    const prompt = `
You are a financial data assistant. Based on the given structured company data, analyze it and generate a natural, conversational SWOT summary of the company.  

Guidelines for your response:
1. Keep the tone professional but easy to understand for an investor.
2. "Strengths" should highlight the company's strong financial metrics, growth, profitability, shareholding confidence, or industry positioning.
3. "Weaknesses" should highlight concerns such as high debt, declining profits, volatile stock prices, weak returns, or promoter/public shareholding risks.
4. "Opportunities" should highlight external factors or growth drivers like industry expansion, new markets, favorable regulations, demand trends, or product diversification.
5. "Threats" should highlight external risks like competition, regulatory issues, global slowdown, raw material dependency, or market volatility.
6. Use specific numbers and trends from the data (PE ratio, ROE, debt-to-equity, quarterly profits, promoter holdings, recent stock movements, etc.).
7. If no valid points exist for a section, return an empty array [] for that section.
8. Do not repeat the same point across sections.
9. Each point must strictly be between 180 and 225 characters long. Count characters, not words.

Use this schema:

{
  "STRENGTHS": [
    "Point 1",
    "Point 2",
    ...
  ],
  "WEAKNESSES": [
    "Point 1",
    "Point 2",
    ...
  ],
  "OPPORTUNITIES": [
    "Point 1",
    "Point 2",
    ...
  ],
  "THREATS": [
    "Point 1",
    "Point 2",
    ...
  ]
}

Ensure that all keys (STRENGTHS, WEAKNESSES, OPPORTUNITIES, THREATS) are always present, even if some of them contain an empty array.

DATA:
${JSON.stringify(data, null, 2)}
TASK: Analyze the company data and output JSON as per the schema above.
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
      finalResponse = `I couldn't find any crons and prons for ${symbol}`;
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
