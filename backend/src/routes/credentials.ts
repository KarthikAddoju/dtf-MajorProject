import { Router } from "express";
import { ethers } from "ethers";
import { authenticate, authorize, type AuthRequest } from "../middleware/authMiddleware";
import { sendError, sendSuccess, handleServerError } from "../lib/api";
import { CertificateSubmissionModel } from "../models/CertificateSubmission";
import {
  mintControllerAddress,
  parseRevocationReceipt,
  provider,
} from "../services/blockchain";
import { createAuditTrailEvent } from "../lib/audit";
import { assertInstituteReviewerAccess } from "../lib/reviewers";
import { isOptionalString } from "../lib/validation";
import { buildMerkleTree } from "../lib/merkle";
import { formatRequestLogPrefix } from "../lib/requestId";
import { toSubmissionResponse } from "../lib/submissionResponses";
import { DisclosureRecordModel } from "../models/DisclosureRecord";

/**
 * Credential disclosure and revocation routes for minted submissions.
 */
const router = Router();
const MAX_REVOCATION_REASON_LENGTH = 1000;
const MAX_DISCLOSURE_AUDIENCE_LENGTH = 500;

/**
 * Lists saved selective-disclosure packages for the authenticated student.
 *
 * Auth: bearer token required
 * Input: `page`, `limit`
 * Errors: `UNAUTHORIZED`
 */
router.get("/disclosures", authenticate, async (req: AuthRequest, res) => {
  try {
    if (!req.user) {
      return sendError(res, 401, "UNAUTHORIZED", "You must be signed in");
    }

    const page = Math.max(1, parseInt(String(req.query.page ?? "1"), 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit ?? "20"), 10) || 20));
    const skip = (page - 1) * limit;
    const filter = { studentAddress: req.user.address };

    const [records, total] = await Promise.all([
      DisclosureRecordModel.find(filter)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      DisclosureRecordModel.countDocuments(filter),
    ]);

    return sendSuccess(res, {
      disclosures: records.map((r) => ({
        id: (r._id as { toString(): string }).toString(),
        tokenId: r.tokenId,
        claimsRoot: r.claimsRoot,
        disclosedClaims: r.disclosedClaims,
        merkleProofs: r.merkleProofs,
        audience: r.audience ?? null,
        expiresAt: r.expiresAt ? (r.expiresAt as Date).toISOString() : null,
        claimCount: r.claimCount,
        createdAt: (r.createdAt as Date).toISOString(),
      })),
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return handleServerError(res, error, "Could not load disclosure packages");
  }
});

/**
 * Finalizes an on-chain revocation after validating the wallet-signed transaction.
 *
 * Auth: admin or verifier JWT required
 * Input: `{ txHash, reason? }`
 * Errors: `VALIDATION_ERROR`, `SUBMISSION_NOT_FOUND`, `SUBMISSION_NOT_REVOCABLE`, `SUBMISSION_ALREADY_REVOKED`, `TRANSACTION_NOT_FOUND`
 */
router.post(
  "/:tokenId/revoke/finalize",
  authenticate,
  authorize("admin", "verifier"),
  async (req: AuthRequest, res) => {
    try {
      const tokenId = String(req.params.tokenId);
      const { txHash, reason } = req.body as {
        txHash?: string;
        reason?: unknown;
      };

      if (!/^\d+$/.test(tokenId) || typeof txHash !== "string" || !isOptionalString(reason)) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "tokenId, txHash, and an optional string reason are required"
        );
      }

      const normalizedReason = reason?.trim() || "Credential revoked";

      if (normalizedReason.length > MAX_REVOCATION_REASON_LENGTH) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          `Revocation reason must be ${MAX_REVOCATION_REASON_LENGTH} characters or fewer`
        );
      }

      const submission = await CertificateSubmissionModel.findOne({ tokenId });

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

      if (submission.status !== "minted") {
        return sendError(
          res,
          409,
          "SUBMISSION_NOT_REVOCABLE",
          "Only minted submissions can be revoked"
        );
      }

      if (submission.verificationStatus === "revoked") {
        return sendError(
          res,
          409,
          "SUBMISSION_ALREADY_REVOKED",
          "This credential has already been revoked"
        );
      }

      const reasonHash = ethers.id(normalizedReason);
      const [receipt, transaction] = await Promise.all([
        provider.getTransactionReceipt(txHash),
        provider.getTransaction(txHash),
      ]);

      if (!receipt || !transaction) {
        return sendError(
          res,
          404,
          "TRANSACTION_NOT_FOUND",
          "Transaction receipt not found"
        );
      }

      if ((transaction.to ?? "").toLowerCase() !== mintControllerAddress.toLowerCase()) {
        return sendError(
          res,
          400,
          "INVALID_TRANSACTION",
          "Transaction was not sent to the mint controller"
        );
      }

      if (
        !req.user ||
        transaction.from.toLowerCase() !== req.user.address.toLowerCase()
      ) {
        return sendError(
          res,
          403,
          "FORBIDDEN",
          "Only the submitting wallet can finalize this revocation"
        );
      }

      const revocationLog = parseRevocationReceipt(receipt);

      if (!revocationLog || revocationLog.tokenId !== tokenId) {
        return sendError(
          res,
          400,
          "REVOCATION_EVENT_NOT_FOUND",
          "Revocation transaction did not emit the expected event"
        );
      }

      if (revocationLog.reasonHash.toLowerCase() !== reasonHash.toLowerCase()) {
        return sendError(
          res,
          400,
          "REVOCATION_REASON_MISMATCH",
          "The revocation reason hash did not match the submitted reason"
        );
      }

      const block = await provider.getBlock(receipt.blockNumber);
      const revokedAt = new Date(
        Number(block?.timestamp ?? Math.floor(Date.now() / 1000)) * 1000
      );

      const revokedSubmission = await CertificateSubmissionModel.findOneAndUpdate(
        {
          _id: submission._id,
          tokenId,
          status: "minted",
          verificationStatus: { $ne: "revoked" },
        },
        {
          $set: {
            verificationStatus: "revoked",
            revokedAt,
            revocationReason: normalizedReason,
            revocationReasonHash: reasonHash,
          },
          $push: {
            auditTrail: createAuditTrailEvent({
              type: "submission_revoked",
              title: "Credential revoked",
              description:
                "Reviewer finalized an on-chain revocation for this credential.",
              actorAddress: req.user.address,
              metadata: {
                tokenId,
                txHash,
                reasonHash,
              },
            }),
          },
        },
        { new: true }
      );

      if (!revokedSubmission) {
        return sendError(
          res,
          409,
          "ALREADY_PROCESSED",
          "Submission was already updated by another request"
        );
      }

      console.info(
        `${formatRequestLogPrefix(res.locals.requestId)} [Revocation Finalized] tokenId=${tokenId} txHash=${txHash} revoker=${req.user.address} reason="${normalizedReason}"`
      );

      return sendSuccess(res, {
        submission: toSubmissionResponse(revokedSubmission.toObject()),
      });
    } catch (error) {
      return handleServerError(res, error, "Could not finalize revocation");
    }
  }
);

