import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";
import mongoose from "mongoose";
import { app } from "../src/app.js";
import { connectDb } from "../src/config/db.js";
import { Analysis } from "../src/models/Analysis.js";
import { Job } from "../src/models/Job.js";
import { Resume } from "../src/models/Resume.js";
import { saveAnalysis } from "../src/services/analysisStore.js";
import { ensureScreeningIndex } from "../src/services/mongoSupport.js";

if (!String(process.env.MONGODB_URI || "").endsWith("resume_screening_test")) {
  throw new Error("Refusing to run API tests outside resume_screening_test");
}

let server;
let base;
let sequence = 0;

const jobInput = {
  title: "Backend engineer",
  description: "Build APIs with Python, SQL, and Docker for a hiring team that reviews resumes carefully.",
  requiredSkills: ["Python", "SQL"],
  experienceRequirements: "3 years",
  educationRequirements: "",
};

function sampleResult(name, score = 70) {
  return {
    match_percentage: score,
    keyword_score: 40,
    resume_score: score,
    skill_coverage: 50,
    wording_overlap: 10,
    matched_skills: ["Python"],
    missing_skills: ["SQL"],
    recommendations: ["Skills found in the resume: Python."],
    explanation: "Keyword overlap and required-skill coverage.",
    candidate_name: name,
    candidate_name_source: "filename",
    resume_filename: `${name}.pdf`,
    extracted_text: "python experience",
    detected_skills: ["Python"],
  };
}

async function request(path, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (options.token) headers.authorization = `Bearer ${options.token}`;
  let body;
  if (options.form) body = options.form;
  else if (options.body !== undefined) {
    headers["content-type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  const response = await fetch(`${base}${path}`, { method: options.method || "GET", headers, body });
  const text = await response.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }
  return { status: response.status, data, text };
}

async function account() {
  sequence += 1;
  const response = await request("/api/auth/register", {
    method: "POST",
    body: { name: `Recruiter ${sequence}`, email: `recruiter${sequence}@example.com`, password: "test-password-1" },
  });
  assert.equal(response.status, 201);
  return response.data;
}

test.before(async () => {
  await connectDb();
  if (mongoose.connection.name !== "resume_screening_test") {
    throw new Error("Refusing to drop a database that is not resume_screening_test");
  }
  await mongoose.connection.dropDatabase();
  await ensureScreeningIndex();
  server = app.listen(0, "127.0.0.1");
  await new Promise((resolve) => server.once("listening", resolve));
  base = `http://127.0.0.1:${server.address().port}`;
});

test.after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  if (mongoose.connection.name === "resume_screening_test") await mongoose.connection.dropDatabase();
  await mongoose.disconnect();
});

test("registration, login, protected routes, and logout invalidation", async () => {
  const open = await request("/api/jobs");
  assert.equal(open.status, 401);
  const created = await account();
  const me = await request("/api/auth/me", { token: created.token });
  assert.equal(me.status, 200);
  const loggedOut = await request("/api/auth/logout", { method: "POST", token: created.token });
  assert.equal(loggedOut.status, 200);
  const again = await request("/api/auth/me", { token: created.token });
  assert.equal(again.status, 401);
  const login = await request("/api/auth/login", {
    method: "POST",
    body: { email: created.user.email, password: "test-password-1" },
  });
  assert.equal(login.status, 200);
  assert.equal((await request("/api/auth/me", { token: login.data.token })).status, 200);
});

test("one account cannot read or change another account's job", async () => {
  const owner = await account();
  const other = await account();
  const created = await request("/api/jobs", { method: "POST", token: owner.token, body: jobInput });
  assert.equal(created.status, 201);
  const id = created.data.id;
  for (const call of [
    ["/api/jobs/" + id, "GET"],
    ["/api/jobs/" + id, "PATCH"],
    ["/api/jobs/" + id + "/archive", "POST"],
    ["/api/jobs/" + id + "/export.csv", "GET"],
    ["/api/jobs/" + id, "DELETE"],
  ]) {
    const response = await request(call[0], {
      method: call[1],
      token: other.token,
      body: call[1] === "PATCH" || call[1] === "POST" ? jobInput : undefined,
    });
    assert.equal(response.status, 404, call.join(" "));
  }
  const form = new FormData();
  form.append("resumes", new Blob([Buffer.from("%PDF-1.4 sample")]), "resume.pdf");
  const screened = await request(`/api/jobs/${id}/screen`, { method: "POST", token: other.token, form });
  assert.equal(screened.status, 404);
});

