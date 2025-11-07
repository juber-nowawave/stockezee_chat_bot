import { verify_token } from "../services/jwt-auth.js";
import db from "../models/index.js";

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
  "profit_after_tax",
  "mar_cap",
  "sales_qtr",
  "pat_qtr",
  "qtr_sales_var_per",
  "price_to_earning",
  "qtr_profit_var_per",
  "price_to_book_value",
  "debt",
  "eps",
  "return_on_equity_per",
  "debt_to_equity",
  "return_on_assets_per",
  "promoter_holding_per",
  "sales",
  "expenses",
  "profit_bf_tax",
  "net_profit",
  "promoters_per",
  "fii_per",
  "dii_per",
  "government_per",
  "public_per",
];

const VALID_OPERATORS = [">", "<", "=", ">=", "<=", "!="];

const get_all_stocks = async () => {
  let sql = `
    SELECT 
      ncd.symbol_name, 
      ncd.market_cap, 
      ncd.current_price, 
      ncd.high, 
      ncd.low, 
      ncd.stock_p_e, 
      ncd.book_value, 
      ncd.dividend_yield_per, 
      ncd.roce_per, 
      ncd.roe_per, 
      ncd.face_value, 
      ncd.opm_per, 
      ncd.profit_after_tax, 
      ncd.mar_cap, 
      ncd.sales_qtr, 
      ncd.pat_qtr, 
      ncd.qtr_sales_var_per, 
      ncd.price_to_earning, 
      ncd.qtr_profit_var_per, 
      ncd.price_to_book_value, 
      ncd.debt, 
      ncd.eps, 
      ncd.return_on_equity_per, 
      ncd.debt_to_equity, 
      ncd.return_on_assets_per, 
      ncd.promoter_holding_per,
      ncf.period as financial_period, 
      ncf.sales, 
      ncf.expenses, 
      ncf.profit_bf_tax, 
      ncf.net_profit,
      ncs.period as shareholding_period, 
      ncs.promoters_per, 
      ncs.fii_per, 
      ncs.dii_per, 
      ncs.government_per, 
      ncs.public_per    
    FROM nse_company_details ncd 
    INNER JOIN (
       SELECT DISTINCT ON (symbol_name) *
       FROM nse_company_financials
       ORDER BY symbol_name, period DESC
    ) ncf USING(symbol_name)
    INNER JOIN (
      SELECT DISTINCT ON (symbol_name) * 
      FROM nse_company_shareholding
      ORDER BY symbol_name, period DESC
    ) ncs USING(symbol_name)
  `;

  const all_stocks = await db.sequelize.query(sql, {
    type: db.Sequelize.QueryTypes.SELECT,
  });

  return all_stocks;
};

const parse_filter = (query) => {
  if (typeof query !== "string" || query.trim() === "") {
    throw new Error("Invalid query: Must be a non-empty string");
  }

  const lowerQuery = query.toLowerCase();

  const parts = [];
  const logicalOps = [];

  let currentPos = 0;
  const andOrRegex = /\s+(and|or)\s+/gi;
  let match;

  while ((match = andOrRegex.exec(lowerQuery)) !== null) {
    parts.push(query.substring(currentPos, match.index).trim());
    logicalOps.push(match[1].toUpperCase());
    currentPos = match.index + match[0].length;
  }

  parts.push(query.substring(currentPos).trim());

  const clauses = parts.filter(Boolean);

  if (clauses.length === 0) {
    throw new Error("No valid conditions found");
  }

  const parseSide = (str) => {
    const trimmed = str.trim();
    if (!trimmed) {
      throw new Error("Empty expression");
    }

    // Try binary: field arith value (where value is number or number% or field)
    const binaryMatch = trimmed.match(/^([a-z_]+)\s*([+*/-])\s*(\S+)$/i);
    if (binaryMatch) {
      const [, rawF, aop, rawVal] = binaryMatch;
      const field = rawF.trim().toLowerCase();
      if (!VALID_FIELDS.includes(field)) {
        throw new Error(`Invalid field "${rawF}" in expression: "${trimmed}"`);
      }
      const cleanValStr = rawVal.replace(/%$/, "").trim();

      let right;
      if (VALID_FIELDS.includes(cleanValStr)) {
        right = { type: "field", name: cleanValStr };
      } else {
        const value = parseFloat(cleanValStr);
        if (isNaN(value)) {
          throw new Error(
            `Invalid numeric value "${rawVal}" in expression: "${trimmed}"`
          );
        }
        right = { type: "number", value };
      }

      return {
        type: "binary",
        left: { type: "field", name: field },
        operator: aop,
        right,
      };
    }

    // Try number (with optional %)
    const clean = trimmed.replace(/%$/, "").trim();
    const value = parseFloat(clean);
    if (!isNaN(value)) {
      return { type: "number", value };
    }

    // Try field
    if (/^[a-z_]+$/i.test(trimmed)) {
      const field = trimmed.toLowerCase().trim();
      if (VALID_FIELDS.includes(field)) {
        return { type: "field", name: field };
      } else {
        throw new Error(`Invalid field "${trimmed}"`);
      }
    }

    // Invalid
    throw new Error(
      `Invalid expression "${trimmed}". Expected: field (e.g. high), number (e.g. 50 or 50%), or field +|-|*|/ number/field (e.g. high + 20 or high + low)`
    );
  };

  const conditions = [];
  for (let i = 0; i < clauses.length; i++) {
    const lowerClause = clauses[i].toLowerCase();
    const clauseMatch = lowerClause.match(/^(.+?)\s*(>=|<=|!=|>|<|=)\s*(.+)$/i);

    if (!clauseMatch) {
      throw new Error(
        `Invalid clause format: "${clauses[i]}". Expected: left operator right, where left/right are field, number, or field +|-|*|/ number/field (e.g., market_cap > 500 or high > low or high + 20 > low)`
      );
    }

    const [, lowerLeft, operator, lowerRight] = clauseMatch;

    if (!VALID_OPERATORS.includes(operator)) {
      throw new Error(
        `Invalid operator "${operator}" in clause: "${
          clauses[i]
        }". Allowed operators: ${VALID_OPERATORS.join(", ")}`
      );
    }

    let left, right;
    try {
      left = parseSide(lowerLeft);
      right = parseSide(lowerRight);
    } catch (e) {
      throw new Error(`In clause "${clauses[i]}": ${e.message}`);
    }

    const logicalOperator = i === 0 ? null : logicalOps[i - 1];

    conditions.push({
      left,
      operator,
      right,
      logicalOperator,
    });
  }

  return conditions;
};

