import { Router } from "express";
import {
  archiveJob,
  createJob,
  deleteJob,
  exportJobCsv,
  getJob,
  listJobs,
  renameCandidate,
  screenJob,
  updateJob,
} from "../controllers/jobController.js";
import { requireAuth } from "../middleware/auth.js";
import { requireObjectId } from "../middleware/objectId.js";
import { requireDb } from "../middleware/requireDb.js";
import { upload, uploadError } from "../middleware/upload.js";
import { asyncHandler } from "../utils/asyncHandler.js";

const router = Router();
router.use(requireDb, requireAuth);
router.get("/", asyncHandler(listJobs));
router.post("/", asyncHandler(createJob));
router.get("/:id/export.csv", requireObjectId(), asyncHandler(exportJobCsv));
router.post("/:id/screen", requireObjectId(), upload.array("resumes", 10), uploadError, asyncHandler(screenJob));
router.patch("/:id/analyses/:analysisId", requireObjectId(), requireObjectId("analysisId"), asyncHandler(renameCandidate));
router.post("/:id/archive", requireObjectId(), asyncHandler(archiveJob));
router.get("/:id", requireObjectId(), asyncHandler(getJob));
router.patch("/:id", requireObjectId(), asyncHandler(updateJob));
router.delete("/:id", requireObjectId(), asyncHandler(deleteJob));

export default router;
