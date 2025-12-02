import {
  custom_screener_structured_query_resolve,
  custom_screener_natural_query_resolve,
  custom_screener_smart_query_resolve,
  custom_screener_get_all_fields,
} from "../services/custom_screener.Services.js";
import {
  get_prebuild_screens as getPrebuildScreens,
  get_user_screens as getUserScreensService,
  get_search_screens as getSearchScreensService,
  post_user_screens as postUserScreensService,
  post_admin_screens as postAdminScreensService,
  edit_user_screens as editUserScreensService,
  delete_user_screens as deleteUserScreensService,
} from "../services/custom_screener_queries.Services.js";
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

export const get_prebuild_screens = async (req, res) => {
  const result = await getPrebuildScreens();
  return res.status(result.res_status).json(result.res);
};

export const get_user_screens = async (req, res) => {
  const user_id  = req.user.id;
  const result = await getUserScreensService(user_id);
  return res.status(result.res_status).json(result.res);
};

export const post_user_screens = async (req, res) => {
  const {
    title,
    description,
    backend_query,
    frontend_query,
    publish,
  } = req.body;
  const user_id  = req.user.id;
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
  const user_id = req.user.id;
  const {query_id} = req.body;
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
  const user_id = req.user.id;
  const {query_id} = req.body;
  const result = await deleteUserScreensService(
    parseInt(query_id),
    parseInt(user_id)
  );
  return res.status(result.res_status).json(result.res);
};

export const get_searched_screens = async (req, res) => {
  const {search} = req.query;
  const result = await getSearchScreensService(search);
  return res.status(result.res_status).json(result.res);
};
