import mongoose from "mongoose";

const analysisSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    jobId: { type: mongoose.Schema.Types.ObjectId, ref: "Job", default: null },
    resumeId: { type: mongoose.Schema.Types.ObjectId, ref: "Resume", required: true },
    candidateName: { type: String, default: "" },
    nameSource: { type: String, enum: ["filename", "recruiter"], default: "filename" },
    matchScore: { type: Number, required: true },
    keywordScore: { type: Number, default: 0 },
    semanticScore: { type: Number, default: 0 },
    resumeScore: { type: Number, required: true },
    skillCoverage: { type: Number, default: null },
    wordingOverlap: { type: Number, default: null },
    modelSignal: { type: Number, default: null },
    matchedSkills: { type: [String], default: [] },
    missingSkills: { type: [String], default: [] },
    recommendations: { type: [String], default: [] },
    explanation: { type: String, default: "" },
    contentHash: { type: String, default: "" },
    jobSnapshot: { type: mongoose.Schema.Types.Mixed, default: null },
    modelVersion: { type: String, default: "" },
    result: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

analysisSchema.index({ userId: 1, createdAt: -1 });
analysisSchema.index({ jobId: 1, resumeScore: -1, matchScore: -1 });

export const Analysis = mongoose.model("Analysis", analysisSchema);