/**
 * Creates and stores a selective-disclosure package for a minted credential.
 *
 * Auth: bearer token required
 * Input: `{ claimKeys?, audience?, expiresAt? }`
 * Errors: `VALIDATION_ERROR`, `SUBMISSION_NOT_FOUND`, `DISCLOSURE_NOT_AVAILABLE`, `DISCLOSURE_ROOT_MISMATCH`
 */
router.post(
  "/:tokenId/disclosures",
  authenticate,
  async (req: AuthRequest, res) => {
    try {
      if (!req.user) {
        return sendError(res, 401, "UNAUTHORIZED", "You must be signed in");
      }

      const tokenId = String(req.params.tokenId);
      const { claimKeys, audience, expiresAt } = req.body as {
        claimKeys?: unknown;
        audience?: unknown;
        expiresAt?: unknown;
      };

      if (!/^\d+$/.test(tokenId)) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "Token id must be a positive integer"
        );
      }

      if (
        claimKeys !== undefined &&
        (!Array.isArray(claimKeys) ||
          claimKeys.some((entry) => typeof entry !== "string"))
      ) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "claimKeys must be an array of strings when provided"
        );
      }

      if (audience !== undefined && typeof audience !== "string") {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "audience must be a string when provided"
        );
      }

      if (
        typeof audience === "string" &&
        audience.length > MAX_DISCLOSURE_AUDIENCE_LENGTH
      ) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          `audience must be ${MAX_DISCLOSURE_AUDIENCE_LENGTH} characters or fewer`
        );
      }

      if (expiresAt !== undefined && typeof expiresAt !== "string") {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "expiresAt must be a string when provided"
        );
      }

      const submission = await CertificateSubmissionModel.findOne({ tokenId })
        .select("studentAddress claimsRoot claimSet expiresAt")
        .lean();

      if (!submission) {
        return sendError(
          res,
          404,
          "SUBMISSION_NOT_FOUND",
          "Submission not found"
        );
      }

      if (submission.studentAddress !== req.user.address) {
        return sendError(res, 403, "FORBIDDEN", "Forbidden");
      }

      if (
        !submission.claimSet ||
        typeof submission.claimSet !== "object" ||
        !submission.claimsRoot
      ) {
        return sendError(
          res,
          409,
          "DISCLOSURE_NOT_AVAILABLE",
          "Disclosure material is not available for this credential"
        );
      }

      const fullClaimSet = submission.claimSet as Record<string, unknown>;
      const requestedKeys =
        claimKeys && claimKeys.length > 0
          ? claimKeys
          : Object.keys(fullClaimSet).sort();
      const invalidKeys = requestedKeys.filter((key) => !(key in fullClaimSet));

      if (invalidKeys.length > 0) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          `Unknown claim keys requested: ${invalidKeys.join(", ")}`
        );
      }

      const merkleTree = buildMerkleTree(fullClaimSet);

      if (merkleTree.root.toLowerCase() !== submission.claimsRoot.toLowerCase()) {
        return sendError(
          res,
          409,
          "DISCLOSURE_ROOT_MISMATCH",
          "Stored claims do not match the recorded claims root"
        );
      }

      const disclosedClaims = Object.fromEntries(
        requestedKeys.map((key) => [key, fullClaimSet[key]])
      );
      const merkleProofs = Object.fromEntries(
        requestedKeys.map((key) => [key, merkleTree.proofs[key] ?? []])
      );

      const resolvedExpiresAt = expiresAt ?? submission.expiresAt?.toISOString() ?? null;

      // Persist disclosure package for later retrieval from the dashboard
      await DisclosureRecordModel.create({
        tokenId,
        studentAddress: req.user.address,
        claimsRoot: submission.claimsRoot,
        disclosedClaims,
        merkleProofs,
        audience: typeof audience === "string" ? audience : null,
        expiresAt: resolvedExpiresAt ? new Date(resolvedExpiresAt) : null,
        claimCount: requestedKeys.length,
      });

      return sendSuccess(res, {
        tokenId,
        claimsRoot: submission.claimsRoot,
        disclosedClaims,
        merkleProofs,
        audience: audience ?? null,
        expiresAt: resolvedExpiresAt,
      });
    } catch (error) {
      return handleServerError(res, error, "Could not create disclosure package");
    }
  }
);

export default router;
