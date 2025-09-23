import express from "express";
import { stock_mind_map } from "../controllers/sock_mind_map.Controller.js";
const router = express.Router();
router.get("/", stock_mind_map);

export default router;
