import { Router } from "express";
import { sendError, sendSuccess, handleServerError } from "../lib/api";
import { createAuditTrailEvent, toAuditTrailResponse } from "../lib/audit";
import {
  CREDENTIAL_TYPES,
  CERTIFICATE_STATUSES,
  CertificateSubmissionModel,
} from "../models/CertificateSubmission";
import { authenticate, authorize, type AuthRequest } from "../middleware/authMiddleware";
import { isOptionalString, isValidObjectId } from "../lib/validation";

const router = Router();

function toSubmissionResponse(submission: {
  _id: unknown;
  studentAddress: string;
  courseName: string;
  credentialType?: (typeof CREDENTIAL_TYPES)[number];
  instituteId: unknown;
  instituteName: string;
  cid: string;
  fileName: string;
  mimeType: string;
  status: (typeof CERTIFICATE_STATUSES)[number];
  eduAmount?: number;
  tokenId?: string;
  txHash?: string;
  verifierAddress?: string;
  reviewNote?: string;
  uploadedAt: Date;
  reviewedAt?: Date;
  mintedAt?: Date;
  auditTrail?: Array<{
    _id?: unknown;
    type: "submission_created" | "submission_rejected" | "submission_minted";
    title: string;
    description?: string;
    actorAddress?: string;
    createdAt: Date;
    metadata?: Record<string, unknown>;
  }>;
}) {
  return {
    id: String(submission._id),
    studentAddress: submission.studentAddress,
    courseName: submission.courseName,
    credentialType: submission.credentialType ?? "course",
    instituteId: String(submission.instituteId),
    instituteName: submission.instituteName,
    cid: submission.cid,
    fileName: submission.fileName,
    mimeType: submission.mimeType,
    status: submission.status,
    eduAmount: submission.eduAmount ?? null,
    tokenId: submission.tokenId ?? null,
    txHash: submission.txHash ?? null,
    verifierAddress: submission.verifierAddress ?? null,
    reviewNote: submission.reviewNote ?? null,
    uploadedAt: submission.uploadedAt.toISOString(),
    reviewedAt: submission.reviewedAt?.toISOString() ?? null,
    mintedAt: submission.mintedAt?.toISOString() ?? null,
    ipfsUrl: `https://ipfs.io/ipfs/${submission.cid}`,
    auditTrail: (submission.auditTrail ?? []).map(toAuditTrailResponse),
  };
}

router.get("/", authenticate, authorize("admin"), async (_req, res) => {
  try {
    const submissions = await CertificateSubmissionModel.find()
      .sort({ uploadedAt: -1 })
      .lean();

    return sendSuccess(res, {
      submissions: submissions.map(toSubmissionResponse),
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

router.get("/pending", authenticate, authorize("admin"), async (_req, res) => {
  try {
    const submissions = await CertificateSubmissionModel.find({
      status: "pending_review",
    })
      .sort({ uploadedAt: 1 })
      .lean();

    return sendSuccess(res, {
      submissions: submissions.map(toSubmissionResponse),
    });
  } catch (error) {
    return handleServerError(res, error, "Could not load pending submissions");
  }
});

router.post(
  "/:id/reject",
  authenticate,
  authorize("admin"),
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
            "The certificate submission was rejected during admin review.",
          actorAddress: req.user?.address,
          metadata: {
            status: "rejected",
          },
        }),
      ];
      await submission.save();

      return sendSuccess(res, {
        submission: toSubmissionResponse(submission.toObject()),
      });
    } catch (error) {
      return handleServerError(res, error, "Could not reject submission");
    }
  }
);

export { toSubmissionResponse };
export default router;