const evaluate_expression = (stock, expr) => {
  switch (expr.type) {
    case "field": {
      const val = parseFloat(stock[expr.name]);
      return isNaN(val) ? NaN : val;
    }
    case "number":
      return expr.value;
    case "binary": {
      const leftVal = evaluate_expression(stock, expr.left);
      const rightVal = evaluate_expression(stock, expr.right);
      if (isNaN(leftVal) || isNaN(rightVal)) {
        return NaN;
      }
      switch (expr.operator) {
        case "+":
          return leftVal + rightVal;
        case "-":
          return leftVal - rightVal;
        case "*":
          return leftVal * rightVal;
        case "/":
          return rightVal === 0 ? NaN : leftVal / rightVal;
        default:
          return NaN;
      }
    }
    default:
      return NaN;
  }
};

const evaluate_condition = (stock, condition) => {
  const leftValue = evaluate_expression(stock, condition.left);
  const rightValue = evaluate_expression(stock, condition.right);

  if (isNaN(leftValue) || isNaN(rightValue)) {
    return false;
  }

  switch (condition.operator) {
    case ">":
      return leftValue > rightValue;
    case "<":
      return leftValue < rightValue;
    case "=":
      return Math.abs(leftValue - rightValue) < 0.0001;
    case ">=":
      return leftValue >= rightValue;
    case "<=":
      return leftValue <= rightValue;
    case "!=":
      return Math.abs(leftValue - rightValue) >= 0.0001;
    default:
      return false;
  }
};

const apply_filters = (stocks, conditions) => {
  return stocks.filter((stock) => {
    let result = evaluate_condition(stock, conditions[0]);

    for (let i = 1; i < conditions.length; i++) {
      const condition = conditions[i];
      const conditionResult = evaluate_condition(stock, condition);

      if (condition.logicalOperator === "AND") {
        result = result && conditionResult;
      } else if (condition.logicalOperator === "OR") {
        result = result || conditionResult;
      }
    }

    return result;
  });
};

export const query_resolve = async (req, res) => {
  try {
    const { user_query } = req.query;

    if (!user_query || user_query.trim() === "") {
      return res.status(400).json({
        status: 0,
        message:
          "Please provide a query parameter. Example: market_cap > 500 AND current_price < 15 OR high > low",
        data: null,
      });
    }

    const all_stocks = await get_all_stocks();
    const conditions = parse_filter(user_query);

    const filtered_stocks = apply_filters(all_stocks, conditions);

    return res.status(200).json({
      status: 1,
      message: "Query executed successfully",
      data: {
        msg: filtered_stocks.length
          ? `Total ${filtered_stocks.length} records found!`
          : `No records found!`,
        filtered_count: filtered_stocks.length,
        stocks: filtered_stocks,
      },
    });
  } catch (error) {
    console.error("Query resolution error:", error);
    if (
      error.message.includes("Invalid") ||
      error.message.includes("Allowed") ||
      error.message.includes("Expected")
    ) {
      return res.status(400).json({
        status: 0,
        message: error.message,
        data: null,
      });
    }
    return res.status(500).json({
      status: 0,
      message: "Internal server error. Please try again later.",
      data: null,
    });
  }
};

