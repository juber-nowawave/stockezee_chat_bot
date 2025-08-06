import express from "express";
import { handleStockQuery } from "../controllers/ai_chat_bot.Controller.js";

const router = express.Router();
router.post("/", handleStockQuery);

export default router;
