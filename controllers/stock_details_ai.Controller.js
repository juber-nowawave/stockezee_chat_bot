import { stock_details_ai } from "../ai/stock_details.js";

export const handleStockQuery = async (req, res) => {
  try {
    const { userQuery , symbol } = req.body;
    if (!userQuery || !symbol) {
      return res.status(400).json({status:0 ,message:"user-query or symbol is required", data:{msg:"Missing parameters"}});
    }

    req.body = { userQuery , symbol};
    await stock_details_ai(req, res);
  } catch (error) {
    console.error("Query error:", error);
    return res.status(500).json({status:0 ,message:"Something went wrong", data:{msg:"Something went wrong"}});
  }
};

