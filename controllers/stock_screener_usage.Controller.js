import moment from "moment-timezone";
import db from "../models/index.js";

export const get_stock_screener_chatbot_usage = async (req, res) => {
  try {
    const user_id = req.user.id;
    const current_date = moment().tz("Asia/kolkata").format("YYYY-MM-DD");

    const today_count = await db.chat_bot_history.count({
      where: {
        user_id,
        bot_type: "stock screener",
        status: "success",
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
