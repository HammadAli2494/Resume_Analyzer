import { dbReady } from "../config/db.js";

export function requireDb(_req, res, next) {
  if (!dbReady()) return res.status(503).json({ error: "Saved data is temporarily unavailable. Please try again." });
  return next();
}
