import { stock_analysis_ai } from "../ai/stock_analysis.js";
import { verify_token } from "../services/jwt-auth.js";
import db from "../models/index.js";
import moment from "moment";

export const handle_stock_analysis_query = async (req, res) => {
  try {
    const auth_header = req.headers["authorization"];
    if (!auth_header || !auth_header.startsWith("Bearer ")) {
      return res.status(401).json({
        status: 0,
        message: "Authorization token missing or malformed",
        data: null,
      });
    }

    const token = auth_header.split(" ")[1];
    const is_verified = await verify_token(token);
    const is_prime = req.headers["is-prime"];

    if (!is_verified) {
      return res.status(400).json({
        status: 0,
        message: "Invalid token!",
        data: null,
      });
    }
    if (!is_prime || is_prime.trim() == "false") {
      return res.status(400).json({
        status: 0,
        message: "Invalid user!",
        data: null,
      });
    }

    const { userQuery, symbol } = req.body;
    if (!userQuery || !symbol) {
      return res.status(400).json({
        status: 0,
        message: "user-query or symbol is required",
        data: { msg: "Missing parameters" },
      });
    }
    const current_date = moment().tz("Asia/kolkata").format("YYYY-MM-DD");
    const userid = is_verified.id;
    const today_count = await db.chat_bot_history.count({
      where: {
        user_id: userid,
        bot_type: "stock analysis",
        status:'success',
        created_at: current_date,
      },
    });

    const max_limit = 10;
    if (today_count >= max_limit) {
      return res.status(200).json({
        status: 1,
        message: "success",
        data: { msg: "Today's limit exceeded!", remaining_limit:0, max_limit},
      });
    }
    
    req.body = { userQuery, symbol, userid, remaining_limit: max_limit - today_count, max_limit};
    await stock_analysis_ai(req, res);
  } catch (error) {
    console.error("Query error:", error);
    return res.status(500).json({
      status: 0,
      message: "Something went wrong",
      data: { msg: "Something went wrong", remaining_limit:0},
    });
  }
};
