import { Router } from "express";
import { history } from "../controllers/analysisController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireDb } from "../middleware/requireDb.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
router.get("/history", requireDb, requireAuth, asyncHandler(history));

export default router;
