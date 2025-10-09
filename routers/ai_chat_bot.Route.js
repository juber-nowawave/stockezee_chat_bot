import express from "express";
import { handle_stock_analysis_query } from "../controllers/stock_analysis_ai.Controller.js";
import { handle_stock_screener_query } from "../controllers/stock_screener_ai.Controller.js";
import { get_stock_analysis_chatbot_usage } from "../controllers/stock_analysis_usage.Controller.js"
import { get_stock_screener_chatbot_usage } from "../controllers/stock_screener_usage.Controller.js";

const router = express.Router();
router.post("/stock-analysis/query", handle_stock_analysis_query);
router.get("/stock-analysis/usage", get_stock_analysis_chatbot_usage);
router.post("/stock-screener/query", handle_stock_screener_query);
router.get("/stock-screener/usage", get_stock_screener_chatbot_usage);

export default router;
