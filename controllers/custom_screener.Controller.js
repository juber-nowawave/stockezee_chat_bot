import { verify_token } from "../services/jwt-auth.js";
import db from "../models/index.js";
import moment from "moment";

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
    const fields = await db.sequelize.query(
      `
      SELECT 
       c.table_name, 
       c.column_name
      FROM information_schema.columns c
      WHERE c.table_schema = 'public'
        AND c.table_name IN (
        'nse_company_peers',
        'nse_company_details',
        'nse_company_financials',
        'nse_company_shareholding'
      )
      ORDER BY c.table_name ASC, c.ordinal_position ASC;
     `,
      {
        type: db.Sequelize.QueryTypes.SELECT,
      }
    );

    const tables = {
      nse_company_peers: "Peers",
      nse_company_details: "Ratios",
      nse_company_financials: "Quarterly P&L",
      nse_company_shareholding: "Shareholding",
    };

    let data = new Map();
    for (let col of fields) {
      if (
        [
          "company_name",
          "symbol_name",
          "parent_symbol_name",
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
