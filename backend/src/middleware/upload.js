import multer from "multer";
import { env } from "../config/env.js";

const ALLOWED = new Set([".pdf", ".docx"]);

function extension(name = "") {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

function fileFilter(_req, file, cb) {
  if (!ALLOWED.has(extension(file.originalname))) {
    const error = new Error("Invalid resume format. Upload a PDF or DOCX file.");
    error.code = "UNSUPPORTED_FILE";
    return cb(error);
  }
  return cb(null, true);
}

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.maxUploadBytes, files: 10 },
  fileFilter,
});

export function uploadError(err, req, res, next) {
  if (err instanceof multer.MulterError) {
    if (err.code === "LIMIT_FILE_SIZE") {
      const mb = Math.round(env.maxUploadBytes / (1024 * 1024));
      return res.status(400).json({ error: `File is too large. Maximum size is ${mb} MB.` });
    }
    if (err.code === "LIMIT_FILE_COUNT") {
      return res.status(400).json({ error: "Upload at most 10 resumes at once." });
    }
    return res.status(400).json({ error: "Upload failed." });
  }
  if (err?.code === "UNSUPPORTED_FILE") {
    return res.status(400).json({ error: err.message });
  }
  return next(err);
}
