import { generateSQLFromText } from "../ai/langchain.js";

export const handleStockQuery = async (req, res) => {
  try {
    const { userQuery , symbol } = req.body;
    if (!userQuery || !symbol) {
      return res.status(400).json({status:0 ,message:"userQuery or symbol is required", data:{msg:"Missing parameters"}});
    }

    req.body = { userQuery , symbol};
    await generateSQLFromText(req, res);
  } catch (error) {
    console.error("Query error:", error);
    return res.status(500).json({status:0 ,message:"Something went wrong", data:{msg:"Something went wrong"}});
  }
};
 