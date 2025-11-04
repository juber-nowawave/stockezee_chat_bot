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
      const cleanValStr = rawVal.replace(/%$/, '').trim();

      let right;
      if (VALID_FIELDS.includes(cleanValStr)) {
        right = { type: 'field', name: cleanValStr };
      } else {
        const value = parseFloat(cleanValStr);
        if (isNaN(value)) {
          throw new Error(`Invalid numeric value "${rawVal}" in expression: "${trimmed}"`);
        }
        right = { type: 'number', value };
      }

      return {
        type: 'binary',
        left: { type: 'field', name: field },
        operator: aop,
        right
      };
    }

    // Try number (with optional %)
    const clean = trimmed.replace(/%$/, '').trim();
    const value = parseFloat(clean);
    if (!isNaN(value)) {
      return { type: 'number', value };
    }

    // Try field
    if (/^[a-z_]+$/i.test(trimmed)) {
      const field = trimmed.toLowerCase().trim();
      if (VALID_FIELDS.includes(field)) {
        return { type: 'field', name: field };
      } else {
        throw new Error(`Invalid field "${trimmed}"`);
      }
    }

    // Invalid
    throw new Error(`Invalid expression "${trimmed}". Expected: field (e.g. high), number (e.g. 50 or 50%), or field +|-|*|/ number/field (e.g. high + 20 or high + low)`);
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
        `Invalid operator "${operator}" in clause: "${clauses[i]}". Allowed operators: ${VALID_OPERATORS.join(
          ", "
        )}`
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
    case 'field': {
      const val = parseFloat(stock[expr.name]);
      return isNaN(val) ? NaN : val;
    }
    case 'number':
      return expr.value;
    case 'binary': {
      const leftVal = evaluate_expression(stock, expr.left);
      const rightVal = evaluate_expression(stock, expr.right);
      if (isNaN(leftVal) || isNaN(rightVal)) {
        return NaN;
      }
      switch (expr.operator) {
        case '+':
          return leftVal + rightVal;
        case '-':
          return leftVal - rightVal;
        case '*':
          return leftVal * rightVal;
        case '/':
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
        msg: filtered_stocks.length ? `Total ${filtered_stocks.length} records found!` : `No records found!`,
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
