import { verify_token } from "../services/jwt-auth.js";
import db from "../models/index.js";
import prebuild_screens from "../data/custom_screener_screens_collections.json" with { type: "json" };

const VALID_FIELDS = [
  // Original fields (DECIMAL)
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
  // Merged fields (all DECIMAL)
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

const VALID_OPERATORS = [">", "<", "=", ">=", "<=", "!="];

const get_stocks_by_query = async (selectFields = null, whereClause = null) => {
  // let sql = `SELECT symbol_name, market_cap, current_price, high, low, stock_p_e, book_value, dividend_yield_per,
  //  roce_per, roe_per, face_value, opm_per, qtr_sales_var_per, price_to_earning, qtr_profit_var_per, price_to_book_value,
  //  return_on_equity_per, debt_to_equity, return_on_assets_per, avg_trading_vol_10d, price_ret_daily_13w, price_ret_daily_26w,
  //  adre_turn_std_3m, avg_trading_vol_3m, high_52w, low_52w, price_ret_daily_52w, price_ret_daily_5d, beta, book_val_share_qtr,
  //  book_val_growth_5y, capex_cagr_5y, cash_flow_share_ann, cash_flow_share_qtr, cash_share_ann, cash_share_qtr,
  //  div_growth_rate_5y, div_indicated_ann, div_share_ann, div_share_ttm, div_yield_ind_ann, ebitd_share_ann, ebitd_share_ttm,
  //  ebitda_cagr_5y, ebitda_int_cagr_5y, ent_value, eps_ann, eps_basic_excl_ext_ann, eps_basic_excl_ext_ttm, eps_excl_ext_ann,
  //  eps_excl_ext_ttm, eps_growth_3y, eps_growth_5y, eps_growth_qtr_yoy, eps_growth_ttm_yoy, eps_incl_ext_ann, eps_incl_ext_ttm,
  //  eps_norm_ann, ev_ebitda_ttm, focf_cagr_5y, fwd_pe, long_debt_eq_ann, long_debt_eq_qtr, price_ret_daily_mtd, net_inc_emp_ann,
  //  net_inc_emp_ttm, net_marg_growth_5y, net_prof_marg_5y, net_prof_marg_ann, net_prof_marg_ttm, op_marg_5y, op_marg_ann,
  //  op_marg_ttm, payout_ratio_ann, payout_ratio_ttm, pb_ann, pb_qtr, pcf_share_ann, pcf_share_ttm, pe_ann, pe_basic_excl_ext_ttm,
  //  pe_excl_ext_ann, pe_excl_ext_ttm, pe_incl_ext_ttm, pe_norm_ann, peg_ttm, pfcf_share_ann, pfcf_share_ttm, pretax_marg_5y,
  //  pretax_marg_ann, pretax_marg_ttm, price_rel_sp500_13w, price_rel_sp500_26w, price_rel_sp500_4w, price_rel_sp500_52w,
  //  price_rel_sp500_ytd, ps_ann, ps_ttm, ptbv_ann, ptbv_qtr, rev_emp_ann, rev_growth_3y, rev_growth_5y, rev_growth_qtr_yoy,
  //  rev_growth_ttm_yoy, rev_share_ann, rev_share_ttm, rev_share_growth_5y, roa_5y, roa_rfy, roe_5y, roe_rfy, roi_5y, roi_ann, roi_ttm,
  //  tang_book_val_share_ann, tang_book_val_share_qtr, tbv_cagr_5y, total_debt_eq_qtr, price_ret_daily_ytd, ev_fcf_ann, ev_fcf_ttm
  //  FROM nse_company_details`;

  let sql = `
    SELECT symbol_name, market_cap, current_price, high, low, stock_p_e, book_value, 
     dividend_yield_per, roce_per, roe_per, face_value, net_prof_marg_ann
    FROM nse_company_details
  `;

  if (whereClause) {
    sql += ` WHERE ${whereClause}`;
  }

  sql += ` ORDER BY symbol_name ASC`;

  const stocks = await db.sequelize.query(sql, {
    type: db.Sequelize.QueryTypes.SELECT,
  });

  return stocks;
};

const collect_used_fields = (conditions) => {
  const fields = new Set();
  conditions.forEach((condition) => {
    const collect = (expr) => {
      if (expr.type === "field") {
        fields.add(expr.name);
      } else if (expr.type === "binary") {
        collect(expr.left);
        collect(expr.right);
      }
    };
    collect(condition.left);
    collect(condition.right);
  });
  return Array.from(fields);
};

const generateSqlExpr = (expr) => {
  if (expr.type === "field") {
    return expr.name;
  }
  if (expr.type === "number") {
    return expr.value.toString();
  }
  if (expr.type === "binary") {
    const leftSql = generateSqlExpr(expr.left);
    const rightSql = generateSqlExpr(expr.right);
    return `(${leftSql} ${expr.operator} ${rightSql})`;
  }
  throw new Error(`Unsupported expression type: ${expr.type}`);
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
    const binaryMatch = trimmed.match(/^([a-z0-9_]+)\s*([+*/-])\s*(\S+)$/i);
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
    if (/^[a-z0-9_]+$/i.test(trimmed)) {
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

    const conditions = parse_filter(user_query);
    const usedFields = collect_used_fields(conditions);

    // Build SQL WHERE clause
    const conditionStrs = conditions.map((cond) => {
      const leftSql = generateSqlExpr(cond.left);
      const rightSql = generateSqlExpr(cond.right);
      return `(${leftSql} ${cond.operator} ${rightSql})`;
    });

    let whereClause = conditionStrs[0];
    for (let i = 1; i < conditionStrs.length; i++) {
      const logOp = conditions[i].logicalOperator === "AND" ? "AND" : "OR";
      whereClause += ` ${logOp} ${conditionStrs[i]}`;
    }

    // Safe division wrapper (add this before executing)
    whereClause = whereClause.replace(
      /(\w+)\s*\/\s*(\w+)/g,
      "(CASE WHEN $2 = 0 THEN NULL ELSE $1 / $2 END)"
    ); // Or use NULLIF in SQL: NULLIF($2, 0)

    const filtered_stocks = await get_stocks_by_query(usedFields, whereClause);

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
      return res.status(200).json({
        status: 1,
        message: "Data not found!",
        data: {},
      });
    }
    return res.status(500).json({
      status: 0,
      message: "Internal server error. Please try again later.",
      data: null,
    });
  }
};

