import mongoose from "mongoose";

const jobSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, required: true, maxlength: 20000 },
    requiredSkills: { type: [String], default: [] },
    experienceRequirements: { type: String, default: "", maxlength: 2000 },
    educationRequirements: { type: String, default: "", maxlength: 2000 },
    version: { type: Number, default: 1 },
    archived: { type: Boolean, default: false, index: true },
  },
  { timestamps: true }
);

jobSchema.index({ userId: 1, createdAt: -1 });

export const Job = mongoose.model("Job", jobSchema);
