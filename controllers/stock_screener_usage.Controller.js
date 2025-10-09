import moment from "moment-timezone";
import { Op } from "sequelize";
import { verify_token } from "../services/jwt-auth.js";
import db from "../models/index.js";

export const get_stock_screener_chatbot_usage = async (req, res) => {
  try {
    const auth_header = req.headers["authorization"];
    if (!auth_header?.startsWith("Bearer ")) {
      return res.status(401).json({
        status: 0,
        message: "authorization_token_missing_or_invalid",
      });
    }

    const token = auth_header.split(" ")[1];
    const verified_user = await verify_token(token);

    if (!verified_user) {
      return res.status(400).json({
        status: 0,
        message: "invalid_token",
      });
    }

    const user_id = verified_user.id;
    const current_date = moment().tz("Asia/kolkata").format("YYYY-MM-DD");

    const today_count = await db.chat_bot_history.count({
      where: {
        user_id,
        bot_type: "stock screener",
        status:'success',
        created_at: current_date,
      },
    });

    const max_limit = 10;

    return res.status(200).json({
      status: 1,
      message: "success",
      data: {
        max_limit,
        remaining_limit: max_limit - today_count,
      },
    });
  } catch (error) {
    console.error("chatbot_usage_error:", error);
    return res.status(500).json({
      status: 0,
      message: "internal_server_error",
    });
  }
};
