import { Router } from "express";
import { authenticate, type AuthRequest } from "../middleware/authMiddleware";
import { sendError, handleServerError } from "../lib/api";
import { CertificateSubmissionModel } from "../models/CertificateSubmission";
import { InstituteModel } from "../models/Institute";
import { isValidObjectId } from "../lib/validation";
import { instituteHasVerifierAddress } from "../lib/reviewers";
import { hasEncryptedEvidence, readEncryptedEvidence } from "../services/evidenceVault";
import {
  analyseCertificate,
  buildFallbackCertificateInsight,
  summarizeGeminiFailure,
} from "../services/geminiAnalyser";

/**
 * Authenticated private-evidence download and analysis routes.
 */
const router = Router();
const EVIDENCE_UNAVAILABLE_MESSAGE =
  "The private evidence file is no longer available for this submission. Re-upload the credential evidence before reviewing it.";

/**
 * Returns the encrypted evidence payload for a submission the caller can access.
 *
 * Auth: bearer token required
 * Input: `submissionId` route param
 * Errors: `UNAUTHORIZED`, `VALIDATION_ERROR`, `SUBMISSION_NOT_FOUND`, `FORBIDDEN`
 */
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

    if (!(await hasEncryptedEvidence(submission.privateEvidenceRef))) {
      return sendError(
        res,
        409,
        "EVIDENCE_UNAVAILABLE",
        EVIDENCE_UNAVAILABLE_MESSAGE
      );
    }

    const evidenceBuffer = await readEncryptedEvidence(submission.privateEvidenceRef);
    const disposition =
      req.query.download === "1" ? "attachment" : "inline";

    res.setHeader("Cache-Control", "private, no-store");
    const safeFileName = submission.fileName.replace(/["\r\n]/g, "");

    res.setHeader(
      "Content-Disposition",
      `${disposition}; filename="${safeFileName}"`
    );
    res.type(submission.mimeType);
    return res.send(evidenceBuffer);
  } catch (error) {
    return handleServerError(res, error, "Could not load evidence");
  }
});

/**
 * Runs server-side AI analysis for a pending submission's private evidence bundle.
 *
 * Auth: admin JWT required
 * Input: `submissionId` route param
 * Errors: `UNAUTHORIZED`, `FORBIDDEN`, `VALIDATION_ERROR`, `SUBMISSION_NOT_FOUND`, `INVALID_STATUS`
 */
router.post("/:submissionId/analyse", authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return sendError(res, 401, "UNAUTHORIZED", "You must be signed in");
    }

    if (req.user.role !== "admin") {
      return sendError(res, 403, "FORBIDDEN", "Admin access required");
    }

    const submissionId = String(req.params.submissionId);

    if (!isValidObjectId(submissionId)) {
      return sendError(res, 400, "VALIDATION_ERROR", "Invalid submission id");
    }

    const submission = await CertificateSubmissionModel.findById(submissionId)
      .select(
        "status privateEvidenceRef mimeType instituteName courseName credentialType aiInsight"
      )
      .lean();

    if (!submission) {
      return sendError(res, 404, "SUBMISSION_NOT_FOUND", "Submission not found");
    }

    if (submission.status !== "pending_review") {
      return sendError(
        res,
        400,
        "INVALID_STATUS",
        "Only pending submissions can be analysed"
      );
    }

    // Return cached insight if available (unless ?refresh=1 forces re-analysis)
    if (submission.aiInsight && req.query?.refresh !== "1") {
      return res.json(submission.aiInsight);
    }

    if (!(await hasEncryptedEvidence(submission.privateEvidenceRef))) {
      return sendError(
        res,
        409,
        "EVIDENCE_UNAVAILABLE",
        EVIDENCE_UNAVAILABLE_MESSAGE
      );
    }

    const evidenceBuffer = await readEncryptedEvidence(submission.privateEvidenceRef);
    try {
      const insight = await analyseCertificate(evidenceBuffer, submission.mimeType);

      // Cache the successful insight on the submission
      await CertificateSubmissionModel.updateOne(
        { _id: submissionId },
        { $set: { aiInsight: insight } }
      );

      return res.json(insight);
    } catch (error) {
      const failure = summarizeGeminiFailure(error);

      console.warn(
        `[AI Analysis Fallback] submission=${submissionId} reason=${failure.code}${
          failure.retryAfterSeconds !== null
            ? ` retryAfterSeconds=${failure.retryAfterSeconds}`
            : ""
        }`
      );

      return res.json(
        buildFallbackCertificateInsight({
          institution: submission.instituteName ?? null,
          courseName: submission.courseName ?? null,
          credentialType: submission.credentialType ?? null,
          warning: failure.message,
        })
      );
    }
  } catch (error) {
    return sendError(
      res,
      503,
      "AI_ANALYSIS_UNAVAILABLE",
      "AI analysis is temporarily unavailable. Continue the review manually."
    );
  }
});

export default router;
