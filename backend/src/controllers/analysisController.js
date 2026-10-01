import { Analysis } from "../models/Analysis.js";
import { presentRanking } from "../utils/present.js";

function pageLimit(query) {
  const page = Math.max(1, Number(query.page) || 1);
  const limit = Math.min(50, Math.max(1, Number(query.limit) || 50));
  return { page, limit };
}

export async function history(req, res) {
  const { page, limit } = pageLimit(req.query);
  const filter = { userId: req.user.id };
  const [total, rows] = await Promise.all([
    Analysis.countDocuments(filter),
    Analysis.find(filter)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate("resumeId", "originalName")
      .populate("jobId", "title"),
  ]);
  res.json({
    results: rows.map((row) => presentRanking(row)),
    page,
    limit,
    total,
  });
}
