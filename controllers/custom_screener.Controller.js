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

  const tokens = [];
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

  const conditions = [];
  console.log('-----',parts);
  
  for (let i = 0; i < clauses.length; i++) {
    const clause = clauses[i].toLowerCase();

    const match = clause.match(/^([a-z_]+)\s*(>=|<=|!=|>|<|=)\s*(.+)$/i);

    if (!match) {
      throw new Error(
        `Invalid clause format: "${clause}". Expected format: field operator value (e.g., market_cap > 500 or high > low)`
      );
    }
    console.log(match);
    
    const [, rawField, operator, rawValue] = match;
    const field = rawField.trim();
    const valueStr = rawValue.trim();

    if (!field) {
      throw new Error(`Empty field in clause: "${clause}"`);
    }

    if (!VALID_FIELDS.includes(field)) {
      throw new Error(
        `Invalid field "${field}". Allowed fields: ${VALID_FIELDS.join(", ")}`
      );
    }

    if (!VALID_OPERATORS.includes(operator)) {
      throw new Error(
        `Invalid operator "${operator}" in clause: "${clause}". Allowed operators: ${VALID_OPERATORS.join(
          ", "
        )}`
      );
    }

    const cleanValueStr = valueStr.replace(/%$/, "").trim();

    const logicalOperator = i === 0 ? null : logicalOps[i - 1];

    if (VALID_FIELDS.includes(cleanValueStr)) {
      conditions.push({
        field,
        operator,
        compareField: cleanValueStr,
        isFieldComparison: true,
        logicalOperator,
      });
    } else {
      const value = parseFloat(cleanValueStr);

      if (isNaN(value)) {
        throw new Error(
          `Invalid value "${valueStr}" in clause: "${clause}". Value must be either a number or a valid field name.`
        );
      }

      conditions.push({
        field,
        operator,
        value,
        isFieldComparison: false,
        logicalOperator,
      });
    }
  }

  return conditions;
};

const evaluate_condition = (stock, condition) => {
  const { field, operator, isFieldComparison } = condition;
  const leftValue = parseFloat(stock[field]);

  if (leftValue === null || leftValue === undefined || isNaN(leftValue)) {
    return false;
  }

  let rightValue;

  if (isFieldComparison) {
    const compareField = condition.compareField;
    rightValue = parseFloat(stock[compareField]);

    if (rightValue === null || rightValue === undefined || isNaN(rightValue)) {
      return false;
    }
  } else {
    rightValue = parseFloat(condition.value);
  }

  switch (operator) {
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
        query: user_query,
        conditions: conditions,
        total_stocks: all_stocks.length,
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
      error: process.env.NODE_ENV === "development" ? error.message : undefined,
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
