import mongoose from "mongoose";
import { Analysis } from "../models/Analysis.js";
import { Job } from "../models/Job.js";
import { presentRanking } from "../utils/present.js";

export async function dashboard(req, res) {
  const userId = new mongoose.Types.ObjectId(req.user.id);
  const [totalJobs, totalResumes, averageRows, recent, top] = await Promise.all([
    Job.countDocuments({ userId }),
    Analysis.countDocuments({ userId }),
    Analysis.aggregate([
      { $match: { userId } },
      { $group: { _id: null, average: { $avg: "$matchScore" } } },
    ]),
    Analysis.find({ userId }).sort({ createdAt: -1 }).limit(5)
      .populate("resumeId", "originalName")
      .populate("jobId", "title"),
    Analysis.find({ userId }).sort({ resumeScore: -1, matchScore: -1 }).limit(5)
      .populate("resumeId", "originalName")
      .populate("jobId", "title"),
  ]);

  const average = averageRows[0]?.average;
  res.json({
    note: "Match scores are only comparable within one job version.",
    totalJobs,
    totalResumes,
    averageMatchScore: average == null ? null : Math.round(average * 10) / 10,
    recentAnalyses: recent.map((row) => presentRanking(row)),
    topCandidates: top.map((row) => presentRanking(row)),
  });
}