test("job create, title edit, requirement edit, archive, restore, and delete", async () => {
  const user = await account();
  const created = await request("/api/jobs", { method: "POST", token: user.token, body: jobInput });
  const id = created.data.id;
  assert.equal(created.data.version, 1);
  const titled = await request(`/api/jobs/${id}`, {
    method: "PATCH",
    token: user.token,
    body: { ...jobInput, title: "Backend engineer II", baseVersion: 1 },
  });
  assert.equal(titled.status, 200);
  assert.equal(titled.data.version, 1);
  assert.equal(titled.data.requirements_changed, false);
  const edited = await request(`/api/jobs/${id}`, {
    method: "PATCH",
    token: user.token,
    body: { ...jobInput, title: "Backend engineer II", requiredSkills: ["Python", "Docker"], baseVersion: 1 },
  });
  assert.equal(edited.data.version, 2);
  assert.equal(edited.data.requirements_changed, true);
  const archived = await request(`/api/jobs/${id}/archive`, { method: "POST", token: user.token, body: { archived: true } });
  assert.equal(archived.data.archived, true);
  const restored = await request(`/api/jobs/${id}/archive`, { method: "POST", token: user.token, body: { archived: false } });
  assert.equal(restored.data.archived, false);
  const removed = await request(`/api/jobs/${id}`, { method: "DELETE", token: user.token });
  assert.equal(removed.status, 204);
  assert.equal((await request(`/api/jobs/${id}`, { token: user.token })).status, 404);
});

test("rankings and exports stay on one job version", async () => {
  const user = await account();
  const created = await request("/api/jobs", { method: "POST", token: user.token, body: jobInput });
  const id = created.data.id;
  const job = await Job.findById(id);
  await saveAnalysis({ userId: user.user.id, job, ml: sampleResult("Version One Person", 40), contentHash: "hash-one" });
  await request(`/api/jobs/${id}`, {
    method: "PATCH",
    token: user.token,
    body: { ...jobInput, requiredSkills: ["Python", "Docker"], baseVersion: 1 },
  });
  const next = await Job.findById(id);
  await saveAnalysis({ userId: user.user.id, job: next, ml: sampleResult("Version Two Person", 80), contentHash: "hash-two" });
  const current = await request(`/api/jobs/${id}`, { token: user.token });
  assert.equal(current.data.selected_version, 2);
  assert.deepEqual(current.data.rankings.map((row) => row.candidate_name), ["Version Two Person"]);
  assert.match(current.data.requirements_notice, /current version/i);
  const historical = await request(`/api/jobs/${id}?version=1`, { token: user.token });
  assert.deepEqual(historical.data.rankings.map((row) => row.candidate_name), ["Version One Person"]);
  assert.match(historical.data.historical_notice, /version 1/i);
  const exported = await request(`/api/jobs/${id}/export.csv?version=1`, { token: user.token });
  assert.equal(exported.status, 200);
  assert.match(exported.text, /Version One Person/);
  assert.doesNotMatch(exported.text, /Version Two Person/);
});

test("duplicate uploads including concurrent requests keep one analysis", async () => {
  const user = await account();
  const created = await request("/api/jobs", { method: "POST", token: user.token, body: jobInput });
  const job = await Job.findById(created.data.id);
  const ml = sampleResult("Same File");
  const [first, second] = await Promise.all([
    saveAnalysis({ userId: user.user.id, job, ml, contentHash: "same-hash" }),
    saveAnalysis({ userId: user.user.id, job, ml, contentHash: "same-hash" }),
  ]);
  assert.equal(Boolean(first.duplicate || second.duplicate), true);
  assert.equal(await Analysis.countDocuments({ jobId: job._id }), 1);
  assert.equal(await Resume.countDocuments({ userId: user.user.id, contentHash: "same-hash" }), 1);
});

