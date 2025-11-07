import express from 'express';
import {get_all_filter_fields, get_all_fields, query_resolve}  from "../controllers/custom_screener.Controller.js";
const router = express.Router();
router.get("/all-fields", get_all_filter_fields);
router.get("/all-filter-fields",get_all_fields);
router.get("/query", query_resolve);

export default router;