import express from "express";
import {
  get_all_fields,
  structured_query_resolve,
  natural_query_resolve,
  smart_query_resolve,
  get_prebuild_screens,
  get_user_screens,
  post_user_screens,
  post_admin_screens,
  edit_user_screens,
  delete_user_screens,
  get_searched_screens,
} from "../controllers/custom_screener.Controller.js";
import auth_user_token from "../middleware/auth_user_token.js";

const router = express.Router();

router.get("/all-filter-fields", get_all_fields);
router.get("/structured-query", structured_query_resolve);
router.get("/natural-query", natural_query_resolve);
router.get("/smart-query", smart_query_resolve);
router.get("/prebuild-screens", get_prebuild_screens);
router.get("/search-screens", get_searched_screens);
router.get("/user-screens", auth_user_token, get_user_screens);
router.post("/user-screen/add", auth_user_token, post_user_screens);
router.post("/admin-screen/add", auth_user_token, post_admin_screens);
router.post("/user-screen/edit", auth_user_token, edit_user_screens);
router.post("/user-screen/delete", auth_user_token, delete_user_screens);

export default router;
