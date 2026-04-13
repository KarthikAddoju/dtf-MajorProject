import { Router } from "express";
import { sendError, sendSuccess, handleServerError } from "../lib/api";
import { createAuditTrailEvent } from "../lib/audit";
import { CertificateSubmissionModel } from "../models/CertificateSubmission";
import { authenticate, authorize, type AuthRequest } from "../middleware/authMiddleware";
import { isOptionalString, isValidObjectId } from "../lib/validation";
import { buildReviewerSubmissionScope, assertInstituteReviewerAccess } from "../lib/reviewers";
import { formatRequestLogPrefix } from "../lib/requestId";
import { toSubmissionResponse } from "../lib/submissionResponses";

/**
 * Submission listing and reviewer decision routes for admin, verifier, and student dashboards.
 */
const router = Router();
const DEFAULT_PAGE = 1;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
const MAX_REVIEW_NOTE_LENGTH = 1000;

/**
 * Parses common page/limit query parameters used by submission lists.
 */
function parsePagination(query: { page?: unknown; limit?: unknown }) {
  const page = Math.max(
    DEFAULT_PAGE,
    parseInt(String(query.page ?? String(DEFAULT_PAGE)), 10) || DEFAULT_PAGE
  );
  const limit = Math.min(
    MAX_LIMIT,
    Math.max(
      DEFAULT_PAGE,
      parseInt(String(query.limit ?? String(DEFAULT_LIMIT)), 10) || DEFAULT_LIMIT
    )
  );

  return {
    page,
    limit,
    skip: (page - 1) * limit,
  };
}

/**
 * Lists submissions that fall within the authenticated reviewer scope.
 *
 * Auth: admin or verifier JWT required
 * Input: `page`, `limit`
 * Errors: `FORBIDDEN`
 */
router.get("/", authenticate, authorize("admin", "verifier"), async (req: AuthRequest, res) => {
  try {
    const reviewerScope = await buildReviewerSubmissionScope(req.user);

    if (reviewerScope === null) {
      return sendError(res, 403, "FORBIDDEN", "Forbidden");
    }

    const { page, limit, skip } = parsePagination(req.query);

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

/**
 * Lists submissions owned by the authenticated student wallet.
 *
 * Auth: bearer token required
 * Input: none
 * Errors: `UNAUTHORIZED`
 */
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

/**
 * Lists pending-review submissions within the authenticated reviewer scope.
 *
 * Auth: admin or verifier JWT required
 * Input: `page`, `limit`
 * Errors: `FORBIDDEN`
 */
router.get("/pending", authenticate, authorize("admin", "verifier"), async (req: AuthRequest, res) => {
  try {
    const reviewerScope = await buildReviewerSubmissionScope(req.user);

    if (reviewerScope === null) {
      return sendError(res, 403, "FORBIDDEN", "Forbidden");
    }

    const { page, limit, skip } = parsePagination(req.query);
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

/**
 * Rejects a pending submission and records the reviewer note in the audit trail.
 *
 * Auth: admin or verifier JWT required
 * Input: `reviewNote?`
 * Errors: `VALIDATION_ERROR`, `SUBMISSION_NOT_FOUND`, `SUBMISSION_NOT_REJECTABLE`, `ALREADY_PROCESSED`
 */
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

      const normalizedReviewNote = reviewNote?.trim();

      if (
        normalizedReviewNote &&
        normalizedReviewNote.length > MAX_REVIEW_NOTE_LENGTH
      ) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          `Review note must be ${MAX_REVIEW_NOTE_LENGTH} characters or fewer`
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

      const rejectedSubmission = await CertificateSubmissionModel.findOneAndUpdate(
        {
          _id: id,
          status: "pending_review",
        },
        {
          $set: {
            status: "rejected",
            mintState: "unprepared",
            mintDraft: null,
            reviewNote: normalizedReviewNote || undefined,
            reviewedAt: new Date(),
          },
          $push: {
            auditTrail: createAuditTrailEvent({
              type: "submission_rejected",
              title: "Submission rejected",
              description:
                normalizedReviewNote ||
                "The certificate submission was rejected during reviewer review.",
              actorAddress: req.user?.address,
              metadata: {
                status: "rejected",
              },
            }),
          },
        },
        { new: true }
      );

      if (!rejectedSubmission) {
        return sendError(
          res,
          409,
          "ALREADY_PROCESSED",
          "Submission was already processed by another request"
        );
      }

      console.info(
        `${formatRequestLogPrefix(res.locals.requestId)} [Submission Rejected] id=${id} reviewer=${req.user?.address ?? "unknown"}`
      );

      return sendSuccess(res, {
        submission: toSubmissionResponse(rejectedSubmission.toObject()),
      });
    } catch (error) {
      return handleServerError(res, error, "Could not reject submission");
    }
  }
);

export default router;
