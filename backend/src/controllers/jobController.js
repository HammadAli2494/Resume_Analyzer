import crypto from "crypto";
import mongoose from "mongoose";
import { Analysis } from "../models/Analysis.js";
import { Job } from "../models/Job.js";
import { deleteJobRecords, findDuplicate, saveAnalysis } from "../services/analysisStore.js";
import { analyzeFile } from "../services/mlClient.js";
import { httpError } from "../utils/httpError.js";
import { csvEscape, presentJob, presentRanking } from "../utils/present.js";

function clean(value, max) {
  return String(value ?? "").replace(/\0/g, "").trim().slice(0, max);
}

function parseSkills(value) {
  const source = Array.isArray(value) ? value : String(value ?? "").split(",");
  const skills = [];
  const seen = new Set();
  for (const item of source) {
    const skill = clean(item, 60);
    const key = skill.toLowerCase();
    if (!skill || seen.has(key)) continue;
    seen.add(key);
    skills.push(skill);
    if (skills.length === 40) break;
  }
  return skills;
}

function readJobInput(body) {
  const title = clean(body.title, 200);
  const description = clean(body.description, 20000);
  const requiredSkills = parseSkills(body.requiredSkills ?? body.required_skills);
  const experienceRequirements = clean(body.experienceRequirements ?? body.experience_requirements, 2000);
  const educationRequirements = clean(body.educationRequirements ?? body.education_requirements, 2000);

  if (title.length < 2) throw httpError(400, "Enter a job title.");
  if (description.length < 20) throw httpError(400, "Describe the job in at least a few sentences.");
  if (!requiredSkills.length) throw httpError(400, "Add at least one required skill.");
  if (experienceRequirements.length < 2) throw httpError(400, "Describe the experience requirement.");

  return { title, description, requiredSkills, experienceRequirements, educationRequirements };
}

function sameRequirements(job, input) {
  const list = (skills) => [...(skills || [])].map((item) => item.trim().toLowerCase()).filter(Boolean).sort().join("\n");
  return job.description === input.description
    && (job.experienceRequirements || "") === input.experienceRequirements
    && (job.educationRequirements || "") === input.educationRequirements
    && list(job.requiredSkills) === list(input.requiredSkills);
}

function versionFilter(jobId, userId, version) {
  const versionClause = version === 1
    ? { $or: [{ "jobSnapshot.version": 1 }, { "jobSnapshot.version": { $exists: false } }, { jobSnapshot: null }] }
    : { "jobSnapshot.version": version };
  return { jobId, userId, ...versionClause };
}

function pageLimit(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 50));
  return { page, limit };
}

async function currentCounts(userId, jobs) {
  if (!jobs.length) return new Map();
  const rows = await Analysis.aggregate([
    { $match: { userId: new mongoose.Types.ObjectId(userId), jobId: { $in: jobs.map((job) => job._id) } } },
    { $group: { _id: { jobId: "$jobId", version: "$jobSnapshot.version" }, count: { $sum: 1 } } },
  ]);
  const map = new Map();
  for (const job of jobs) {
    const version = job.version || 1;
    const row = rows.find((item) => String(item._id.jobId) === String(job._id) && (item._id.version || 1) === version);
    map.set(String(job._id), row?.count || 0);
  }
  return map;
}

async function ownedJob(userId, jobId) {
  const job = await Job.findOne({ _id: jobId, userId });
  if (!job) throw httpError(404, "Job not found.");
  return job;
}

export async function listJobs(req, res) {
  const archived = req.query.archived === "true";
  const jobs = await Job.find({ userId: req.user.id, archived }).sort({ updatedAt: -1 }).limit(100);
  const counts = await currentCounts(req.user.id, jobs);
  res.json(jobs.map((job) => presentJob(job, counts.get(String(job._id)) || 0)));
}

export async function createJob(req, res) {
  const input = readJobInput(req.body);
  const job = await Job.create({ userId: req.user.id, ...input, version: 1, archived: false });
  res.status(201).json(presentJob(job, 0));
}

