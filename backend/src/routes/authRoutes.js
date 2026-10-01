import { Router } from "express";
import rateLimit from "express-rate-limit";
import { login, logout, me, register } from "../controllers/authController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireDb } from "../middleware/requireDb.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const authLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many attempts. Try again later." },
});

const router = Router();
router.use(requireDb);
const limit = process.env.NODE_ENV === "test" ? [] : [authLimit];
router.post("/register", ...limit, asyncHandler(register));
router.post("/login", ...limit, asyncHandler(login));
router.get("/me", requireAuth, asyncHandler(me));
router.post("/logout", requireAuth, asyncHandler(logout));

export default router;
