import { ChatGoogleGenerativeAI } from "@langchain/google-genai";
import dotenv from "dotenv";

dotenv.config();

const VALID_FIELDS = [
  "market_cap",
  "current_price",
  "high",
  "low",
  "stock_p_e",
  "book_value",
  "dividend_yield_per",
  "roce_per",
  "roe_per",
  "face_value",
  "opm_per",
  "qtr_sales_var_per",
  "price_to_earning",
  "qtr_profit_var_per",
  "price_to_book_value",
  "return_on_equity_per",
  "debt_to_equity",
  "return_on_assets_per",
  "avg_trading_vol_10d",
  "price_ret_daily_13w",
  "price_ret_daily_26w",
  "adre_turn_std_3m",
  "avg_trading_vol_3m",
  "high_52w",
  "low_52w",
  "price_ret_daily_52w",
  "price_ret_daily_5d",
  "beta",
  "book_val_share_qtr",
  "book_val_growth_5y",
  "capex_cagr_5y",
  "cash_flow_share_ann",
  "cash_flow_share_qtr",
  "cash_share_ann",
  "cash_share_qtr",
  "div_growth_rate_5y",
  "div_indicated_ann",
  "div_share_ann",
  "div_share_ttm",
  "div_yield_ind_ann",
  "ebitd_share_ann",
  "ebitd_share_ttm",
  "ebitda_cagr_5y",
  "ebitda_int_cagr_5y",
  "ent_value",
  "eps_ann",
  "eps_basic_excl_ext_ann",
  "eps_basic_excl_ext_ttm",
  "eps_excl_ext_ann",
  "eps_excl_ext_ttm",
  "eps_growth_3y",
  "eps_growth_5y",
  "eps_growth_qtr_yoy",
  "eps_growth_ttm_yoy",
  "eps_incl_ext_ann",
  "eps_incl_ext_ttm",
  "eps_norm_ann",
  "ev_ebitda_ttm",
  "focf_cagr_5y",
  "fwd_pe",
  "long_debt_eq_ann",
  "long_debt_eq_qtr",
  "price_ret_daily_mtd",
  "net_inc_emp_ann",
  "net_inc_emp_ttm",
  "net_marg_growth_5y",
  "net_prof_marg_5y",
  "net_prof_marg_ann",
  "net_prof_marg_ttm",
  "op_marg_5y",
  "op_marg_ann",
  "op_marg_ttm",
  "payout_ratio_ann",
  "payout_ratio_ttm",
  "pb_ann",
  "pb_qtr",
  "pcf_share_ann",
  "pcf_share_ttm",
  "pe_ann",
  "pe_basic_excl_ext_ttm",
  "pe_excl_ext_ann",
  "pe_excl_ext_ttm",
  "pe_incl_ext_ttm",
  "pe_norm_ann",
  "peg_ttm",
  "pfcf_share_ann",
  "pfcf_share_ttm",
  "pretax_marg_5y",
  "pretax_marg_ann",
  "pretax_marg_ttm",
  "price_rel_sp500_13w",
  "price_rel_sp500_26w",
  "price_rel_sp500_4w",
  "price_rel_sp500_52w",
  "price_rel_sp500_ytd",
  "ps_ann",
  "ps_ttm",
  "ptbv_ann",
  "ptbv_qtr",
  "rev_emp_ann",
  "rev_growth_3y",
  "rev_growth_5y",
  "rev_growth_qtr_yoy",
  "rev_growth_ttm_yoy",
  "rev_share_ann",
  "rev_share_ttm",
  "rev_share_growth_5y",
  "roa_5y",
  "roa_rfy",
  "roe_5y",
  "roe_rfy",
  "roi_5y",
  "roi_ann",
  "roi_ttm",
  "tang_book_val_share_ann",
  "tang_book_val_share_qtr",
  "tbv_cagr_5y",
  "total_debt_eq_qtr",
  "price_ret_daily_ytd",
  "ev_fcf_ann",
  "ev_fcf_ttm",
];

