import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import ai_query_routes from "./routers/ai_chat_bot.Route.js";
import stock_mind_map_routes from "./routers/stock_mind_map.Route.js";
import {connectDb} from "./models/index.js";
import company_strength_analysis_cron from "./jobs/company_strength_analysis.Job.js"

dotenv.config();
const app = express();

var corsOptions = {
  origin: '*',
}

app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(cors(corsOptions));

// DB connect
connectDb();

// Routes
app.use("/ai/api/chat-bot", ai_query_routes);
app.use("/ai/api/mind-map",stock_mind_map_routes);
// Cron Jobs
// company_strength_analysis_cron();

export default app;