import { Router } from "express";
import { authenticate, type AuthRequest } from "../middleware/authMiddleware";
import { sendError, handleServerError } from "../lib/api";
import { CertificateSubmissionModel } from "../models/CertificateSubmission";
import { InstituteModel } from "../models/Institute";
import { isValidObjectId } from "../lib/validation";
import { instituteHasVerifierAddress } from "../lib/reviewers";
import { readEncryptedEvidence } from "../services/evidenceVault";

const router = Router();

router.get("/:submissionId", authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return sendError(res, 401, "UNAUTHORIZED", "You must be signed in");
    }

    const submissionId = String(req.params.submissionId);

    if (!isValidObjectId(submissionId)) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Invalid submission id"
      );
    }

    const submission = await CertificateSubmissionModel.findById(submissionId)
      .select(
        "studentAddress instituteId privateEvidenceRef fileName mimeType"
      )
      .lean();

    if (!submission) {
      return sendError(
        res,
        404,
        "SUBMISSION_NOT_FOUND",
        "Submission not found"
      );
    }

    const institute =
      req.user.role === "admin" || req.user.address === submission.studentAddress
        ? null
        : await InstituteModel.findById(submission.instituteId)
            .select("verifierAddresses")
            .lean();

    const canAccess =
      req.user.role === "admin" ||
      req.user.address === submission.studentAddress ||
      instituteHasVerifierAddress(institute?.verifierAddresses, req.user.address);

    if (!canAccess) {
      return sendError(res, 403, "FORBIDDEN", "Forbidden");
    }

    const evidenceBuffer = await readEncryptedEvidence(submission.privateEvidenceRef);
    const disposition =
      req.query.download === "1" ? "attachment" : "inline";

    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${submission.fileName.replace(/"/g, "")}"`
    );
    res.type(submission.mimeType);
    return res.send(evidenceBuffer);
  } catch (error) {
    return handleServerError(res, error, "Could not load evidence");
  }
});

export default router;
