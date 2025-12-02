import express from "express";
import { handle_stock_analysis_query } from "../controllers/stock_analysis_ai.Controller.js";
import { handle_stock_screener_query } from "../controllers/stock_screener_ai.Controller.js";
import { get_stock_analysis_chatbot_usage } from "../controllers/stock_analysis_usage.Controller.js"
import { get_stock_screener_chatbot_usage } from "../controllers/stock_screener_usage.Controller.js";
import auth_user_token from "../middleware/auth_user_token.js";

const router = express.Router();
router.post("/stock-analysis/query", auth_user_token, handle_stock_analysis_query);
router.get("/stock-analysis/usage", auth_user_token, get_stock_analysis_chatbot_usage);
router.post("/stock-screener/query",  auth_user_token, handle_stock_screener_query);
router.get("/stock-screener/usage", auth_user_token, get_stock_screener_chatbot_usage);

export default router;
