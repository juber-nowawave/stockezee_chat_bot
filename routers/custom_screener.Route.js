import express from 'express';
import {get_all_fields, query_resolve, get_prebuild_screens}  from "../controllers/custom_screener.Controller.js";
const router = express.Router();
router.get("/all-filter-fields",get_all_fields);
router.get("/query", query_resolve);
router.get("/prebuild-screens", get_prebuild_screens);

export default router;