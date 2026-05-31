import axios from "axios";

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "/api",
  headers: { Accept: "application/json" },
});

export function setAuthToken(token) {
  if (token) api.defaults.headers.common.Authorization = `Bearer ${token}`;
  else delete api.defaults.headers.common.Authorization;
}

const saved = localStorage.getItem("access_token");
if (saved) setAuthToken(saved);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem("access_token");
      localStorage.removeItem("refresh_token");
      setAuthToken(null);
    }
    return Promise.reject(error);
  }
);

// —— Auth ——
export async function login(username, password) {
  const { data } = await api.post("/auth/login/", { username, password });
  return data;
}

export async function register(username, password, email = "") {
  const { data } = await api.post("/auth/register/", { username, password, email });
  return data;
}

export async function getProfile() {
  const { data } = await api.get("/auth/me/");
  return data;
}

// —— Screening ——
export async function analyzeResume(resumeFile, jobDescription, options = {}) {
  const formData = new FormData();
  formData.append("resume", resumeFile);
  formData.append("job_description", jobDescription);
  if (options.save) formData.append("save", "true");
  const { data } = await api.post("/analyze/", formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

// —— ML metrics ——
export async function fetchMlInfo() {
  const { data } = await api.get("/ml/info/");
  return data;
}

export async function fetchMlMetrics() {
  const { data } = await api.get("/ml/metrics/");
  return data;
}

export async function fetchMlCvReport() {
  const { data } = await api.get("/ml/cv-report/");
  return data;
}

export async function fetchMlEvaluation() {
  const { data } = await api.get("/ml/evaluation/");
  return data;
}

// —— Jobs (recruiter) ——
export async function fetchJobs() {
  const { data } = await api.get("/jobs/");
  return data;
}

export async function createJob(title, description) {
  const { data } = await api.post("/jobs/", { title, description });
  return data;
}

export async function fetchJob(jobId) {
  const { data } = await api.get(`/jobs/${jobId}/`);
  return data;
}

export async function deleteJob(jobId) {
  await api.delete(`/jobs/${jobId}/`);
}

export async function batchScreen(jobId, files) {
  const form = new FormData();
  files.forEach((f) => form.append("resumes", f));
  const { data } = await api.post(`/jobs/${jobId}/screen/`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function downloadJobCsv(jobId) {
  const { data } = await api.get(`/jobs/${jobId}/export.csv`, { responseType: "blob" });
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = `job_${jobId}_rankings.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
}

// —— Training data ——
export async function fetchTrainingPairs(params = {}) {
  const { data } = await api.get("/training/pairs/", { params });
  return data;
}

export async function fetchTrainingStats() {
  const { data } = await api.get("/training/stats/");
  return data;
}

export async function createTrainingPair(payload) {
  const { data } = await api.post("/training/pairs/", payload);
  return data;
}

export async function importTrainingCSV(file) {
  const form = new FormData();
  form.append("file", file);
  const { data } = await api.post("/training/import-csv/", form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}

export async function exportAndTrain() {
  const { data } = await api.post("/training/export-and-train/");
  return data;
}