test("a failed analysis save does not leave an orphan resume", async () => {
  const user = await account();
  const created = await request("/api/jobs", { method: "POST", token: user.token, body: jobInput });
  const job = await Job.findById(created.data.id);
  const before = await Resume.countDocuments({ userId: user.user.id });
  const original = Analysis.create.bind(Analysis);
  Analysis.create = async () => {
    throw new Error("forced save failure");
  };
  try {
    await assert.rejects(() => saveAnalysis({
      userId: user.user.id,
      job,
      ml: sampleResult("Will Fail"),
      contentHash: "fail-hash",
    }));
  } finally {
    Analysis.create = original;
  }
  assert.equal(await Resume.countDocuments({ userId: user.user.id }), before);
  assert.equal(await Analysis.countDocuments({ contentHash: "fail-hash" }), 0);
});

test("exported csv neutralizes formula-like candidate names", async () => {
  const user = await account();
  const created = await request("/api/jobs", { method: "POST", token: user.token, body: jobInput });
  const job = await Job.findById(created.data.id);
  await saveAnalysis({
    userId: user.user.id,
    job,
    ml: sampleResult("=1+1"),
    contentHash: "formula-hash",
  });
  const exported = await request(`/api/jobs/${created.data.id}/export.csv`, { token: user.token });
  assert.match(exported.text.replace(/^\uFEFF/, ""), /'=1\+1/);
});

test("scoring outage, version conflict, readiness, and database outage", async () => {
  const user = await account();
  const created = await request("/api/jobs", { method: "POST", token: user.token, body: jobInput });
  const form = new FormData();
  form.append("resumes", new Blob([Buffer.from("%PDF-1.4\nnot really")]), "resume.pdf");
  form.append("expected_version", "1");
  const screened = await request(`/api/jobs/${created.data.id}/screen`, { method: "POST", token: user.token, form });
  assert.equal(screened.status, 503);
  assert.match(screened.data.error, /temporarily unavailable/i);

  const conflict = new FormData();
  conflict.append("resumes", new Blob([Buffer.from("%PDF-1.4\nnot really")]), "resume.pdf");
  conflict.append("expected_version", "9");
  const blocked = await request(`/api/jobs/${created.data.id}/screen`, { method: "POST", token: user.token, form: conflict });
  assert.equal(blocked.status, 409);

  assert.equal((await request("/api/health/live")).status, 200);
  const down = await request("/api/health/ready");
  assert.equal(down.status, 503);
  assert.equal(down.data.status, "unavailable");

  const stub = http.createServer((_req, response) => {
    response.writeHead(503, { "content-type": "application/json" });
    response.end(JSON.stringify({ status: "degraded", ready: false, scoring: "keyword_only" }));
  });
  await new Promise((resolve) => stub.listen(0, "127.0.0.1", resolve));
  process.env.ML_SERVICE_URL = `http://127.0.0.1:${stub.address().port}`;
  const degraded = await request("/api/health/ready");
  assert.equal(degraded.status, 503);
  assert.equal(degraded.data.status, "degraded");
  assert.equal(degraded.data.scoring, "keyword_only");
  process.env.ML_SERVICE_URL = "http://127.0.0.1:9";
  await new Promise((resolve) => stub.close(resolve));

  await mongoose.disconnect();
  const unavailable = await request("/api/jobs", { token: user.token });
  assert.equal(unavailable.status, 503);
  assert.match(unavailable.data.error, /temporarily unavailable/i);
  assert.equal((await request("/api/health/live")).status, 200);
  await connectDb();
});

test("invalid scoring payloads are rejected before they are stored", async () => {
  const user = await account();
  const created = await request("/api/jobs", { method: "POST", token: user.token, body: jobInput });
  const job = await Job.findById(created.data.id);
  const before = await Analysis.countDocuments({ jobId: job._id });
  await assert.rejects(() => saveAnalysis({
    userId: user.user.id,
    job,
    ml: { ...sampleResult("Bad"), match_percentage: 140, matched_skills: ["Python"], missing_skills: ["Python"] },
    contentHash: "bad-score",
  }));
  assert.equal(await Analysis.countDocuments({ jobId: job._id }), before);
});