export const get_all_fields = async (req, res) => {
  try {
    const tables = {
      nse_company_details: "Stock Details",
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

    // Map from short names to original long names for descriptions
    const fieldMap = {
      market_cap: "market_capitalization",
      stock_p_e: "pe_ttm",
      book_value: "book_value_per_share_annual",
      dividend_yield_per: "current_dividend_yield_ttm",
      roe_per: "roe_ttm",
      opm_per: "operating_margin_ttm",
      price_to_earning: "pe_ttm",
      price_to_book_value: "pb",
      debt_to_equity: "total_debt/total_equity_annual",
      return_on_assets_per: "roa_ttm",
      avg_trading_vol_10d: "10_day_average_trading_volume",
      price_ret_daily_13w: "13_week_price_return_daily",
      price_ret_daily_26w: "26_week_price_return_daily",
      adre_turn_std_3m: "3_month_adre_turn_std",
      avg_trading_vol_3m: "3_month_average_trading_volume",
      high_52w: "52_week_high",
      low_52w: "52_week_low",
      price_ret_daily_52w: "52_week_price_return_daily",
      price_ret_daily_5d: "5_day_price_return_daily",
      beta: "beta",
      book_val_share_qtr: "book_value_per_share_quarterly",
      book_val_growth_5y: "book_value_share_growth_5y",
      capex_cagr_5y: "capex_cagr_5y",
      cash_flow_share_ann: "cash_flow_per_share_annual",
      cash_flow_share_qtr: "cash_flow_per_share_quarterly",
      cash_share_ann: "cash_per_share_per_share_annual",
      cash_share_qtr: "cash_per_share_per_share_quarterly",
      div_growth_rate_5y: "dividend_growth_rate_5y",
      div_indicated_ann: "dividend_indicated_annual",
      div_share_ann: "dividend_per_share_annual",
      div_share_ttm: "dividend_per_share_ttm",
      div_yield_ind_ann: "dividend_yield_indicated_annual",
      ebitd_share_ann: "ebitd_per_share_annual",
      ebitd_share_ttm: "ebitd_per_share_ttm",
      ebitda_cagr_5y: "ebitda_cagr_5y",
      ebitda_int_cagr_5y: "ebitda_interim_cagr_5y",
      ent_value: "enterprise_value",
      eps_ann: "eps_annual",
      eps_basic_excl_ext_ann: "eps_basic_excl_extra_items_annual",
      eps_basic_excl_ext_ttm: "eps_basic_excl_extra_items_ttm",
      eps_excl_ext_ann: "eps_excl_extra_items_annual",
      eps_excl_ext_ttm: "eps_excl_extra_items_ttm",
      eps_growth_3y: "eps_growth_3y",
      eps_growth_5y: "eps_growth_5y",
      eps_growth_qtr_yoy: "eps_growth_quarterly_yoy",
      eps_growth_ttm_yoy: "eps_growth_ttm_yoy",
      eps_incl_ext_ann: "eps_incl_extra_items_annual",
      eps_incl_ext_ttm: "eps_incl_extra_items_ttm",
      eps_norm_ann: "eps_normalized_annual",
      ev_ebitda_ttm: "ev_ebitda_ttm",
      focf_cagr_5y: "focf_cagr_5y",
      fwd_pe: "forward_pe",
      long_debt_eq_ann: "long_term_debt/equity_annual",
      long_debt_eq_qtr: "long_term_debt/equity_quarterly",
      price_ret_daily_mtd: "month_to_date_price_return_daily",
      net_inc_emp_ann: "net_income_employee_annual",
      net_inc_emp_ttm: "net_income_employee_ttm",
      net_marg_growth_5y: "net_margin_growth_5y",
      net_prof_marg_5y: "net_profit_margin_5y",
      net_prof_marg_ann: "net_profit_margin_annual",
      net_prof_marg_ttm: "net_profit_margin_ttm",
      op_marg_5y: "operating_margin_5y",
      op_marg_ann: "operating_margin_annual",
      op_marg_ttm: "operating_margin_ttm",
      payout_ratio_ann: "payout_ratio_annual",
      payout_ratio_ttm: "payout_ratio_ttm",
      pb_ann: "pb_annual",
      pb_qtr: "pb_quarterly",
      pcf_share_ann: "pcf_share_annual",
      pcf_share_ttm: "pcf_share_ttm",
      pe_ann: "pe_annual",
      pe_basic_excl_ext_ttm: "pe_basic_excl_extra_ttm",
      pe_excl_ext_ann: "pe_excl_extra_annual",
      pe_excl_ext_ttm: "pe_excl_extra_ttm",
      pe_incl_ext_ttm: "pe_incl_extra_ttm",
      pe_norm_ann: "pe_normalized_annual",
      peg_ttm: "peg_ttm",
      pfcf_share_ann: "pfcf_share_annual",
      pfcf_share_ttm: "pfcf_share_ttm",
      pretax_marg_5y: "pretax_margin_5y",
      pretax_marg_ann: "pretax_margin_annual",
      pretax_marg_ttm: "pretax_margin_ttm",
      price_rel_sp500_13w: "price_relative_to_s&p500_13_week",
      price_rel_sp500_26w: "price_relative_to_s&p500_26_week",
      price_rel_sp500_4w: "price_relative_to_s&p500_4_week",
      price_rel_sp500_52w: "price_relative_to_s&p500_52_week",
      price_rel_sp500_ytd: "price_relative_to_s&p500_ytd",
      ps_ann: "ps_annual",
      ps_ttm: "ps_ttm",
      ptbv_ann: "ptbv_annual",
      ptbv_qtr: "ptbv_quarterly",
      rev_emp_ann: "revenue_employee_annual",
      rev_growth_3y: "revenue_growth_3y",
      rev_growth_5y: "revenue_growth_5y",
      rev_growth_qtr_yoy: "revenue_growth_quarterly_yoy",
      rev_growth_ttm_yoy: "revenue_growth_ttm_yoy",
      rev_share_ann: "revenue_per_share_annual",
      rev_share_ttm: "revenue_per_share_ttm",
      rev_share_growth_5y: "revenue_share_growth_5y",
      roa_5y: "roa_5y",
      roa_rfy: "roa_rfy",
      roe_5y: "roe_5y",
      roe_rfy: "roe_rfy",
      roi_5y: "roi_5y",
      roi_ann: "roi_annual",
      roi_ttm: "roi_ttm",
      tang_book_val_share_ann: "tangible_book_value_per_share_annual",
      tang_book_val_share_qtr: "tangible_book_value_per_share_quarterly",
      tbv_cagr_5y: "tbv_cagr_5y",
      total_debt_eq_qtr: "total_debt/total_equity_quarterly",
      price_ret_daily_ytd: "year_to_date_price_return_daily",
      ev_fcf_ann: "current_ev/free_cash_flow_annual",
      ev_fcf_ttm: "current_ev/free_cash_flow_ttm",
      // Original fields without direct mapping (use themselves or simple fallback)
      current_price: "current_price",
      high: "high",
      low: "low",
      face_value: "face_value",
      roce_per: "roce_per",
      qtr_sales_var_per: "qtr_sales_var_per",
      qtr_profit_var_per: "qtr_profit_var_per",
    };

    const columns_info = {
      market_capitalization: {
        label: "Market Cap",
        unit: "Cr",
        description:
          "The total market value of the company's outstanding shares.",
        type: "currency",
      },
      pe_ttm: {
        label: "PE (TTM)",
        unit: "x",
        description:
          "The stock price divided by the trailing twelve months earnings per share.",
        type: "ratio",
      },
      book_value_per_share_annual: {
        label: "Book Value (Ann)",
        unit: "₹",
        description:
          "The annual book value of the company's equity divided by the number of shares outstanding.",
        type: "currency",
      },
      current_dividend_yield_ttm: {
        label: "Div Yield (TTM)",
        unit: "%",
        description:
          "The trailing twelve months dividend per share divided by the current stock price, expressed as a percentage.",
        type: "percentage",
      },
      roe_ttm: {
        label: "ROE (TTM)",
        unit: "%",
        description:
          "The trailing twelve months net income divided by shareholders' equity, expressed as a percentage.",
        type: "percentage",
      },
      operating_margin_ttm: {
        label: "Op Margin (TTM)",
        unit: "%",
        description:
          "The trailing twelve months operating income divided by revenue, expressed as a percentage.",
        type: "percentage",
      },
      pb: {
        label: "Price to Book",
        unit: "x",
        description:
          "The current stock price divided by the book value per share.",
        type: "ratio",
      },
      "total_debt/total_equity_annual": {
        label: "Total Debt to Equity (Ann)",
        unit: "x",
        description: "The annual total debt divided by shareholders' equity.",
        type: "ratio",
      },
      roa_ttm: {
        label: "ROA (TTM)",
        unit: "%",
        description:
          "The trailing twelve months net income divided by total assets, expressed as a percentage.",
        type: "percentage",
      },
      "10_day_average_trading_volume": {
        label: "10D Avg Volume",
        unit: "shares",
        description:
          "The average number of shares traded daily over the past 10 trading days.",
        type: "number",
      },
      "13_week_price_return_daily": {
        label: "13W Price Return",
        unit: "%",
        description:
          "The daily price return of the stock over the last 13 weeks, expressed as a percentage.",
        type: "percentage",
      },
      "26_week_price_return_daily": {
        label: "26W Price Return",
        unit: "%",
        description:
          "The daily price return of the stock over the last 26 weeks, expressed as a percentage.",
        type: "percentage",
      },
      "3_month_adre_turn_std": {
        label: "3M ADRE Std Dev",
        unit: "%",
        description:
          "The standard deviation of the 3-month average daily range expansion turnover.",
        type: "percentage",
      },
      "3_month_average_trading_volume": {
        label: "3M Avg Volume",
        unit: "shares",
        description:
          "The average number of shares traded daily over the past 3 months.",
        type: "number",
      },
      "52_week_high": {
        label: "52W High",
        unit: "₹",
        description:
          "The highest price the stock has reached in the last 52 weeks.",
        type: "currency",
      },
      "52_week_low": {
        label: "52W Low",
        unit: "₹",
        description:
          "The lowest price the stock has reached in the last 52 weeks.",
        type: "currency",
      },
      "52_week_price_return_daily": {
        label: "52W Price Return",
        unit: "%",
        description:
          "The daily price return of the stock over the last 52 weeks, expressed as a percentage.",
        type: "percentage",
      },
      "5_day_price_return_daily": {
        label: "5D Price Return",
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
      book_value_per_share_quarterly: {
        label: "Book Value (Qtr)",
        unit: "₹",
        description:
          "The quarterly book value of the company's equity divided by the number of shares outstanding.",
        type: "currency",
      },
      book_value_share_growth_5y: {
        label: "BV Growth 5Y",
        unit: "%",
        description:
          "The 5-year compound annual growth rate of book value per share.",
        type: "percentage",
      },
      capex_cagr_5y: {
        label: "CapEx CAGR 5Y",
        unit: "%",
        description:
          "The 5-year compound annual growth rate of capital expenditures.",
        type: "percentage",
      },
      cash_flow_per_share_annual: {
        label: "Cash Flow per Share (Ann)",
        unit: "₹",
        description:
          "The annual operating cash flow divided by the number of shares outstanding.",
        type: "currency",
      },
      cash_flow_per_share_quarterly: {
        label: "Cash Flow per Share (Qtr)",
        unit: "₹",
        description:
          "The quarterly operating cash flow divided by the number of shares outstanding.",
        type: "currency",
      },
      cash_per_share_per_share_annual: {
        label: "Cash per Share (Ann)",
        unit: "₹",
        description:
          "The annual cash and equivalents divided by the number of shares outstanding.",
        type: "currency",
      },
      cash_per_share_per_share_quarterly: {
        label: "Cash per Share (Qtr)",
        unit: "₹",
        description:
          "The quarterly cash and equivalents divided by the number of shares outstanding.",
        type: "currency",
      },
      dividend_growth_rate_5y: {
        label: "Div Growth 5Y",
        unit: "%",
        description:
          "The 5-year compound annual growth rate of dividends per share.",
        type: "percentage",
      },
      dividend_indicated_annual: {
        label: "Indicated Div (Ann)",
        unit: "₹",
        description:
          "The annualized dividend based on the most recent dividend declaration.",
        type: "currency",
      },
      dividend_per_share_annual: {
        label: "Div per Share (Ann)",
        unit: "₹",
        description:
          "The total dividends paid per share over the annual period.",
        type: "currency",
      },
      dividend_per_share_ttm: {
        label: "Div per Share (TTM)",
        unit: "₹",
        description:
          "The total dividends paid per share over the trailing twelve months.",
        type: "currency",
      },
      dividend_yield_indicated_annual: {
        label: "Div Yield Ind (Ann)",
        unit: "%",
        description:
          "The indicated annual dividend divided by the current stock price, expressed as a percentage.",
        type: "percentage",
      },
      ebitd_per_share_annual: {
        label: "EBITD per Share (Ann)",
        unit: "₹",
        description:
          "The annual earnings before interest, taxes, and depreciation divided by shares outstanding.",
        type: "currency",
      },
      ebitd_per_share_ttm: {
        label: "EBITD per Share (TTM)",
        unit: "₹",
        description:
          "The trailing twelve months earnings before interest, taxes, and depreciation divided by shares outstanding.",
        type: "currency",
      },
      ebitda_cagr_5y: {
        label: "EBITDA CAGR 5Y",
        unit: "%",
        description: "The 5-year compound annual growth rate of EBITDA.",
        type: "percentage",
      },
      ebitda_interim_cagr_5y: {
        label: "EBITDA Int CAGR 5Y",
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
        label: "EPS (Ann)",
        unit: "₹",
        description:
          "The annual net income divided by the number of shares outstanding.",
        type: "currency",
      },
      eps_basic_excl_extra_items_annual: {
        label: "Basic EPS Excl Ext (Ann)",
        unit: "₹",
        description:
          "Annual basic earnings per share excluding extraordinary items.",
        type: "currency",
      },
      eps_basic_excl_extra_items_ttm: {
        label: "Basic EPS Excl Ext (TTM)",
        unit: "₹",
        description:
          "Trailing twelve months basic earnings per share excluding extraordinary items.",
        type: "currency",
      },
      eps_excl_extra_items_annual: {
        label: "EPS Excl Ext (Ann)",
        unit: "₹",
        description:
          "Annual diluted earnings per share excluding extraordinary items.",
        type: "currency",
      },
      eps_excl_extra_items_ttm: {
        label: "EPS Excl Ext (TTM)",
        unit: "₹",
        description:
          "Trailing twelve months diluted earnings per share excluding extraordinary items.",
        type: "currency",
      },
      eps_growth_3y: {
        label: "EPS Growth 3Y",
        unit: "%",
        description:
          "The 3-year compound annual growth rate of earnings per share.",
        type: "percentage",
      },
      eps_growth_5y: {
        label: "EPS Growth 5Y",
        unit: "%",
        description:
          "The 5-year compound annual growth rate of earnings per share.",
        type: "percentage",
      },
      eps_growth_quarterly_yoy: {
        label: "EPS Growth Qtr YoY",
        unit: "%",
        description:
          "The year-over-year growth in quarterly earnings per share.",
        type: "percentage",
      },
      eps_growth_ttm_yoy: {
        label: "EPS Growth TTM YoY",
        unit: "%",
        description:
          "The year-over-year growth in trailing twelve months earnings per share.",
        type: "percentage",
      },
      eps_incl_extra_items_annual: {
        label: "EPS Incl Ext (Ann)",
        unit: "₹",
        description:
          "Annual diluted earnings per share including extraordinary items.",
        type: "currency",
      },
      eps_incl_extra_items_ttm: {
        label: "EPS Incl Ext (TTM)",
        unit: "₹",
        description:
          "Trailing twelve months diluted earnings per share including extraordinary items.",
        type: "currency",
      },
      eps_normalized_annual: {
        label: "Normalized EPS (Ann)",
        unit: "₹",
        description: "Annual normalized (adjusted) earnings per share.",
        type: "currency",
      },
      ev_ebitda_ttm: {
        label: "EV to EBITDA (TTM)",
        unit: "x",
        description:
          "The enterprise value divided by the trailing twelve months EBITDA.",
        type: "ratio",
      },
      focf_cagr_5y: {
        label: "FOCF CAGR 5Y",
        unit: "%",
        description:
          "The 5-year compound annual growth rate of free operating cash flow.",
        type: "percentage",
      },
      forward_pe: {
        label: "Forward PE",
        unit: "x",
        description:
          "The current stock price divided by the estimated future earnings per share.",
        type: "ratio",
      },
      "long_term_debt/equity_annual": {
        label: "LT Debt to Equity (Ann)",
        unit: "x",
        description:
          "The annual long-term debt divided by shareholders' equity.",
        type: "ratio",
      },
      "long_term_debt/equity_quarterly": {
        label: "LT Debt to Equity (Qtr)",
        unit: "x",
        description:
          "The quarterly long-term debt divided by shareholders' equity.",
        type: "ratio",
      },
      month_to_date_price_return_daily: {
        label: "MTD Price Return",
        unit: "%",
        description:
          "The daily price return of the stock from the start of the current month, expressed as a percentage.",
        type: "percentage",
      },
      net_income_employee_annual: {
        label: "Net Income per Emp (Ann)",
        unit: "₹ Cr",
        description:
          "The annual net income divided by the number of employees.",
        type: "currency",
      },
      net_income_employee_ttm: {
        label: "Net Income per Emp (TTM)",
        unit: "₹ Cr",
        description:
          "The trailing twelve months net income divided by the number of employees.",
        type: "currency",
      },
      net_margin_growth_5y: {
        label: "Net Margin Growth 5Y",
        unit: "%",
        description: "The 5-year growth rate in net profit margin.",
        type: "percentage",
      },
      net_profit_margin_5y: {
        label: "Net Profit Margin 5Y",
        unit: "%",
        description: "The average net profit margin over the past 5 years.",
        type: "percentage",
      },
      net_profit_margin_annual: {
        label: "Net Profit Margin (Ann)",
        unit: "%",
        description:
          "The annual net income divided by revenue, expressed as a percentage.",
        type: "percentage",
      },
      net_profit_margin_ttm: {
        label: "Net Profit Margin (TTM)",
        unit: "%",
        description:
          "The trailing twelve months net income divided by revenue, expressed as a percentage.",
        type: "percentage",
      },
      operating_margin_5y: {
        label: "Op Margin 5Y",
        unit: "%",
        description: "The average operating margin over the past 5 years.",
        type: "percentage",
      },
      operating_margin_annual: {
        label: "Op Margin (Ann)",
        unit: "%",
        description:
          "The annual operating income divided by revenue, expressed as a percentage.",
        type: "percentage",
      },
      payout_ratio_annual: {
        label: "Payout Ratio (Ann)",
        unit: "%",
        description:
          "The annual dividends per share divided by earnings per share, expressed as a percentage.",
        type: "percentage",
      },
      payout_ratio_ttm: {
        label: "Payout Ratio (TTM)",
        unit: "%",
        description:
          "The trailing twelve months dividends per share divided by earnings per share, expressed as a percentage.",
        type: "percentage",
      },
      pb_annual: {
        label: "Price to Book (Ann)",
        unit: "x",
        description:
          "The stock price divided by the annual book value per share.",
        type: "ratio",
      },
      pb_quarterly: {
        label: "Price to Book (Qtr)",
        unit: "x",
        description:
          "The stock price divided by the quarterly book value per share.",
        type: "ratio",
      },
      pcf_share_annual: {
        label: "Price to CF (Ann)",
        unit: "x",
        description:
          "The stock price divided by the annual cash flow per share.",
        type: "ratio",
      },
      pcf_share_ttm: {
        label: "Price to CF (TTM)",
        unit: "x",
        description:
          "The stock price divided by the trailing twelve months cash flow per share.",
        type: "ratio",
      },
      pe_annual: {
        label: "PE (Ann)",
        unit: "x",
        description:
          "The stock price divided by the annual earnings per share.",
        type: "ratio",
      },
      pe_basic_excl_extra_ttm: {
        label: "Basic PE Excl Ext (TTM)",
        unit: "x",
        description:
          "The stock price divided by trailing twelve months basic EPS excluding extraordinary items.",
        type: "ratio",
      },
      pe_excl_extra_annual: {
        label: "PE Excl Ext (Ann)",
        unit: "x",
        description:
          "The stock price divided by annual diluted EPS excluding extraordinary items.",
        type: "ratio",
      },
      pe_excl_extra_ttm: {
        label: "PE Excl Ext (TTM)",
        unit: "x",
        description:
          "The stock price divided by trailing twelve months diluted EPS excluding extraordinary items.",
        type: "ratio",
      },
      pe_incl_extra_ttm: {
        label: "PE Incl Ext (TTM)",
        unit: "x",
        description:
          "The stock price divided by trailing twelve months diluted EPS including extraordinary items.",
        type: "ratio",
      },
      pe_normalized_annual: {
        label: "Normalized PE (Ann)",
        unit: "x",
        description:
          "The stock price divided by the annual normalized earnings per share.",
        type: "ratio",
      },
      peg_ttm: {
        label: "PEG (TTM)",
        unit: "x",
        description:
          "The trailing twelve months PE ratio divided by the expected earnings growth rate.",
        type: "ratio",
      },
      pfcf_share_annual: {
        label: "Price to FCF (Ann)",
        unit: "x",
        description:
          "The stock price divided by the annual free cash flow per share.",
        type: "ratio",
      },
      pfcf_share_ttm: {
        label: "Price to FCF (TTM)",
        unit: "x",
        description:
          "The stock price divided by the trailing twelve months free cash flow per share.",
        type: "ratio",
      },
      pretax_margin_5y: {
        label: "Pretax Margin 5Y",
        unit: "%",
        description: "The average pretax profit margin over the past 5 years.",
        type: "percentage",
      },
      pretax_margin_annual: {
        label: "Pretax Margin (Ann)",
        unit: "%",
        description:
          "The annual pretax income divided by revenue, expressed as a percentage.",
        type: "percentage",
      },
      pretax_margin_ttm: {
        label: "Pretax Margin (TTM)",
        unit: "%",
        description:
          "The trailing twelve months pretax income divided by revenue, expressed as a percentage.",
        type: "percentage",
      },
      "price_relative_to_s&p500_13_week": {
        label: "Rel to S&P 13W",
        unit: "%",
        description:
          "The stock's price performance relative to the S&P 500 over the last 13 weeks.",
        type: "percentage",
      },
      "price_relative_to_s&p500_26_week": {
        label: "Rel to S&P 26W",
        unit: "%",
        description:
          "The stock's price performance relative to the S&P 500 over the last 26 weeks.",
        type: "percentage",
      },
      "price_relative_to_s&p500_4_week": {
        label: "Rel to S&P 4W",
        unit: "%",
        description:
          "The stock's price performance relative to the S&P 500 over the last 4 weeks.",
        type: "percentage",
      },
      "price_relative_to_s&p500_52_week": {
        label: "Rel to S&P 52W",
        unit: "%",
        description:
          "The stock's price performance relative to the S&P 500 over the last 52 weeks.",
        type: "percentage",
      },
      "price_relative_to_s&p500_ytd": {
        label: "Rel to S&P YTD",
        unit: "%",
        description:
          "The stock's price performance relative to the S&P 500 from the start of the year.",
        type: "percentage",
      },
      ps_annual: {
        label: "Price to Sales (Ann)",
        unit: "x",
        description: "The stock price divided by the annual sales per share.",
        type: "ratio",
      },
      ps_ttm: {
        label: "Price to Sales (TTM)",
        unit: "x",
        description:
          "The stock price divided by the trailing twelve months sales per share.",
        type: "ratio",
      },
      ptbv_annual: {
        label: "Price to TBV (Ann)",
        unit: "x",
        description:
          "The stock price divided by the annual tangible book value per share.",
        type: "ratio",
      },
      ptbv_quarterly: {
        label: "Price to TBV (Qtr)",
        unit: "x",
        description:
          "The stock price divided by the quarterly tangible book value per share.",
        type: "ratio",
      },
      revenue_employee_annual: {
        label: "Revenue per Emp (Ann)",
        unit: "₹ Cr",
        description: "The annual revenue divided by the number of employees.",
        type: "currency",
      },
      revenue_growth_3y: {
        label: "Revenue Growth 3Y",
        unit: "%",
        description: "The 3-year compound annual growth rate of revenue.",
        type: "percentage",
      },
      revenue_growth_5y: {
        label: "Revenue Growth 5Y",
        unit: "%",
        description: "The 5-year compound annual growth rate of revenue.",
        type: "percentage",
      },
      revenue_growth_quarterly_yoy: {
        label: "Revenue Growth Qtr YoY",
        unit: "%",
        description: "The year-over-year growth in quarterly revenue.",
        type: "percentage",
      },
      revenue_growth_ttm_yoy: {
        label: "Revenue Growth TTM YoY",
        unit: "%",
        description:
          "The year-over-year growth in trailing twelve months revenue.",
        type: "percentage",
      },
      revenue_per_share_annual: {
        label: "Revenue per Share (Ann)",
        unit: "₹",
        description:
          "The annual revenue divided by the number of shares outstanding.",
        type: "currency",
      },
      revenue_per_share_ttm: {
        label: "Revenue per Share (TTM)",
        unit: "₹",
        description:
          "The trailing twelve months revenue divided by the number of shares outstanding.",
        type: "currency",
      },
      revenue_share_growth_5y: {
        label: "Revenue Share Growth 5Y",
        unit: "%",
        description:
          "The 5-year compound annual growth rate of revenue per share.",
        type: "percentage",
      },
      roa_5y: {
        label: "ROA 5Y",
        unit: "%",
        description: "The average return on assets over the past 5 years.",
        type: "percentage",
      },
      roa_rfy: {
        label: "ROA (RFY)",
        unit: "%",
        description: "The return on assets for the most recent fiscal year.",
        type: "percentage",
      },
      roe_5y: {
        label: "ROE 5Y",
        unit: "%",
        description: "The average return on equity over the past 5 years.",
        type: "percentage",
      },
      roe_rfy: {
        label: "ROE (RFY)",
        unit: "%",
        description: "The return on equity for the most recent fiscal year.",
        type: "percentage",
      },
      roi_5y: {
        label: "ROI 5Y",
        unit: "%",
        description: "The average return on investment over the past 5 years.",
        type: "percentage",
      },
      roi_annual: {
        label: "ROI (Ann)",
        unit: "%",
        description:
          "The annual net income divided by total investment, expressed as a percentage.",
        type: "percentage",
      },
      roi_ttm: {
        label: "ROI (TTM)",
        unit: "%",
        description:
          "The trailing twelve months net income divided by total investment, expressed as a percentage.",
        type: "percentage",
      },
      tangible_book_value_per_share_annual: {
        label: "Tang Book Value per Share (Ann)",
        unit: "₹",
        description:
          "The annual tangible book value divided by the number of shares outstanding.",
        type: "currency",
      },
      tangible_book_value_per_share_quarterly: {
        label: "Tang Book Value per Share (Qtr)",
        unit: "₹",
        description:
          "The quarterly tangible book value divided by the number of shares outstanding.",
        type: "currency",
      },
      tbv_cagr_5y: {
        label: "TBV CAGR 5Y",
        unit: "%",
        description:
          "The 5-year compound annual growth rate of tangible book value.",
        type: "percentage",
      },
      "total_debt/total_equity_quarterly": {
        label: "Total Debt to Equity (Qtr)",
        unit: "x",
        description:
          "The quarterly total debt divided by shareholders' equity.",
        type: "ratio",
      },
      year_to_date_price_return_daily: {
        label: "YTD Price Return",
        unit: "%",
        description:
          "The daily price return of the stock from the start of the year, expressed as a percentage.",
        type: "percentage",
      },
      "current_ev/free_cash_flow_annual": {
        label: "Enterprise Value to FCF (Ann)",
        unit: "x",
        description:
          "The enterprise value divided by the annual free cash flow.",
        type: "ratio",
      },
      "current_ev/free_cash_flow_ttm": {
        label: "Enterprise Value to FCF (TTM)",
        unit: "x",
        description:
          "The enterprise value divided by the trailing twelve months free cash flow.",
        type: "ratio",
      },
      // Fallback for unmapped original fields
      current_price: {
        label: "Current Price",
        unit: "₹",
        description: "The current trading price of the stock.",
        type: "currency",
      },
      high: {
        label: "High",
        unit: "₹",
        description:
          "The highest price of the stock in the current trading session.",
        type: "currency",
      },
      low: {
        label: "Low",
        unit: "₹",
        description:
          "The lowest price of the stock in the current trading session.",
        type: "currency",
      },
      face_value: {
        label: "Face Value",
        unit: "₹",
        description: "The nominal or face value of the stock share.",
        type: "currency",
      },
      roce_per: {
        label: "ROCE %",
        unit: "%",
        description: "Return on Capital Employed percentage.",
        type: "percentage",
      },
      qtr_sales_var_per: {
        label: "Qtr Sales Var %",
        unit: "%",
        description: "Variation in quarterly sales as a percentage.",
        type: "percentage",
      },
      qtr_profit_var_per: {
        label: "Qtr Profit Var %",
        unit: "%",
        description: "Variation in quarterly profit as a percentage.",
        type: "percentage",
      },
    };

    let data = [];
    for (let { column_name } of fields) {
      const excludeList = [
        "symbol_name",
        "company_name",
        "url",
        "bse_code",
        "nse_code",
        "profit_after_tax",
        "mar_cap",
        "sales_qtr",
        "pat_qtr",
        "debt",
        "eps",
        "promoter_holding_per",
        "weakness",
        "strengths",
        "opportunities",
        "threats",
        "long_term_recommend",
        "long_term_recommend_summary",
        "long_term_recommend_score",
        "created_at",
        "time",
        "high_date_52w",
        "low_date_52w",
        "bio",
        "address",
        "alias",
        "city",
        "country",
        "currency",
        "cusip",
        "description",
        "employee_total",
        "estimate_currency",
        "exchange",
        "finnhub_industry",
        "floating_share",
        "fundamental_freq",
        "ggroup",
        "gind",
        "gsector",
        "gsubind",
        "insider_ownership",
        "institution_ownership",
        "ipo",
        "ir_url",
        "isin",
        "lei",
        "logo",
        "market_cap_currency",
        "market_capitalization",
        "marketcap_usd",
        "naics",
        "naics_national_industry",
        "naics_sector",
        "naics_subsector",
        "name",
        "phone",
        "sedol",
        "share_outstanding",
        "state",
        "ticker",
        "us_share",
      ];
      if (excludeList.includes(column_name)) {
        continue;
      }

      const longName = fieldMap[column_name];
      
      if (longName === undefined) continue;

      const info = columns_info[longName];

      data.push({
        key: column_name,
        ...info,
      });
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

export const get_prebuild_screens = (req, res) => {
  res.status(200).json({
    status: 1,
    message: "success",
    data: prebuild_screens,
  });
};