import mongoose from "mongoose";
import { Analysis } from "../models/Analysis.js";

let transactions = null;

export async function transactionsSupported() {
  if (transactions != null) return transactions;
  try {
    const info = await mongoose.connection.db.command({ hello: 1 });
    transactions = Boolean(info.setName || info.msg === "isdbgrid");
  } catch {
    transactions = false;
  }
  return transactions;
}

export async function ensureScreeningIndex() {
  const groups = await Analysis.aggregate([
    { $match: { contentHash: { $gt: "" } } },
    {
      $group: {
        _id: {
          userId: "$userId",
          jobId: "$jobId",
          contentHash: "$contentHash",
          version: "$jobSnapshot.version",
        },
        count: { $sum: 1 },
      },
    },
    { $match: { count: { $gt: 1 } } },
    { $count: "groups" },
  ]);
  const duplicates = groups[0]?.groups || 0;
  if (duplicates) {
    console.warn(
      `Found ${duplicates} duplicate screening groups. The unique index was not created and no rows were deleted. See backend/scripts/report-duplicate-analyses.js.`
    );
    return false;
  }
  await Analysis.collection.createIndex(
    { userId: 1, jobId: 1, contentHash: 1, "jobSnapshot.version": 1 },
    {
      unique: true,
      name: "uniq_user_job_version_hash",
      partialFilterExpression: { contentHash: { $type: "string", $gt: "" } },
    }
  );
  return true;
}
