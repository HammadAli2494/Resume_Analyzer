import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
dotenv.config({ path: path.join(root, ".env") });

export function productionProblems(environ = process.env) {
  if ((environ.NODE_ENV || "") !== "production") return [];
  const problems = [];
  if (!environ.MONGODB_URI) problems.push("MONGODB_URI");
  if (!environ.JWT_SECRET || environ.JWT_SECRET.length < 32) problems.push("JWT_SECRET");
  if (!environ.ML_SERVICE_URL) problems.push("ML_SERVICE_URL");
  if (!environ.CLIENT_URL || environ.CLIENT_URL.includes("*")) problems.push("CLIENT_URL");
  if (!environ.ML_INTERNAL_TOKEN || environ.ML_INTERNAL_TOKEN.length < 16) problems.push("ML_INTERNAL_TOKEN");
  return problems;
}

export function assertEnv() {
  const missing = ["JWT_SECRET", "MONGODB_URI"].filter((key) => !process.env[key]);
  if (missing.length) {
    console.error(`Missing environment variables: ${missing.join(", ")}. Copy backend/.env.example to backend/.env.`);
    process.exit(1);
  }
  if (process.env.JWT_SECRET.length < 16) {
    console.error("JWT_SECRET must be at least 16 characters.");
    process.exit(1);
  }
  const problems = productionProblems(process.env);
  if (problems.length) {
    console.error(`Production configuration is incomplete: ${problems.join(", ")}.`);
    process.exit(1);
  }
}

export const env = {
  port: Number(process.env.PORT || 5000),
  mongoUri: process.env.MONGODB_URI,
  jwtSecret: process.env.JWT_SECRET,
  mlServiceUrl: (process.env.ML_SERVICE_URL || (process.env.NODE_ENV === "production" ? "" : "http://127.0.0.1:8000")).replace(/\/$/, ""),
  clientUrl: process.env.CLIENT_URL || (process.env.NODE_ENV === "production" ? "" : "http://localhost:5173"),
  maxUploadBytes: Number(process.env.MAX_UPLOAD_MB || 8) * 1024 * 1024,
};
