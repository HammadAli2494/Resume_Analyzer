import mongoose from "mongoose";
import { Analysis } from "../models/Analysis.js";
import { Resume } from "../models/Resume.js";
import { httpError } from "../utils/httpError.js";
import { jobSnapshot } from "../utils/present.js";
import { transactionsSupported } from "./mongoSupport.js";

function clientResult(ml, extras = {}) {
  const copy = { ...ml, ...extras };
  delete copy.extracted_text;
  return copy;
}

function stringList(value) {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item).replace(/\0/g, "").trim()).filter(Boolean).slice(0, 40);
}

export function assertMlResult(ml) {
  if (!ml || typeof ml !== "object" || Array.isArray(ml)) {
    throw httpError(502, "Analysis is temporarily unavailable. Please try again.");
  }
  const score = Number(ml.match_percentage);
  if (!Number.isFinite(score) || score < 0 || score > 100) {
    console.error("Rejected scoring response because the match percentage was invalid.");
    throw httpError(502, "Analysis is temporarily unavailable. Please try again.");
  }
  const matched = stringList(ml.matched_skills);
  const missing = stringList(ml.missing_skills);
  const seen = new Set(matched.map((item) => item.toLowerCase()));
  if (missing.some((item) => seen.has(item.toLowerCase()))) {
    console.error("Rejected scoring response because matched and missing skills overlapped.");
    throw httpError(502, "Analysis is temporarily unavailable. Please try again.");
  }
  return {
    ...ml,
    match_percentage: Math.round(score * 10) / 10,
    matched_skills: matched,
    missing_skills: missing,
    keyword_score: Number.isFinite(Number(ml.keyword_score)) ? Number(ml.keyword_score) : 0,
    resume_score: Number.isFinite(Number(ml.resume_score)) ? Number(ml.resume_score) : Math.round(score),
  };
}

export async function findDuplicate(userId, job, contentHash) {
  if (!contentHash) return null;
  return Analysis.findOne({
    userId,
    jobId: job._id,
    contentHash,
    "jobSnapshot.version": job.version || 1,
  }).populate("resumeId", "originalName");
}

function resumeFields(userId, ml, contentHash) {
  return {
    userId,
    originalName: String(ml.resume_filename || "resume").slice(0, 180),
    contentHash,
    extractedText: String(ml.extracted_text || "").slice(0, 50000),
    skills: stringList(ml.detected_skills),
  };
}

function analysisFields(userId, job, ml, contentHash, resumeId) {
  const snapshot = jobSnapshot(job);
  return {
    userId,
    jobId: job._id,
    resumeId,
    candidateName: String(ml.candidate_name || "").slice(0, 120),
    nameSource: ml.candidate_name_source === "recruiter" ? "recruiter" : "filename",
    matchScore: ml.match_percentage,
    keywordScore: ml.keyword_score,
    wordingOverlap: ml.wording_overlap,
    modelSignal: ml.model_signal ?? null,
    resumeScore: ml.resume_score,
    skillCoverage: ml.skill_coverage,
    matchedSkills: ml.matched_skills,
    missingSkills: ml.missing_skills,
    recommendations: stringList(ml.recommendations),
    explanation: String(ml.explanation || "").slice(0, 4000),
    contentHash,
    jobSnapshot: snapshot,
    modelVersion: String(ml.ml_model_version || ""),
    result: clientResult(ml, { saved: true }),
  };
}

async function existingDuplicate(userId, job, contentHash) {
  const existing = await findDuplicate(userId, job, contentHash);
  if (!existing) return null;
  return { analysis: existing, resume: existing.resumeId, duplicate: true };
}

export async function saveAnalysis({ userId, job, ml, contentHash = "" }) {
  const checked = assertMlResult(ml);
  const already = await existingDuplicate(userId, job, contentHash);
  if (already) return already;

  if (await transactionsSupported()) {
    const session = await mongoose.startSession();
    try {
      let created = null;
      await session.withTransaction(async () => {
        const [resume] = await Resume.create([resumeFields(userId, checked, contentHash)], { session });
        const [analysis] = await Analysis.create(
          [analysisFields(userId, job, checked, contentHash, resume._id)],
          { session }
        );
        created = { analysis, resume, duplicate: false };
      });
      return created;
    } catch (error) {
      if (error?.code === 11000) {
        const duplicate = await existingDuplicate(userId, job, contentHash);
        if (duplicate) return duplicate;
      }
      throw error;
    } finally {
      await session.endSession();
    }
  }

  const resume = await Resume.create(resumeFields(userId, checked, contentHash));
  try {
    const analysis = await Analysis.create(analysisFields(userId, job, checked, contentHash, resume._id));
    return { analysis, resume, duplicate: false };
  } catch (error) {
    await Resume.deleteOne({ _id: resume._id, userId });
    if (error?.code === 11000) {
      const duplicate = await existingDuplicate(userId, job, contentHash);
      if (duplicate) return duplicate;
    }
    throw error;
  }
}

export async function deleteJobRecords(job) {
  const analyses = await Analysis.find({ jobId: job._id, userId: job.userId }).select("resumeId");
  const resumeIds = analyses.map((item) => item.resumeId).filter(Boolean);
  const filter = { jobId: job._id, userId: job.userId };

  if (await transactionsSupported()) {
    const session = await mongoose.startSession();
    try {
      await session.withTransaction(async () => {
        await Analysis.deleteMany(filter).session(session);
        if (resumeIds.length) await Resume.deleteMany({ _id: { $in: resumeIds }, userId: job.userId }).session(session);
        await job.deleteOne({ session });
      });
      return;
    } finally {
      await session.endSession();
    }
  }

  await Analysis.deleteMany(filter);
  if (resumeIds.length) await Resume.deleteMany({ _id: { $in: resumeIds }, userId: job.userId });
  await job.deleteOne();
}
