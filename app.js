import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import ai_query_routes from "./routers/ai_chat_bot.Route.js";
import stock_mind_map_routes from "./routers/stock_mind_map.Route.js";
import daily_market_report_routes from "./routers/daily_market_report.Route.js";
import custom_screener_routes from "./routers/custom_screener.Route.js";
// import connectDb from "./models/index.js";
// import company_strength_analysis_cron from "./jobs/company_strength_analysis.Job.js"

dotenv.config();
const app = express();

var corsOptions = {
  origin: [
    "https://www.stockezee.com",
    "http://localhost:4000",
    "http://localhost:3005",
  ],
};

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors(corsOptions));

// Routes
app.use("/ai/api/chat-bot", ai_query_routes);
app.use("/ai/api/mind-map", stock_mind_map_routes);
app.use("/ai/api/reports", daily_market_report_routes);
app.use("/ai/api/custom-screener", custom_screener_routes);

// Cron Jobs
// company_strength_analysis_cron();

export default app;