const fieldMap = {
  market_cap: "Market Cap (market capitalization in Crores)",
  stock_p_e: "PE Ratio (price to earnings TTM)",
  book_value: "Book Value per Share (annual)",
  dividend_yield_per: "Dividend Yield % (TTM)",
  roe_per: "ROE % (return on equity TTM)",
  opm_per: "Operating Margin % (TTM)",
  price_to_earning: "Price to Earning Ratio (PE TTM)",
  price_to_book_value: "Price to Book Value Ratio",
  debt_to_equity: "Debt to Equity Ratio (annual)",
  return_on_assets_per: "ROA % (return on assets TTM)",
  current_price: "Current Stock Price",
  high: "High Price (current session)",
  low: "Low Price (current session)",
  face_value: "Face Value",
  roce_per: "ROCE % (return on capital employed)",
  qtr_sales_var_per: "Quarterly Sales Variation %",
  qtr_profit_var_per: "Quarterly Profit Variation %",
  avg_trading_vol_10d: "10 Day Average Trading Volume",
  avg_trading_vol_3m: "3 Month Average Trading Volume",
  high_52w: "52 Week High",
  low_52w: "52 Week Low",
  price_ret_daily_52w: "52 Week Price Return %",
  price_ret_daily_5d: "5 Day Price Return %",
  price_ret_daily_13w: "13 Week Price Return %",
  price_ret_daily_26w: "26 Week Price Return %",
  price_ret_daily_ytd: "Year to Date Price Return %",
  beta: "Beta (volatility measure)",
  eps_growth_3y: "EPS Growth 3 Year %",
  eps_growth_5y: "EPS Growth 5 Year %",
  eps_growth_qtr_yoy: "EPS Growth Quarterly YoY %",
  eps_growth_ttm_yoy: "EPS Growth TTM YoY %",
  rev_growth_3y: "Revenue Growth 3 Year %",
  rev_growth_5y: "Revenue Growth 5 Year %",
  rev_growth_qtr_yoy: "Revenue Growth Quarterly YoY %",
  rev_growth_ttm_yoy: "Revenue Growth TTM YoY %",
  net_prof_marg_ttm: "Net Profit Margin % (TTM)",
  net_prof_marg_ann: "Net Profit Margin % (annual)",
  net_prof_marg_5y: "Net Profit Margin % (5 year avg)",
  op_marg_ttm: "Operating Margin % (TTM)",
  op_marg_ann: "Operating Margin % (annual)",
  op_marg_5y: "Operating Margin % (5 year avg)",
  roe_5y: "ROE % (5 year avg)",
  roa_5y: "ROA % (5 year avg)",
  roi_ttm: "ROI % (TTM)",
  roi_ann: "ROI % (annual)",
  roi_5y: "ROI % (5 year avg)",
  peg_ttm: "PEG Ratio (TTM)",
  fwd_pe: "Forward PE Ratio",
  ev_ebitda_ttm: "EV to EBITDA (TTM)",
  ps_ttm: "Price to Sales (TTM)",
  ps_ann: "Price to Sales (annual)",
  pb_ann: "Price to Book (annual)",
  pb_qtr: "Price to Book (quarterly)",
  div_growth_rate_5y: "Dividend Growth Rate 5 Year %",
  payout_ratio_ttm: "Payout Ratio % (TTM)",
  payout_ratio_ann: "Payout Ratio % (annual)",
  cash_share_ann: "Cash per Share (annual)",
  cash_flow_share_ann: "Cash Flow per Share (annual)",
  book_val_growth_5y: "Book Value Growth 5 Year %",
  ebitda_cagr_5y: "EBITDA CAGR 5 Year %",
  capex_cagr_5y: "CapEx CAGR 5 Year %",
  focf_cagr_5y: "Free Operating Cash Flow CAGR 5 Year %",
  ent_value: "Enterprise Value",
  long_debt_eq_ann: "Long Term Debt to Equity (annual)",
  total_debt_eq_qtr: "Total Debt to Equity (quarterly)",
};

export const convert_natural_language_to_query = async (naturalQuery) => {
  try {
    const model = new ChatGoogleGenerativeAI({
      apiKey: process.env.MAIN_GEMINI_KEY,
      model: process.env.GOOGLE_MODEL || "gemini-2.0-flash-exp",
      temperature: 0.1,
    });

    const prompt = `You are a stock screener query converter. Convert natural language queries into structured query format.

AVAILABLE FIELDS (use ONLY these field names):
${VALID_FIELDS.map((field) => `- ${field}: ${fieldMap[field] || field}`).join(
  "\n"
)}

OPERATORS: >, <, =, >=, <=, !=
LOGICAL OPERATORS: AND, OR

RULES:
1. Use ONLY field names from the list above (lowercase with underscores)
2. Convert percentages to decimal numbers (e.g., "20%" becomes 20, not 0.20)
3. Convert "lakh" to actual numbers (1 lakh = 100, 1 crore = 10000 in market_cap context)
4. Convert "crore" to actual numbers for market_cap
5. Use proper operators (>, <, =, >=, <=, !=)
6. Combine multiple conditions with AND or OR
7. Return ONLY the query string, no explanations

EXAMPLES:
Input: "market cap greater than 700 lakh and high is 3000"
Output: market_cap > 7000 AND high > 3000

Input: "ROE above 20% and ROCE above 25% and debt to equity less than 0.5"
Output: roe_per > 20 AND roce_per > 25 AND debt_to_equity < 0.5

Input: "companies with PE less than 15 and dividend yield more than 3%"
Output: stock_p_e < 15 AND dividend_yield_per > 3

Input: "stocks with 52 week high above 1000 or current price below 500"
Output: high_52w > 1000 OR current_price < 500

Input: "EPS growth 5 year greater than 15% and net profit margin above 10%"
Output: eps_growth_5y > 15 AND net_prof_marg_ttm > 10

Now convert this query:
"${naturalQuery}"

Return ONLY the structured query string:`;

    const result = await model.invoke(prompt);
    const convertedQuery = result.content.trim();

    // Validate that the response contains valid field names
    const usedFields = convertedQuery.match(/[a-z_]+/g) || [];
    const invalidFields = usedFields.filter(
      (field) =>
        !VALID_FIELDS.includes(field) &&
        !["and", "or"].includes(field.toLowerCase()) &&
        isNaN(parseFloat(field))
    );

    if (invalidFields.length > 0) {
      console.warn(
        `AI generated query with potentially invalid fields: ${invalidFields.join(
          ", "
        )}`
      );
    }

    return {
      success: true,
      original_query: naturalQuery,
      converted_query: convertedQuery,
      message: "Query converted successfully",
    };
  } catch (error) {
    console.error("AI Query Conversion Error:", error);
    return {
      success: false,
      original_query: naturalQuery,
      converted_query: null,
      message: "Failed to convert natural language query",
      error: error.message,
    };
  }
};