export const get_all_filter_fields = async (req, res) => {
  try {
    // const auth_header = req.headers["authorization"];
    // if (!auth_header || !auth_header.startsWith("Bearer ")) {
    //   return res.status(401).json({
    //     status: 0,
    //     message: "Authorization token missing or malformed",
    //     data: null,
    //   });
    // }

    // const token = auth_header.split(" ")[1];
    // const is_verified = await verify_token(token);
    // const is_prime = req.headers["is-prime"];
    // console.log('--',is_prime);

    // if (!is_verified) {
    //   return res.status(400).json({
    //     status: 0,
    //     message: "Invalid token!",
    //     data: null,
    //   });
    // }
    // if (!is_prime || is_prime.trim() == "false") {
    //   return res.status(400).json({
    //     status: 0,
    //     message: "Invalid user!",
    //     data: null,
    //   });
    // }

    const tables = {
      nse_company_details: "Ratios",
      nse_company_financials: "Quarterly P&L",
      nse_company_shareholding: "Shareholding",
    };

    const fields = await db.sequelize.query(
      `
      SELECT
       c.table_name,
       c.column_name
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name IN (${Object.keys(tables).map((tab) => `'${tab}'`)})
      ORDER BY c.table_name ASC, c.ordinal_position ASC;
     `,
      {
        type: db.Sequelize.QueryTypes.SELECT,
      }
    );

    let data = new Map();
    for (let col of fields) {
      if (
        [
          "company_name",
          "symbol_name",
          "parent_symbol_name",
          "period",
          "url",
          "bse_code",
          "nse_code",
          "created_at",
          "time",
          "weakness",
          "strengths",
          "long_term_recommend",
          "long_term_recommend_summary",
          "long_term_recommend_score",
          "opportunities",
          "threats",
        ].includes(col.column_name)
      ) {
        continue;
      }

      if (!data.has(tables[col.table_name])) {
        data.set(tables[col.table_name], {
          table_name: col.table_name,
          columns: [col.column_name],
        });
      } else {
        data.get(tables[col.table_name]).columns.push(col.column_name);
      }
    }
    data = Object.fromEntries(data);
    return res.status(200).json({
      status: 1,
      message: "success",
      data,
    });
  } catch (error) {
    console.error("Query error:", error);
    return res.status(500).json({
      status: 0,
      message: "Something went wrong",
      data: null,
    });
  }
};
export const get_all_fields = async (req, res) => {
  try {
    // const auth_header = req.headers["authorization"];
    // if (!auth_header || !auth_header.startsWith("Bearer ")) {
    //   return res.status(401).json({
    //     status: 0,
    //     message: "Authorization token missing or malformed",
    //     data: null,
    //   });
    // }

    // const token = auth_header.split(" ")[1];
    // const is_verified = await verify_token(token);
    // const is_prime = req.headers["is-prime"];
    // console.log('--',is_prime);

    // if (!is_verified) {
    //   return res.status(400).json({
    //     status: 0,
    //     message: "Invalid token!",
    //     data: null,
    //   });
    // }
    // if (!is_prime || is_prime.trim() == "false") {
    //   return res.status(400).json({
    //     status: 0,
    //     message: "Invalid user!",
    //     data: null,
    //   });
    // }

    const tables = {
      nse_stock_screener: "Stock Screener",
    };

    const fields = await db.sequelize.query(
      `
      SELECT
       c.table_name,
       c.column_name
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name IN (${Object.keys(tables).map((tab) => `'${tab}'`)})
      ORDER BY c.table_name ASC, c.ordinal_position ASC;
     `,
      {
        type: db.Sequelize.QueryTypes.SELECT,
      }
    );

    const columns_info = {
      "10_day_average_trading_volume": {
        label: "10 Day Average Trading Volume",
        unit: "shares",
        description:
          "The average number of shares traded daily over the past 10 trading days.",
        type: "number",
      },
      "13_week_price_return_daily": {
        label: "13 Week Price Return Daily",
        unit: "%",
        description:
          "The daily price return of the stock over the last 13 weeks, expressed as a percentage.",
        type: "percentage",
      },
      "26_week_price_return_daily": {
        label: "26 Week Price Return Daily",
        unit: "%",
        description:
          "The daily price return of the stock over the last 26 weeks, expressed as a percentage.",
        type: "percentage",
      },
      "3_month_adre_turn_std": {
        label: "3 Month ADRE Turn Standard Deviation",
        unit: "%",
        description:
          "The standard deviation of the 3-month average daily range expansion turnover.",
        type: "percentage",
      },
      "3_month_average_trading_volume": {
        label: "3 Month Average Trading Volume",
        unit: "shares",
        description:
          "The average number of shares traded daily over the past 3 months.",
        type: "number",
      },
      "52_week_high": {
        label: "52 Week High",
        unit: "₹",
        description:
          "The highest price the stock has reached in the last 52 weeks.",
        type: "currency",
      },
      "52_week_low": {
        label: "52 Week Low",
        unit: "₹",
        description:
          "The lowest price the stock has reached in the last 52 weeks.",
        type: "currency",
      },
      "52_week_price_return_daily": {
        label: "52 Week Price Return Daily",
        unit: "%",
        description:
          "The daily price return of the stock over the last 52 weeks, expressed as a percentage.",
        type: "percentage",
      },
      "5_day_price_return_daily": {
        label: "5 Day Price Return Daily",
        unit: "%",
        description:
          "The daily price return of the stock over the last 5 days, expressed as a percentage.",
        type: "percentage",
      },
      beta: {
        label: "Beta",
        unit: "",
        description:
          "A measure of the stock's volatility relative to the market.",
        type: "number",
      },
      book_value_per_share_annual: {
        label: "Book Value Per Share Annual",
        unit: "₹",
        description:
          "The annual book value of the company's equity divided by the number of shares outstanding.",
        type: "currency",
      },
      book_value_per_share_quarterly: {
        label: "Book Value Per Share Quarterly",
        unit: "₹",
        description:
          "The quarterly book value of the company's equity divided by the number of shares outstanding.",
        type: "currency",
      },
      book_value_share_growth_5y: {
        label: "Book Value Share Growth 5 Year",
        unit: "%",
        description:
          "The 5-year compound annual growth rate of book value per share.",
        type: "percentage",
      },
      capex_cagr_5y: {
        label: "Capital Expenditure CAGR 5 Year",
        unit: "%",
        description:
          "The 5-year compound annual growth rate of capital expenditures.",
        type: "percentage",
      },
      cash_flow_per_share_annual: {
        label: "Cash Flow Per Share Annual",
        unit: "₹",
        description:
          "The annual operating cash flow divided by the number of shares outstanding.",
        type: "currency",
      },
      cash_flow_per_share_quarterly: {
        label: "Cash Flow Per Share Quarterly",
        unit: "₹",
        description:
          "The quarterly operating cash flow divided by the number of shares outstanding.",
        type: "currency",
      },
      cash_per_share_per_share_annual: {
        label: "Cash Per Share Annual",
        unit: "₹",
        description:
          "The annual cash and equivalents divided by the number of shares outstanding.",
        type: "currency",
      },
      cash_per_share_per_share_quarterly: {
        label: "Cash Per Share Quarterly",
        unit: "₹",
        description:
          "The quarterly cash and equivalents divided by the number of shares outstanding.",
        type: "currency",
      },
      current_dividend_yield_ttm: {
        label: "Current Dividend Yield Trailing Twelve Months",
        unit: "%",
        description:
          "The trailing twelve months dividend per share divided by the current stock price, expressed as a percentage.",
        type: "percentage",
      },
      "current_ev/free_cash_flow_annual": {
        label: "Current Enterprise Value to Free Cash Flow Annual",
        unit: "x",
        description:
          "The enterprise value divided by the annual free cash flow.",
        type: "ratio",
      },
      "current_ev/free_cash_flow_ttm": {
        label:
          "Current Enterprise Value to Free Cash Flow Trailing Twelve Months",
        unit: "x",
        description:
          "The enterprise value divided by the trailing twelve months free cash flow.",
        type: "ratio",
      },
      dividend_growth_rate_5y: {
        label: "Dividend Growth Rate 5 Year",
        unit: "%",
        description:
          "The 5-year compound annual growth rate of dividends per share.",
        type: "percentage",
      },
      dividend_indicated_annual: {
        label: "Dividend Indicated Annual",
        unit: "₹",
        description:
          "The annualized dividend based on the most recent dividend declaration.",
        type: "currency",
      },
      dividend_per_share_annual: {
        label: "Dividend Per Share Annual",
        unit: "₹",
        description:
          "The total dividends paid per share over the annual period.",
        type: "currency",
      },
      dividend_per_share_ttm: {
        label: "Dividend Per Share Trailing Twelve Months",
        unit: "₹",
        description:
          "The total dividends paid per share over the trailing twelve months.",
        type: "currency",
      },
      dividend_yield_indicated_annual: {
        label: "Dividend Yield Indicated Annual",
        unit: "%",
        description:
          "The indicated annual dividend divided by the current stock price, expressed as a percentage.",
        type: "percentage",
      },
      ebitd_per_share_annual: {
        label: "EBITD Per Share Annual",
        unit: "₹",
        description:
          "The annual earnings before interest, taxes, and depreciation divided by shares outstanding.",
        type: "currency",
      },
      ebitd_per_share_ttm: {
        label: "EBITD Per Share Trailing Twelve Months",
        unit: "₹",
        description:
          "The trailing twelve months earnings before interest, taxes, and depreciation divided by shares outstanding.",
        type: "currency",
      },
      ebitda_cagr_5y: {
        label: "EBITDA CAGR 5 Year",
        unit: "%",
        description: "The 5-year compound annual growth rate of EBITDA.",
        type: "percentage",
      },
      ebitda_interim_cagr_5y: {
        label: "EBITDA Interim CAGR 5 Year",
        unit: "%",
        description:
          "The 5-year compound annual growth rate of interim (quarterly) EBITDA.",
        type: "percentage",
      },
      enterprise_value: {
        label: "Enterprise Value",
        unit: "Cr",
        description:
          "The total value of the company, including equity and debt minus cash.",
        type: "currency",
      },
      eps_annual: {
        label: "Earnings Per Share Annual",
        unit: "₹",
        description:
          "The annual net income divided by the number of shares outstanding.",
        type: "currency",
      },
      eps_basic_excl_extra_items_annual: {
        label: "EPS Basic Excluding Extraordinary Items Annual",
        unit: "₹",
        description:
          "Annual basic earnings per share excluding extraordinary items.",
        type: "currency",
      },
      eps_basic_excl_extra_items_ttm: {
        label: "EPS Basic Excluding Extraordinary Items Trailing Twelve Months",
        unit: "₹",
        description:
          "Trailing twelve months basic earnings per share excluding extraordinary items.",
        type: "currency",
      },
      eps_excl_extra_items_annual: {
        label: "EPS Excluding Extraordinary Items Annual",
        unit: "₹",
        description:
          "Annual diluted earnings per share excluding extraordinary items.",
        type: "currency",
      },
      eps_excl_extra_items_ttm: {
        label: "EPS Excluding Extraordinary Items Trailing Twelve Months",
        unit: "₹",
        description:
          "Trailing twelve months diluted earnings per share excluding extraordinary items.",
        type: "currency",
      },
      eps_growth_3y: {
        label: "EPS Growth 3 Year",
        unit: "%",
        description:
          "The 3-year compound annual growth rate of earnings per share.",
        type: "percentage",
      },
      eps_growth_5y: {
        label: "EPS Growth 5 Year",
        unit: "%",
        description:
          "The 5-year compound annual growth rate of earnings per share.",
        type: "percentage",
      },
      eps_growth_quarterly_yoy: {
        label: "EPS Growth Quarterly Year Over Year",
        unit: "%",
        description:
          "The year-over-year growth in quarterly earnings per share.",
        type: "percentage",
      },
      eps_growth_ttm_yoy: {
        label: "EPS Growth Trailing Twelve Months Year Over Year",
        unit: "%",
        description:
          "The year-over-year growth in trailing twelve months earnings per share.",
        type: "percentage",
      },
      eps_incl_extra_items_annual: {
        label: "EPS Including Extraordinary Items Annual",
        unit: "₹",
        description:
          "Annual diluted earnings per share including extraordinary items.",
        type: "currency",
      },
      eps_incl_extra_items_ttm: {
        label: "EPS Including Extraordinary Items Trailing Twelve Months",
        unit: "₹",
        description:
          "Trailing twelve months diluted earnings per share including extraordinary items.",
        type: "currency",
      },
      eps_normalized_annual: {
        label: "EPS Normalized Annual",
        unit: "₹",
        description: "Annual normalized (adjusted) earnings per share.",
        type: "currency",
      },
      eps_ttm: {
        label: "Earnings Per Share Trailing Twelve Months",
        unit: "₹",
        description:
          "The trailing twelve months net income divided by the number of shares outstanding.",
        type: "currency",
      },
      ev_ebitda_ttm: {
        label: "Enterprise Value to EBITDA Trailing Twelve Months",
        unit: "x",
        description:
          "The enterprise value divided by the trailing twelve months EBITDA.",
        type: "ratio",
      },
      focf_cagr_5y: {
        label: "Free Operating Cash Flow CAGR 5 Year",
        unit: "%",
        description:
          "The 5-year compound annual growth rate of free operating cash flow.",
        type: "percentage",
      },
      forward_pe: {
        label: "Forward Price to Earnings",
        unit: "x",
        description:
          "The current stock price divided by the estimated future earnings per share.",
        type: "ratio",
      },
      "long_term_debt/equity_annual": {
        label: "Long Term Debt to Equity Annual",
        unit: "x",
        description:
          "The annual long-term debt divided by shareholders' equity.",
        type: "ratio",
      },
      "long_term_debt/equity_quarterly": {
        label: "Long Term Debt to Equity Quarterly",
        unit: "x",
        description:
          "The quarterly long-term debt divided by shareholders' equity.",
        type: "ratio",
      },
      market_capitalization: {
        label: "Market Capitalization",
        unit: "Cr",
        description:
          "The total market value of the company's outstanding shares.",
        type: "currency",
      },
      month_to_date_price_return_daily: {
        label: "Month to Date Price Return Daily",
        unit: "%",
        description:
          "The daily price return of the stock from the start of the current month, expressed as a percentage.",
        type: "percentage",
      },
      net_income_employee_annual: {
        label: "Net Income Per Employee Annual",
        unit: "₹ Cr",
        description:
          "The annual net income divided by the number of employees.",
        type: "currency",
      },
      net_income_employee_ttm: {
        label: "Net Income Per Employee Trailing Twelve Months",
        unit: "₹ Cr",
        description:
          "The trailing twelve months net income divided by the number of employees.",
        type: "currency",
      },
      net_margin_growth_5y: {
        label: "Net Margin Growth 5 Year",
        unit: "%",
        description: "The 5-year growth rate in net profit margin.",
        type: "percentage",
      },
      net_profit_margin_5y: {
        label: "Net Profit Margin 5 Year",
        unit: "%",
        description: "The average net profit margin over the past 5 years.",
        type: "percentage",
      },
      net_profit_margin_annual: {
        label: "Net Profit Margin Annual",
        unit: "%",
        description:
          "The annual net income divided by revenue, expressed as a percentage.",
        type: "percentage",
      },
      net_profit_margin_ttm: {
        label: "Net Profit Margin Trailing Twelve Months",
        unit: "%",
        description:
          "The trailing twelve months net income divided by revenue, expressed as a percentage.",
        type: "percentage",
      },
      operating_margin_5y: {
        label: "Operating Margin 5 Year",
        unit: "%",
        description: "The average operating margin over the past 5 years.",
        type: "percentage",
      },
      operating_margin_annual: {
        label: "Operating Margin Annual",
        unit: "%",
        description:
          "The annual operating income divided by revenue, expressed as a percentage.",
        type: "percentage",
      },
      operating_margin_ttm: {
        label: "Operating Margin Trailing Twelve Months",
        unit: "%",
        description:
          "The trailing twelve months operating income divided by revenue, expressed as a percentage.",
        type: "percentage",
      },
      payout_ratio_annual: {
        label: "Payout Ratio Annual",
        unit: "%",
        description:
          "The annual dividends per share divided by earnings per share, expressed as a percentage.",
        type: "percentage",
      },
      payout_ratio_ttm: {
        label: "Payout Ratio Trailing Twelve Months",
        unit: "%",
        description:
          "The trailing twelve months dividends per share divided by earnings per share, expressed as a percentage.",
        type: "percentage",
      },
      pb: {
        label: "Price to Book",
        unit: "x",
        description:
          "The current stock price divided by the book value per share.",
        type: "ratio",
      },
      pb_annual: {
        label: "Price to Book Annual",
        unit: "x",
        description:
          "The stock price divided by the annual book value per share.",
        type: "ratio",
      },
      pb_quarterly: {
        label: "Price to Book Quarterly",
        unit: "x",
        description:
          "The stock price divided by the quarterly book value per share.",
        type: "ratio",
      },
      pcf_share_annual: {
        label: "Price to Cash Flow Per Share Annual",
        unit: "x",
        description:
          "The stock price divided by the annual cash flow per share.",
        type: "ratio",
      },
      pcf_share_ttm: {
        label: "Price to Cash Flow Per Share Trailing Twelve Months",
        unit: "x",
        description:
          "The stock price divided by the trailing twelve months cash flow per share.",
        type: "ratio",
      },
      pe_annual: {
        label: "Price to Earnings Annual",
        unit: "x",
        description:
          "The stock price divided by the annual earnings per share.",
        type: "ratio",
      },
      pe_basic_excl_extra_ttm: {
        label: "PE Basic Excluding Extraordinary Trailing Twelve Months",
        unit: "x",
        description:
          "The stock price divided by trailing twelve months basic EPS excluding extraordinary items.",
        type: "ratio",
      },
      pe_excl_extra_annual: {
        label: "PE Excluding Extraordinary Annual",
        unit: "x",
        description:
          "The stock price divided by annual diluted EPS excluding extraordinary items.",
        type: "ratio",
      },
      pe_excl_extra_ttm: {
        label: "PE Excluding Extraordinary Trailing Twelve Months",
        unit: "x",
        description:
          "The stock price divided by trailing twelve months diluted EPS excluding extraordinary items.",
        type: "ratio",
      },
      pe_incl_extra_ttm: {
        label: "PE Including Extraordinary Trailing Twelve Months",
        unit: "x",
        description:
          "The stock price divided by trailing twelve months diluted EPS including extraordinary items.",
        type: "ratio",
      },
      pe_normalized_annual: {
        label: "PE Normalized Annual",
        unit: "x",
        description:
          "The stock price divided by the annual normalized earnings per share.",
        type: "ratio",
      },
      pe_ttm: {
        label: "Price to Earnings Trailing Twelve Months",
        unit: "x",
        description:
          "The stock price divided by the trailing twelve months earnings per share.",
        type: "ratio",
      },
      peg_ttm: {
        label: "PEG Ratio Trailing Twelve Months",
        unit: "x",
        description:
          "The trailing twelve months PE ratio divided by the expected earnings growth rate.",
        type: "ratio",
      },
      pfcf_share_annual: {
        label: "Price to Free Cash Flow Per Share Annual",
        unit: "x",
        description:
          "The stock price divided by the annual free cash flow per share.",
        type: "ratio",
      },
      pfcf_share_ttm: {
        label: "Price to Free Cash Flow Per Share Trailing Twelve Months",
        unit: "x",
        description:
          "The stock price divided by the trailing twelve months free cash flow per share.",
        type: "ratio",
      },
      pretax_margin_5y: {
        label: "Pretax Margin 5 Year",
        unit: "%",
        description: "The average pretax profit margin over the past 5 years.",
        type: "percentage",
      },
      pretax_margin_annual: {
        label: "Pretax Margin Annual",
        unit: "%",
        description:
          "The annual pretax income divided by revenue, expressed as a percentage.",
        type: "percentage",
      },
      pretax_margin_ttm: {
        label: "Pretax Margin Trailing Twelve Months",
        unit: "%",
        description:
          "The trailing twelve months pretax income divided by revenue, expressed as a percentage.",
        type: "percentage",
      },
      "price_relative_to_s&p500_13_week": {
        label: "Price Relative to S&P 500 13 Week",
        unit: "%",
        description:
          "The stock's price performance relative to the S&P 500 over the last 13 weeks.",
        type: "percentage",
      },
      "price_relative_to_s&p500_26_week": {
        label: "Price Relative to S&P 500 26 Week",
        unit: "%",
        description:
          "The stock's price performance relative to the S&P 500 over the last 26 weeks.",
        type: "percentage",
      },
      "price_relative_to_s&p500_4_week": {
        label: "Price Relative to S&P 500 4 Week",
        unit: "%",
        description:
          "The stock's price performance relative to the S&P 500 over the last 4 weeks.",
        type: "percentage",
      },
      "price_relative_to_s&p500_52_week": {
        label: "Price Relative to S&P 500 52 Week",
        unit: "%",
        description:
          "The stock's price performance relative to the S&P 500 over the last 52 weeks.",
        type: "percentage",
      },
      "price_relative_to_s&p500_ytd": {
        label: "Price Relative to S&P 500 Year to Date",
        unit: "%",
        description:
          "The stock's price performance relative to the S&P 500 from the start of the year.",
        type: "percentage",
      },
      ps_annual: {
        label: "Price to Sales Annual",
        unit: "x",
        description: "The stock price divided by the annual sales per share.",
        type: "ratio",
      },
      ps_ttm: {
        label: "Price to Sales Trailing Twelve Months",
        unit: "x",
        description:
          "The stock price divided by the trailing twelve months sales per share.",
        type: "ratio",
      },
      ptbv_annual: {
        label: "Price to Tangible Book Value Annual",
        unit: "x",
        description:
          "The stock price divided by the annual tangible book value per share.",
        type: "ratio",
      },
      ptbv_quarterly: {
        label: "Price to Tangible Book Value Quarterly",
        unit: "x",
        description:
          "The stock price divided by the quarterly tangible book value per share.",
        type: "ratio",
      },
      revenue_employee_annual: {
        label: "Revenue Per Employee Annual",
        unit: "₹ Cr",
        description: "The annual revenue divided by the number of employees.",
        type: "currency",
      },
      revenue_growth_3y: {
        label: "Revenue Growth 3 Year",
        unit: "%",
        description: "The 3-year compound annual growth rate of revenue.",
        type: "percentage",
      },
      revenue_growth_5y: {
        label: "Revenue Growth 5 Year",
        unit: "%",
        description: "The 5-year compound annual growth rate of revenue.",
        type: "percentage",
      },
      revenue_growth_quarterly_yoy: {
        label: "Revenue Growth Quarterly Year Over Year",
        unit: "%",
        description: "The year-over-year growth in quarterly revenue.",
        type: "percentage",
      },
      revenue_growth_ttm_yoy: {
        label: "Revenue Growth Trailing Twelve Months Year Over Year",
        unit: "%",
        description:
          "The year-over-year growth in trailing twelve months revenue.",
        type: "percentage",
      },
      revenue_per_share_annual: {
        label: "Revenue Per Share Annual",
        unit: "₹",
        description:
          "The annual revenue divided by the number of shares outstanding.",
        type: "currency",
      },
      revenue_per_share_ttm: {
        label: "Revenue Per Share Trailing Twelve Months",
        unit: "₹",
        description:
          "The trailing twelve months revenue divided by the number of shares outstanding.",
        type: "currency",
      },
      revenue_share_growth_5y: {
        label: "Revenue Share Growth 5 Year",
        unit: "%",
        description:
          "The 5-year compound annual growth rate of revenue per share.",
        type: "percentage",
      },
      roa_5y: {
        label: "Return on Assets 5 Year",
        unit: "%",
        description: "The average return on assets over the past 5 years.",
        type: "percentage",
      },
      roa_rfy: {
        label: "Return on Assets Recent Fiscal Year",
        unit: "%",
        description: "The return on assets for the most recent fiscal year.",
        type: "percentage",
      },
      roa_ttm: {
        label: "Return on Assets Trailing Twelve Months",
        unit: "%",
        description:
          "The trailing twelve months net income divided by total assets, expressed as a percentage.",
        type: "percentage",
      },
      roe_5y: {
        label: "Return on Equity 5 Year",
        unit: "%",
        description: "The average return on equity over the past 5 years.",
        type: "percentage",
      },
      roe_rfy: {
        label: "Return on Equity Recent Fiscal Year",
        unit: "%",
        description: "The return on equity for the most recent fiscal year.",
        type: "percentage",
      },
      roe_ttm: {
        label: "Return on Equity Trailing Twelve Months",
        unit: "%",
        description:
          "The trailing twelve months net income divided by shareholders' equity, expressed as a percentage.",
        type: "percentage",
      },
      roi_5y: {
        label: "Return on Investment 5 Year",
        unit: "%",
        description: "The average return on investment over the past 5 years.",
        type: "percentage",
      },
      roi_annual: {
        label: "Return on Investment Annual",
        unit: "%",
        description:
          "The annual net income divided by total investment, expressed as a percentage.",
        type: "percentage",
      },
      roi_ttm: {
        label: "Return on Investment Trailing Twelve Months",
        unit: "%",
        description:
          "The trailing twelve months net income divided by total investment, expressed as a percentage.",
        type: "percentage",
      },
      tangible_book_value_per_share_annual: {
        label: "Tangible Book Value Per Share Annual",
        unit: "₹",
        description:
          "The annual tangible book value divided by the number of shares outstanding.",
        type: "currency",
      },
      tangible_book_value_per_share_quarterly: {
        label: "Tangible Book Value Per Share Quarterly",
        unit: "₹",
        description:
          "The quarterly tangible book value divided by the number of shares outstanding.",
        type: "currency",
      },
      tbv_cagr_5y: {
        label: "Tangible Book Value CAGR 5 Year",
        unit: "%",
        description:
          "The 5-year compound annual growth rate of tangible book value.",
        type: "percentage",
      },
      "total_debt/total_equity_annual": {
        label: "Total Debt to Equity Annual",
        unit: "x",
        description: "The annual total debt divided by shareholders' equity.",
        type: "ratio",
      },
      "total_debt/total_equity_quarterly": {
        label: "Total Debt to Equity Quarterly",
        unit: "x",
        description:
          "The quarterly total debt divided by shareholders' equity.",
        type: "ratio",
      },
      year_to_date_price_return_daily: {
        label: "Year to Date Price Return Daily",
        unit: "%",
        description:
          "The daily price return of the stock from the start of the year, expressed as a percentage.",
        type: "percentage",
      },
    };

    let data = [];
    for (let { column_name } of fields) {
      if (
        [
          "symbol_name",
          "52_week_high_date",
          "52_week_low_date",
          "created_at",
          "time",
        ].includes(column_name)
      ) {
        continue;
      }

      if (columns_info[column_name]) {
        data.push({
          key: column_name,
          ...columns_info[column_name],
        });
      } else {
        data.push({
          key: column_name,
          label: "Not found!",
          unit: "Not found!",
          description: "Not found!",
          type: "Not found!",
        });
      }
    }
    return res.status(200).json({
      status: 1,
      message: "success",
      data,
    });
  } catch (error) {
    console.error("Query error:", error);
    return res.status(500).json({
      status: 0,
      message: "Something went wrong",
      data: null,
    });
  }
};