export async function updateJob(req, res) {
  const job = await ownedJob(req.user.id, req.params.id);
  const base = req.body.baseVersion ?? req.body.base_version;
  if (base !== undefined && base !== "" && Number(base) !== job.version) {
    throw httpError(409, "This job was updated. Refresh the page before saving.");
  }
  const input = readJobInput({
    ...job.toObject(),
    ...req.body,
    requiredSkills: req.body.requiredSkills ?? req.body.required_skills ?? job.requiredSkills,
  });
  const changed = !sameRequirements(job, input);
  const nextVersion = changed ? (job.version || 1) + 1 : (job.version || 1);
  const updated = await Job.findOneAndUpdate(
    { _id: job._id, userId: req.user.id, version: job.version },
    { $set: { ...input, version: nextVersion } },
    { new: true }
  );
  if (!updated) throw httpError(409, "This job was updated. Refresh the page before saving.");
  const count = await Analysis.countDocuments(versionFilter(updated._id, req.user.id, updated.version));
  const body = presentJob(updated, count);
  body.requirements_changed = changed;
  body.requirements_notice = changed
    ? "Requirements changed. Earlier results stay saved under the previous version and are not mixed into this ranking. Analyze resumes again to score them against the current requirements."
    : "";
  res.json(body);
}

export async function archiveJob(req, res) {
  const job = await ownedJob(req.user.id, req.params.id);
  job.archived = req.body?.archived !== false;
  await job.save();
  const count = await Analysis.countDocuments(versionFilter(job._id, req.user.id, job.version || 1));
  res.json(presentJob(job, count));
}

async function versionList(job) {
  const stored = await Analysis.distinct("jobSnapshot.version", { jobId: job._id, userId: job.userId });
  const versions = stored.filter((item) => Number.isInteger(item));
  if (!versions.includes(job.version || 1)) versions.push(job.version || 1);
  return [...new Set(versions)].sort((a, b) => a - b);
}

