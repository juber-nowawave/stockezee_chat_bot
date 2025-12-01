import {
  custom_screener_structured_query_resolve,
  custom_screener_natural_query_resolve,
  custom_screener_smart_query_resolve,
  custom_screener_get_all_fields,
} from "../services/custom_screener.Services.js";
import {
  get_all_screens as getAllScreensService,
  get_search_screens as getSearchScreensService,
  post_user_screens as postUserScreensService,
  post_admin_screens as postAdminScreensService,
  edit_user_screens as editUserScreensService,
  delete_user_screens as deleteUserScreensService,
} from "../services/custom_screener_queries.Services.js";
import prebuild_screens from "../data/custom_screener_screens_collections.json" with { type: "json" };

export const structured_query_resolve = async (req, res) => {
  const { user_query } = req.query;
  const response = await custom_screener_structured_query_resolve(user_query);
  return res.status(response.res_status).json(response.res);
};

export const natural_query_resolve = async (req, res) => {
  const { user_query } = req.query;
  const response = await custom_screener_natural_query_resolve(user_query);
  return res.status(response.res_status).json(response.res);
};

export const smart_query_resolve = async (req, res) => {
  const { user_query } = req.query;
  const response = await custom_screener_smart_query_resolve(user_query);
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

export const get_all_screens = async (req, res) => {
  const { user_id } = req.query;
  const result = await getAllScreensService(parseInt(user_id));
  return res.status(result.res_status).json(result.res);
};

export const post_user_screens = async (req, res) => {
  const {
    user_id,
    title,
    description,
    backend_query,
    frontend_query,
    publish,
  } = req.body;
  const category = "user made";
  const screenData = {
    user_id: parseInt(user_id),
    category,
    title,
    description,
    backend_query,
    frontend_query,
    publish,
  };

  const result = await postUserScreensService(screenData);
  return res.status(result.res_status).json(result.res);
};

export const post_admin_screens = async (req, res) => {
  const data = req.body;
  const result = await postAdminScreensService(data);
  return res.status(result.res_status).json(result.res);
};

export const edit_user_screens = async (req, res) => {
  const { user_id, query_id } = req.body;

  const updateData = {
    title: req.body.title,
    description: req.body.description,
    backend_query: req.body.backend_query,
    frontend_query: req.body.frontend_query,
    publish: req.body.publish,
  };

  const result = await editUserScreensService(
    parseInt(query_id),
    updateData,
    parseInt(user_id)
  );
  return res.status(result.res_status).json(result.res);
};

export const delete_user_screens = async (req, res) => {
  const { user_id, query_id } = req.body;

  const result = await deleteUserScreensService(
    parseInt(query_id),
    parseInt(user_id)
  );
  return res.status(result.res_status).json(result.res);
};

export const get_searched_screens = async (req, res) => {
  const { search, user_id } = req.query;
  const result = await getSearchScreensService(search);
  return res.status(result.res_status).json(result.res);
};
