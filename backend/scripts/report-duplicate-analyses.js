/**
 * Report duplicate screenings. Does not delete anything unless --apply is passed.
 *
 * A duplicate is the same user, job, file hash, and job version.
 * --apply keeps the oldest analysis in each group and deletes the later ones
 * and their resume rows. Run this only after a backup. It refuses any database
 * name other than the one you pass with --database, and it never rewrites history.
 *
 *   node scripts/report-duplicate-analyses.js
 *   node scripts/report-duplicate-analyses.js --apply --database resume_screening
 */
import mongoose from "mongoose";
import { Analysis } from "../src/models/Analysis.js";
import { Resume } from "../src/models/Resume.js";
import { env } from "../src/config/env.js";

const apply = process.argv.includes("--apply");
const databaseFlag = process.argv.indexOf("--database");
const expectedDatabase = databaseFlag >= 0 ? process.argv[databaseFlag + 1] : "";

if (!env.mongoUri) {
  console.error("MONGODB_URI is not set.");
  process.exit(1);
}

await mongoose.connect(env.mongoUri);
const name = mongoose.connection.name;
if (apply && name !== expectedDatabase) {
  console.error("Refusing to delete duplicates. Pass --database with the exact database name after a backup.");
  await mongoose.disconnect();
  process.exit(1);
}

const groups = await Analysis.aggregate([
  { $match: { contentHash: { $gt: "" } } },
  { $sort: { createdAt: 1 } },
  {
    $group: {
      _id: {
        userId: "$userId",
        jobId: "$jobId",
        contentHash: "$contentHash",
        version: "$jobSnapshot.version",
      },
      ids: { $push: "$_id" },
      resumes: { $push: "$resumeId" },
      count: { $sum: 1 },
    },
  },
  { $match: { count: { $gt: 1 } } },
]);

console.log(`Duplicate groups: ${groups.length}. Database: ${name}.`);
for (const group of groups) {
  console.log(`group size ${group.count}; keeping ${group.ids[0]}; extra analyses ${group.ids.length - 1}`);
  if (!apply) continue;
  const extraAnalyses = group.ids.slice(1);
  const extraResumes = group.resumes.slice(1).filter(Boolean);
  await Analysis.deleteMany({ _id: { $in: extraAnalyses } });
  if (extraResumes.length) await Resume.deleteMany({ _id: { $in: extraResumes } });
}

if (!apply && groups.length) {
  console.log("No rows were deleted. Re-run with --apply --database <name> after a backup to keep the oldest row in each group.");
}

await mongoose.disconnect();
