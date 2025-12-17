import { stock_mind_map_generate } from "../utils/stock_mind_map_generate.js";

export const stock_mind_map = async (req, res) => {
  try {
    let { symbol_name } = req.query;
    symbol_name = symbol_name.trim().toUpperCase();

    const mind_map = await stock_mind_map_generate(symbol_name);
    if (mind_map === null) throw Error;

    return res.status(200).json({
      status: 1,
      message: `stock mind-map fetched successfully!`,
      data: mind_map,
    });
  } catch (error) {
    console.error("Error occured during fetch stock mind-map!", error);
    return res.status(200).json({
      status: 1,
      message: `Internal server error!`,
      data: {
        name: symbol_name || "UNKNOWN",
        children: [],
      },
    });
  }
};
