import express from 'express';
import generate_market_PDF  from "../controllers/daily_market_report.Controller.js";
const router = express.Router();
router.get("/download-daily-market-pdf", generate_market_PDF);

export default router