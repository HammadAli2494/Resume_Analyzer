import cors from "cors";
import express from "express";
import rateLimit from "express-rate-limit";
import helmet from "helmet";
import mongoose from "mongoose";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middleware/errorHandler.js";
import analysisRoutes from "./routes/analysisRoutes.js";
import authRoutes from "./routes/authRoutes.js";
import dashboardRoutes from "./routes/dashboardRoutes.js";
import jobRoutes from "./routes/jobRoutes.js";
import { mlHealth } from "./services/mlClient.js";

const configured = [env.clientUrl, ...(process.env.CLIENT_ORIGINS || "").split(",")]
  .map((origin) => origin.trim())
  .filter((origin) => origin && origin !== "*");
const origins = process.env.NODE_ENV === "production"
  ? configured
  : [...new Set([
      ...configured,
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:5174",
      "http://127.0.0.1:5174",
    ])];

export const app = express();

const trust = process.env.TRUST_PROXY || "";
if (trust === "1" || trust === "true") app.set("trust proxy", 1);
else if (/^\d+$/.test(trust)) app.set("trust proxy", Number(trust));

app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin: origins, methods: ["GET", "POST", "PATCH", "DELETE"] }));
app.use(express.json({ limit: "1mb" }));
if (process.env.NODE_ENV !== "test") {
  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: "Too many requests. Try again later." },
  }));
}

async function readiness(_req, res) {
  const db = mongoose.connection.readyState === 1;
  const ml = await mlHealth();
  if (!db || !ml.reachable) {
    return res.status(503).json({ status: "unavailable" });
  }
  if (!ml.ready) {
    return res.status(503).json({ status: "degraded", scoring: "keyword_only" });
  }
  return res.json({ status: "ok", scoring: "ml" });
}

app.get("/api/health/live", (_req, res) => {
  res.json({ status: "live" });
});
app.get("/api/health/ready", readiness);
app.get("/api/health", readiness);

app.use("/api/auth", authRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/dashboard", dashboardRoutes);
app.use("/api", analysisRoutes);
app.use(notFound);
app.use(errorHandler);
