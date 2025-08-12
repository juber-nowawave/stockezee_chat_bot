import { market_details_ai } from "../ai/market_details.js";

export const handleMarketQuery = async (req, res) => {
  try {   
    const { userQuery } = req.body;
    if (!userQuery) {
      return res.status(400).json({status:0 ,message:"user-query is required", data:{msg:"Missing parameters"}});
    }

    req.body = {userQuery};
    await market_details_ai(req, res);
  } catch (error) {
    console.error("Query error:", error);
    return res.status(500).json({status:0 ,message:"Something went wrong", data:{msg:"Something went wrong"}});
  }
};

