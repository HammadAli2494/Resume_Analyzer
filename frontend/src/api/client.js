import axios from "axios";

const baseURL = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? "http://localhost:5000/api" : "");

export const api = axios.create({
  baseURL,
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
    const url = error.config?.url || "";
    const hadToken = Boolean(localStorage.getItem("access_token"));
    if (error.response?.status === 401 && hadToken && !url.includes("/auth/login")) {
      localStorage.removeItem("access_token");
      setAuthToken(null);
      sessionStorage.setItem("auth_notice", "Your session has expired. Please sign in again.");
      window.dispatchEvent(new Event("auth:logout"));
    }
    return Promise.reject(error);
  }
);

export function errorMessage(error, fallback = "Something went wrong.") {
  return error.response?.data?.error || fallback;
}

export async function login(email, password) {
  const { data } = await api.post("/auth/login", { email, password });
  return data;
}

export async function register(name, email, password) {
  const { data } = await api.post("/auth/register", { name, email, password });
  return data;
}

export async function logoutRequest() {
  await api.post("/auth/logout");
}

export async function getProfile() {
  const { data } = await api.get("/auth/me");
  return data;
}

export async function fetchJobs(archived = false) {
  const { data } = await api.get("/jobs", { params: { archived } });
  return data;
}

export async function createJob(payload) {
  const { data } = await api.post("/jobs", payload);
  return data;
}

export async function updateJob(jobId, payload) {
  const { data } = await api.patch(`/jobs/${jobId}`, payload);
  return data;
}

export async function archiveJob(jobId, archived = true) {
  const { data } = await api.post(`/jobs/${jobId}/archive`, { archived });
  return data;
}

export async function screenResume(jobId, file, version) {
  const form = new FormData();
  form.append("resumes", file);
  if (version != null) form.append("expected_version", String(version));
  const { data } = await api.post(`/jobs/${jobId}/screen`, form);
  return data;
}

export async function fetchJob(jobId, params = {}) {
  const { data } = await api.get(`/jobs/${jobId}`, { params });
  return data;
}

export async function renameCandidate(jobId, analysisId, candidateName) {
  const { data } = await api.patch(`/jobs/${jobId}/analyses/${analysisId}`, { candidateName });
  return data;
}

export async function deleteJob(jobId) {
  await api.delete(`/jobs/${jobId}`);
}


export async function downloadJobCsv(jobId, version) {
  const { data } = await api.get(`/jobs/${jobId}/export.csv`, {
    params: version ? { version } : {},
    responseType: "blob",
  });
  const url = window.URL.createObjectURL(new Blob([data]));
  const link = document.createElement("a");
  link.href = url;
  link.download = `job_${jobId}_rankings.csv`;
  link.click();
  window.URL.revokeObjectURL(url);
}

export async function fetchHistory() {
  const { data } = await api.get("/history");
  return data;
}
