import express from "express";
import dotenv from "dotenv";
import queryRoutes from "./routers/ai_chat_bot.Route.js";
import {connectDb} from "./models/index.js";

dotenv.config();
const app = express();
app.use(express.json());
app.use(express.urlencoded({extended:true}));

// DB connect
connectDb();

// Routes
app.use("/api/chat-bot/query", queryRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
