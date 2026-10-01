import { Router } from "express";
import { dashboard } from "../controllers/dashboardController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireDb } from "../middleware/requireDb.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
router.get("/", requireDb, requireAuth, asyncHandler(dashboard));

export default router;
