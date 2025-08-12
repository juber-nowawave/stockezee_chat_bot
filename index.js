import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import queryRoutes from "./routers/ai_chat_bot.Route.js";
import {connectDb} from "./models/index.js";

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
app.use("/ai/api/chat-bot", queryRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
