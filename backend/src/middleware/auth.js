import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { User } from "../models/User.js";

function readToken(req) {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7).trim() : "";
}

export async function requireAuth(req, res, next) {
  const token = readToken(req);
  if (!token) return res.status(401).json({ error: "Authentication required." });
  try {
    const payload = jwt.verify(token, env.jwtSecret);
    const user = await User.findById(payload.sub).select("tokenVersion email role");
    if (!user || (user.tokenVersion || 0) !== payload.ver) {
      return res.status(401).json({ error: "Your session has expired. Please sign in again." });
    }
    req.user = { id: payload.sub, email: user.email, role: user.role };
    return next();
  } catch {
    return res.status(401).json({ error: "Your session has expired. Please sign in again." });
  }
}
