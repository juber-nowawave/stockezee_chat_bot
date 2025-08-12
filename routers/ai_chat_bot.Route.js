import express from "express";
import { handleStockQuery } from "../controllers/stock_details_ai.Controller.js";
import { handleMarketQuery } from "../controllers/market_details_ai.Controller.js"
const router = express.Router();
router.post("/stock/query", handleStockQuery);
router.post("/market/query", handleMarketQuery);

export default router;
