import prebuild_screens from "../data/custom_screener_screens_collections.json" with { type: "json" };
import {custom_screener_query_resolve, custom_screener_get_all_fields } from "../services/custom_screener.Services.js"

export const query_resolve = async (req, res) => {
    const { user_query } = req.query;
    const response = await custom_screener_query_resolve(user_query);
    return res.status(response.res_status).json(response.res);
};

export const get_all_fields = async (req, res) => {
  const response = await custom_screener_get_all_fields();
  return res.status(response.res_status).json(response.res);
};

export const get_prebuild_screens = (req, res) => {
  res.status(200).json({ status: 1,
    message: "success",
    data: prebuild_screens,
  });
};