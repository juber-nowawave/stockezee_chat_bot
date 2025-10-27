import express from 'express';
import {get_all_filter_fields}  from "../controllers/custom_screener.Controller.js";
const router = express.Router();
router.get("/all-fields", get_all_filter_fields);
router.get("/query", get_all_filter_fields);

export default router