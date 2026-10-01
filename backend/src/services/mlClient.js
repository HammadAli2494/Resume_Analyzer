import { httpError } from "../utils/httpError.js";

function serviceUrl() {
  const configured = process.env.ML_SERVICE_URL;
  if (configured) return configured.replace(/\/$/, "");
  if (process.env.NODE_ENV === "production") return "";
  return "http://127.0.0.1:8000";
}

function headers(extra = {}) {
  const result = { ...extra };
  const token = process.env.ML_INTERNAL_TOKEN || "";
  if (token) result["X-Internal-Token"] = token;
  return result;
}

async function callMl(path, options = {}, timeoutMs = 20000) {
  const base = serviceUrl();
  if (!base) throw httpError(503, "Analysis is temporarily unavailable. Please try again.");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(`${base}${path}`, {
      ...options,
      headers: headers(options.headers),
      signal: controller.signal,
    });
    const text = await response.text();
    let data = {};
    if (text) {
      try {
        data = JSON.parse(text);
      } catch {
        data = {};
      }
    }
    return { ok: response.ok, status: response.status, data };
  } catch {
    throw httpError(503, "Analysis is temporarily unavailable. Please try again.");
  } finally {
    clearTimeout(timer);
  }
}

export async function mlHealth() {
  try {
    const { ok, data } = await callMl("/ready", {}, 4000);
    if (ok && data.ready) return { reachable: true, ready: true, scoring: "ml" };
    if (data.scoring === "keyword_only") return { reachable: true, ready: false, scoring: "keyword_only" };
    return { reachable: false, ready: false, scoring: "down" };
  } catch {
    return { reachable: false, ready: false, scoring: "down" };
  }
}

export async function analyzeFile(file, job) {
  const form = new FormData();
  const blob = new Blob([file.buffer], { type: file.mimetype || "application/octet-stream" });
  form.append("resume", blob, file.originalname || "resume");
  form.append("job_description", job.description);
  if (job.requiredSkills?.length) form.append("required_skills", job.requiredSkills.join(","));
  if (job.experienceRequirements) form.append("experience_requirements", job.experienceRequirements);
  if (job.educationRequirements) form.append("education_requirements", job.educationRequirements);

  const { ok, status, data } = await callMl("/analyze", { method: "POST", body: form }, 60000);
  if (!ok) {
    if (status >= 500 || status === 401) {
      console.error(`Scoring request failed with status ${status}.`);
      throw httpError(503, "Analysis is temporarily unavailable. Please try again.");
    }
    throw httpError(status, data.error || "We could not read this file. Upload a text-based PDF or DOCX.");
  }
  return data;
}
