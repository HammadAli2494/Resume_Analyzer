import mongoose from "mongoose";

const resumeSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    originalName: { type: String, required: true, maxlength: 180 },
    contentHash: { type: String, default: "", index: true },
    extractedText: { type: String, default: "" },
    skills: { type: [String], default: [] },
    uploadedAt: { type: Date, default: Date.now },
  },
  { timestamps: false }
);

resumeSchema.index({ userId: 1, uploadedAt: -1 });

export const Resume = mongoose.model("Resume", resumeSchema);