export async function getJob(req, res) {
  const job = await ownedJob(req.user.id, req.params.id);
  const selected = req.query.version ? Number(req.query.version) : (job.version || 1);
  if (!Number.isInteger(selected) || selected < 1) throw httpError(400, "Choose a valid results version.");
  const { page, limit } = pageLimit(req.query);
  const filter = versionFilter(job._id, req.user.id, selected);
  const [total, rankings, versions, older] = await Promise.all([
    Analysis.countDocuments(filter),
    Analysis.find(filter)
      .sort({ matchScore: -1, createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("resumeId", "originalName"),
    versionList(job),
    Analysis.countDocuments({
      jobId: job._id,
      userId: req.user.id,
      "jobSnapshot.version": { $nin: [job.version || 1, null] },
    }),
  ]);
  const currentCount = await Analysis.countDocuments(versionFilter(job._id, req.user.id, job.version || 1));
  const data = presentJob(job, currentCount);
  data.selected_version = selected;
  data.versions = versions;
  data.rankings_total = total;
  data.page = page;
  data.limit = limit;
  data.older_version_count = older;
  data.requirements_notice = selected === (job.version || 1) && older
    ? "Requirements changed. This ranking is only the current version. Earlier results are kept separately. Analyze those resumes again before comparing them with the current requirements."
    : "";
  data.historical_notice = selected !== (job.version || 1)
    ? `Showing version ${selected}. These scores use that version's requirements and are not mixed with version ${job.version || 1}.`
    : "";
  data.rankings = rankings.map((item) => {
    const row = presentRanking(item);
    if (selected === (job.version || 1)) row.job_title = job.title;
    return row;
  });
  res.json(data);
}

export async function deleteJob(req, res) {
  const job = await ownedJob(req.user.id, req.params.id);
  await deleteJobRecords(job);
  res.status(204).end();
}

export async function renameCandidate(req, res) {
  const job = await ownedJob(req.user.id, req.params.id);
  const name = clean(req.body.candidateName ?? req.body.candidate_name, 120);
  if (name.length < 2) throw httpError(400, "Enter a candidate name.");
  const analysis = await Analysis.findOne({ _id: req.params.analysisId, jobId: job._id, userId: req.user.id })
    .populate("resumeId", "originalName");
  if (!analysis) throw httpError(404, "Result not found.");
  analysis.candidateName = name;
  analysis.nameSource = "recruiter";
  analysis.result = { ...(analysis.result || {}), candidate_name: name, candidate_name_source: "recruiter" };
  analysis.markModified("result");
  await analysis.save();
  res.json(presentRanking(analysis));
}

function assertResumeBytes(file) {
  const name = String(file.originalname || "").toLowerCase();
  const data = file.buffer;
  if (!data?.length) throw httpError(400, "The uploaded file is empty.");
  const pdf = name.endsWith(".pdf");
  const docx = name.endsWith(".docx");
  if (!pdf && !docx) throw httpError(400, "Invalid resume format. Upload a PDF or DOCX file.");
  if (pdf && !data.subarray(0, 4).equals(Buffer.from("%PDF"))) {
    throw httpError(400, "We could not read this file. Upload a text-based PDF or DOCX.");
  }
  if (docx && (data[0] !== 0x50 || data[1] !== 0x4b)) {
    throw httpError(400, "We could not read this file. Upload a text-based PDF or DOCX.");
  }
}

async function screenOne(userId, job, file) {
  assertResumeBytes(file);
  const contentHash = crypto.createHash("sha256").update(file.buffer).digest("hex");
  const existing = await findDuplicate(userId, job, contentHash);
  if (existing) return { ...presentRanking(existing), duplicate: true };
  const ml = await analyzeFile(file, job);
  const saved = await saveAnalysis({ userId, job, ml, contentHash });
  if (saved.duplicate) return { ...presentRanking(saved.analysis), duplicate: true };
  return presentRanking({
    ...saved.analysis.toObject(),
    resumeId: saved.resume,
    jobSnapshot: saved.analysis.jobSnapshot,
    nameSource: saved.analysis.nameSource,
  });
}

export async function screenJob(req, res) {
  const job = await ownedJob(req.user.id, req.params.id);
  if (job.archived) throw httpError(400, "Restore this job before screening resumes.");
  const expected = req.body.expected_version ?? req.body.expectedVersion;
  if (expected !== undefined && expected !== "" && Number(expected) !== (job.version || 1)) {
    throw httpError(409, "This job's requirements changed. Analyze the remaining resumes again so the whole batch uses one version.");
  }
  const files = req.files?.length ? req.files : (req.file ? [req.file] : []);
  if (!files.length) throw httpError(400, "Upload at least one resume (PDF or DOCX).");

  const rankings = [];
  const errors = [];
  let stopped = false;
  for (const file of files) {
    const current = await Job.findOne({ _id: job._id, userId: req.user.id }).select("version");
    if ((current?.version || 1) !== (job.version || 1)) {
      stopped = true;
      errors.push({
        file: file.originalname,
        error: "This job's requirements changed. Analyze the remaining resumes again so the whole batch uses one version.",
      });
      break;
    }
    try {
      rankings.push(await screenOne(req.user.id, job, file));
    } catch (error) {
      errors.push({
        file: file.originalname,
        error: error.expose ? error.message : "We could not read this file. Upload a text-based PDF or DOCX.",
      });
    }
  }

  rankings.sort((a, b) => b.match_percentage - a.match_percentage);
  if (stopped && !rankings.length) {
    return res.status(409).json({
      error: "This job's requirements changed. Analyze the remaining resumes again so the whole batch uses one version.",
      errors,
      rankings,
    });
  }
  if (!rankings.length && errors.length) {
    const unavailable = errors.every((item) => /temporarily unavailable/i.test(item.error));
    return res.status(unavailable ? 503 : 400).json({
      error: unavailable
        ? "Analysis is temporarily unavailable. Please try again."
        : errors[0].error,
      errors,
    });
  }

  const status = stopped ? 409 : 200;
  res.status(status).json({
    job_id: job._id,
    job_title: job.title,
    job_version: job.version,
    screened: rankings.length,
    failed: errors.length,
    rankings,
    errors,
    error: stopped
      ? "This job's requirements changed. Analyze the remaining resumes again so the whole batch uses one version."
      : undefined,
  });
}

export async function exportJobCsv(req, res) {
  const job = await ownedJob(req.user.id, req.params.id);
  const selected = req.query.version ? Number(req.query.version) : (job.version || 1);
  if (!Number.isInteger(selected) || selected < 1) throw httpError(400, "Choose a valid results version.");
  const rankings = await Analysis.find(versionFilter(job._id, req.user.id, selected))
    .sort({ matchScore: -1, createdAt: 1 })
    .limit(1000)
    .populate("resumeId", "originalName");

  const header = [
    "Rank", "Candidate", "Filename", "Job match", "Keyword overlap",
    "Skill coverage", "Matched skills", "Missing skills", "Notes", "Job version",
  ];
  const lines = [header.join(",")];
  rankings.forEach((item, index) => {
    const row = presentRanking(item);
    lines.push([
      index + 1,
      row.candidate_name,
      row.resume_filename,
      row.match_percentage,
      row.keyword_score,
      row.skill_coverage ?? "Not specified",
      (row.matched_skills || []).join("; "),
      (row.missing_skills || []).join("; "),
      (row.recommendations || []).join(" | "),
      row.job_version ?? "",
    ].map(csvEscape).join(","));
  });

  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="rankings-v${selected}.csv"`);
  res.send(`\uFEFF${lines.join("\n")}`);
}
