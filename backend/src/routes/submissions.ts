import { Router } from "express";
import { sendError, sendSuccess, handleServerError } from "../lib/api";
import { createAuditTrailEvent } from "../lib/audit";
import { CertificateSubmissionModel } from "../models/CertificateSubmission";
import { authenticate, authorize, type AuthRequest } from "../middleware/authMiddleware";
import { isOptionalString, isValidObjectId } from "../lib/validation";
import { buildReviewerSubmissionScope, assertInstituteReviewerAccess } from "../lib/reviewers";
import { toSubmissionResponse } from "../lib/submissionResponses";

const router = Router();

router.get("/", authenticate, authorize("admin", "verifier"), async (req: AuthRequest, res) => {
  try {
    const reviewerScope = await buildReviewerSubmissionScope(req.user);

    if (reviewerScope === null) {
      return sendError(res, 403, "FORBIDDEN", "Forbidden");
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
    const skip = (page - 1) * limit;

    const [submissions, total] = await Promise.all([
      CertificateSubmissionModel.find(reviewerScope)
        .sort({ uploadedAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CertificateSubmissionModel.countDocuments(reviewerScope),
    ]);

    return sendSuccess(res, {
      submissions: submissions.map(toSubmissionResponse),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return handleServerError(res, error, "Could not load submissions");
  }
});

router.get("/me", authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return sendError(res, 401, "UNAUTHORIZED", "You must be signed in");
    }

    const submissions = await CertificateSubmissionModel.find({
      studentAddress: req.user.address,
    })
      .sort({ uploadedAt: -1 })
      .lean();

    return sendSuccess(res, {
      submissions: submissions.map(toSubmissionResponse),
    });
  } catch (error) {
    return handleServerError(res, error, "Could not load your submissions");
  }
});

router.get("/pending", authenticate, authorize("admin", "verifier"), async (req: AuthRequest, res) => {
  try {
    const reviewerScope = await buildReviewerSubmissionScope(req.user);

    if (reviewerScope === null) {
      return sendError(res, 403, "FORBIDDEN", "Forbidden");
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query.limit ?? "50"), 10) || 50));
    const skip = (page - 1) * limit;
    const filter = { ...reviewerScope, status: "pending_review" };

    const [submissions, total] = await Promise.all([
      CertificateSubmissionModel.find(filter)
        .sort({ uploadedAt: 1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      CertificateSubmissionModel.countDocuments(filter),
    ]);

    return sendSuccess(res, {
      submissions: submissions.map(toSubmissionResponse),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return handleServerError(res, error, "Could not load pending submissions");
  }
});

router.post(
  "/:id/reject",
  authenticate,
  authorize("admin", "verifier"),
  async (req: AuthRequest, res) => {
    try {
      const id = String(req.params.id);
      const { reviewNote } = req.body as { reviewNote?: string };

      if (!isValidObjectId(id)) {
        return sendError(res, 400, "VALIDATION_ERROR", "Invalid submission id");
      }

      if (!isOptionalString(reviewNote)) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "Review note must be a string when provided"
        );
      }

      const submission = await CertificateSubmissionModel.findById(id);

      if (!submission) {
        return sendError(
          res,
          404,
          "SUBMISSION_NOT_FOUND",
          "Submission not found"
        );
      }

      const canReview = await assertInstituteReviewerAccess(
        req.user,
        submission.instituteId
      );

      if (!canReview) {
        return sendError(res, 403, "FORBIDDEN", "Forbidden");
      }

      if (submission.status !== "pending_review") {
        return sendError(
          res,
          409,
          "SUBMISSION_NOT_REJECTABLE",
          "Only pending submissions can be rejected"
        );
      }

      submission.status = "rejected";
      submission.reviewNote = reviewNote?.trim() || undefined;
      submission.reviewedAt = new Date();
      submission.auditTrail = [
        ...(submission.auditTrail ?? []),
        createAuditTrailEvent({
          type: "submission_rejected",
          title: "Submission rejected",
          description:
            reviewNote?.trim() ||
            "The certificate submission was rejected during reviewer review.",
          actorAddress: req.user?.address,
          metadata: {
            status: "rejected",
          },
        }),
      ];
      await submission.save();

      console.info(
        `[Submission Rejected] id=${id} reviewer=${req.user?.address ?? "unknown"}`
      );

      return sendSuccess(res, {
        submission: toSubmissionResponse(submission.toObject()),
      });
    } catch (error) {
      return handleServerError(res, error, "Could not reject submission");
    }
  }
);

export default router;
