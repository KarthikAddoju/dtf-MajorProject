import { Router } from "express";
import { ethers } from "ethers";
import { authenticate, authorize, type AuthRequest } from "../middleware/authMiddleware";
import { sendError, sendSuccess, handleServerError } from "../lib/api";
import { parsePositiveNumber, isOptionalString, isValidObjectId } from "../lib/validation";
import { CertificateSubmissionModel } from "../models/CertificateSubmission";
import { InstituteModel } from "../models/Institute";
import { buildPreparedPublicProof } from "../services/publicProof";
import { uploadJsonToIPFS } from "../services/ipfs";
import {
  mintControllerAbi,
  mintControllerAddress,
  parseDualMintReceipt,
  provider,
} from "../services/blockchain";
import { createAuditTrailEvent } from "../lib/audit";
import { assertInstituteReviewerAccess } from "../lib/reviewers";
import { toSubmissionResponse, resolveSubmissionVerificationStatus } from "../lib/submissionResponses";
import {
  getSubmissionMintDraft,
  resolveSubmissionMintState,
  type MintDraftSnapshot,
} from "../lib/mintWorkflow";

const router = Router();
const mintControllerInterface = new ethers.Interface(mintControllerAbi);

function parseExpiryDate(value: unknown) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  if (typeof value !== "string") {
    return undefined;
  }

  const parsedDate = new Date(value);

  if (Number.isNaN(parsedDate.getTime())) {
    return undefined;
  }

  return parsedDate;
}

function buildMintPayload(
  submission: {
    studentAddress: string;
    instituteHash: string;
  },
  mintDraft: MintDraftSnapshot
) {
  return {
    studentAddress: submission.studentAddress,
    publicProofCid: mintDraft.publicProofCid,
    claimsRoot: mintDraft.claimsRoot,
    instituteHash: submission.instituteHash,
    eduAmountWei: mintDraft.eduAmountWei,
    expiresAt: mintDraft.expiresAt
      ? Math.floor(mintDraft.expiresAt.getTime() / 1000)
      : 0,
  };
}

router.post(
  "/:submissionId/prepare-mint",
  authenticate,
  authorize("admin", "verifier"),
  async (req: AuthRequest, res) => {
    try {
      const submissionId = String(req.params.submissionId);
      const { eduAmount, reviewNote, expiresAt } = req.body as {
        eduAmount?: unknown;
        reviewNote?: unknown;
        expiresAt?: unknown;
      };

      if (!isValidObjectId(submissionId)) {
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

      if (typeof reviewNote === "string" && reviewNote.length > 1000) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "Review note exceeds 1000 characters"
        );
      }

      const parsedEduAmount = parsePositiveNumber(eduAmount);

      if (!parsedEduAmount) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "eduAmount must be a positive number"
        );
      }

      const parsedExpiryDate = parseExpiryDate(expiresAt);

      if (parsedExpiryDate === undefined) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "expiresAt must be a valid ISO date or omitted"
        );
      }

      if (parsedExpiryDate && parsedExpiryDate.getTime() < Date.now()) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "Expiry date must be in the future"
        );
      }

      const submission = await CertificateSubmissionModel.findById(submissionId);

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
          "SUBMISSION_NOT_MINTABLE",
          "Only pending submissions can be minted"
        );
      }

      const authenticatedUser = req.user;

      if (!authenticatedUser) {
        return sendError(res, 401, "UNAUTHORIZED", "You must be signed in");
      }

      const canReview = await assertInstituteReviewerAccess(
        authenticatedUser,
        submission.instituteId
      );

      if (!canReview) {
        return sendError(res, 403, "FORBIDDEN", "Forbidden");
      }

      const existingMintState = resolveSubmissionMintState(submission);
      const existingMintDraft = getSubmissionMintDraft(submission);

      if (existingMintState === "prepared" && existingMintDraft) {
        return sendSuccess(res, {
          submission: toSubmissionResponse(submission.toObject()),
          mintPayload: buildMintPayload(submission, existingMintDraft),
        });
      }

      const institute = await InstituteModel.findById(submission.instituteId)
        .select("shortCode")
        .lean();

      if (!institute) {
        return sendError(
          res,
          404,
          "INSTITUTE_NOT_FOUND",
          "Institute not found"
        );
      }

      const preparedProof = buildPreparedPublicProof({
        courseName: submission.courseName,
        credentialType: submission.credentialType,
        instituteName: submission.instituteName,
        instituteShortCode: institute.shortCode,
        instituteHash: submission.instituteHash,
        studentAddress: submission.studentAddress,
        evidenceHash: submission.evidenceHash,
        eduAmount: parsedEduAmount,
        expiresAt: parsedExpiryDate?.toISOString() ?? null,
      });
      const publicProofCid = await uploadJsonToIPFS(
        preparedProof.publicProofPayload
      );
      const eduAmountWei = ethers.parseUnits(parsedEduAmount.toString(), 18);
      const reviewNoteValue =
        typeof reviewNote === "string" && reviewNote.trim().length > 0
          ? reviewNote.trim()
          : submission.reviewNote;
      const preparedSubmission = await CertificateSubmissionModel.findOneAndUpdate(
        {
          _id: submissionId,
          status: "pending_review",
          $or: [
            { mintState: "unprepared" },
            {
              mintState: { $exists: false },
              publicProofCid: null,
              claimsRoot: null,
            },
          ],
        },
        {
          $set: {
            mintState: "prepared",
            mintDraft: {
              publicProofCid,
              publicProofPayload: preparedProof.publicProofPayload,
              claimsRoot: preparedProof.claimsRoot,
              claimSet: preparedProof.claimSet,
              eduAmount: parsedEduAmount,
              eduAmountWei: eduAmountWei.toString(),
              expiresAt: parsedExpiryDate ?? null,
              preparedBy: authenticatedUser.address,
              preparedAt: new Date(),
            },
            reviewNote: reviewNoteValue,
          },
          $push: {
            auditTrail: createAuditTrailEvent({
              type: "mint_prepared",
              title: "Mint payload prepared",
              description:
                "Reviewer prepared the public proof JSON and Merkle claims root for wallet-based minting.",
              actorAddress: req.user?.address,
              metadata: {
                publicProofCid,
                claimsRoot: preparedProof.claimsRoot,
                eduAmount: parsedEduAmount,
                expiresAt: parsedExpiryDate?.toISOString() ?? null,
              },
            }),
          },
        },
        { new: true }
      );

      const resolvedPreparedSubmission =
        preparedSubmission ??
        (await CertificateSubmissionModel.findById(submissionId));

      if (!resolvedPreparedSubmission) {
        return sendError(
          res,
          404,
          "SUBMISSION_NOT_FOUND",
          "Submission not found"
        );
      }

      const resolvedMintState = resolveSubmissionMintState(resolvedPreparedSubmission);
      const resolvedMintDraft = getSubmissionMintDraft(resolvedPreparedSubmission);

      if (resolvedMintState !== "prepared" || !resolvedMintDraft) {
        if (resolvedMintState === "minted") {
          return sendError(
            res,
            409,
            "ALREADY_MINTED",
            "This submission has already been minted"
          );
        }

        return sendError(
          res,
          409,
          "PREPARE_CONFLICT",
          "Mint preparation could not be persisted"
        );
      }

      return sendSuccess(res, {
        submission: toSubmissionResponse(resolvedPreparedSubmission.toObject()),
        mintPayload: buildMintPayload(resolvedPreparedSubmission, resolvedMintDraft),
      });
    } catch (error) {
      return handleServerError(res, error, "Could not prepare the mint payload");
    }
  }
);

router.post(
  "/:submissionId/finalize-mint",
  authenticate,
  authorize("admin", "verifier"),
  async (req: AuthRequest, res) => {
    try {
      const submissionId = String(req.params.submissionId);
      const { txHash } = req.body as {
        txHash?: string;
      };

      if (!isValidObjectId(submissionId) || typeof txHash !== "string") {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "submissionId and txHash are required"
        );
      }

      const submission = await CertificateSubmissionModel.findById(submissionId);

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

      if (submission.status === "minted") {
        return sendError(
          res,
          409,
          "ALREADY_MINTED",
          "This submission has already been minted"
        );
      }

      if (submission.status !== "pending_review") {
        return sendError(
          res,
          409,
          "SUBMISSION_NOT_MINTABLE",
          "Only pending submissions can be minted"
        );
      }

      const mintState = resolveSubmissionMintState(submission);
      const mintDraft = getSubmissionMintDraft(submission);

      if (mintState !== "prepared" || !mintDraft) {
        return sendError(
          res,
          409,
          "MINT_NOT_PREPARED",
          "Prepare the mint payload before finalizing it"
        );
      }

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

      if (receipt.status !== 1) {
        return sendError(
          res,
          400,
          "TX_FAILED",
          "Transaction reverted"
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

      const parsedTransaction = mintControllerInterface.parseTransaction({
        data: transaction.data,
        value: transaction.value ?? 0n,
      });

      if (!parsedTransaction || parsedTransaction.name !== "dualMint") {
        return sendError(
          res,
          400,
          "INVALID_TRANSACTION",
          "Transaction did not call the expected mint function"
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
          "Only the submitting wallet can finalize this mint"
        );
      }

      const expectedMintPayload = buildMintPayload(submission, mintDraft);
      const parsedArgs = parsedTransaction.args;

      if (
        parsedArgs.student.toLowerCase() !== expectedMintPayload.studentAddress.toLowerCase() ||
        parsedArgs.publicProofCid !== expectedMintPayload.publicProofCid ||
        parsedArgs.claimsRoot.toLowerCase() !== expectedMintPayload.claimsRoot.toLowerCase() ||
        parsedArgs.instituteHash.toLowerCase() !==
          expectedMintPayload.instituteHash.toLowerCase() ||
        parsedArgs.eduAmount.toString() !== expectedMintPayload.eduAmountWei ||
        Number(parsedArgs.expiresAt) !== expectedMintPayload.expiresAt
      ) {
        return sendError(
          res,
          400,
          "MINT_PAYLOAD_MISMATCH",
          "Transaction input did not match the prepared mint payload"
        );
      }

      const mintedLog = parseDualMintReceipt(receipt);

      if (!mintedLog) {
        return sendError(
          res,
          400,
          "MINT_EVENT_NOT_FOUND",
          "Mint transaction did not emit the expected event"
        );
      }

      if (
        mintedLog.publicProofCid !== mintDraft.publicProofCid ||
        mintedLog.claimsRoot.toLowerCase() !== mintDraft.claimsRoot.toLowerCase() ||
        mintedLog.instituteHash.toLowerCase() !== submission.instituteHash.toLowerCase()
      ) {
        return sendError(
          res,
          400,
          "MINT_PAYLOAD_MISMATCH",
          "The on-chain mint payload did not match the prepared review payload"
        );
      }

      const block = await provider.getBlock(receipt.blockNumber);
      const mintedAt = new Date(
        Number(block?.timestamp ?? Math.floor(Date.now() / 1000)) * 1000
      );

      const newVerificationStatus = resolveSubmissionVerificationStatus({
        status: "minted",
        verificationStatus: submission.verificationStatus,
        expiresAt: submission.expiresAt ?? undefined,
        revokedAt: submission.revokedAt ?? undefined,
      }) as "active" | "expired" | "revoked";

      const atomicResult = await CertificateSubmissionModel.findOneAndUpdate(
        {
          _id: submissionId,
          status: "pending_review",
          $or: [
            { mintState: "prepared" },
            {
              mintState: { $exists: false },
              publicProofCid: { $ne: null },
              claimsRoot: { $ne: null },
            },
          ],
        },
        {
          $set: {
            status: "minted",
            mintState: "minted",
            eduAmount: mintDraft.eduAmount,
            eduAmountWei: mintDraft.eduAmountWei,
            publicProofCid: mintDraft.publicProofCid,
            publicProofPayload: mintDraft.publicProofPayload,
            claimsRoot: mintDraft.claimsRoot,
            claimSet: mintDraft.claimSet,
            expiresAt: mintDraft.expiresAt ?? undefined,
            tokenId: mintedLog.tokenId,
            txHash,
            verifierAddress: req.user.address,
            reviewedAt: mintedAt,
            mintedAt: mintedAt,
            verificationStatus: newVerificationStatus,
          },
          $unset: {
            mintDraft: 1,
          },
          $push: {
            auditTrail: createAuditTrailEvent({
              type: "submission_minted",
              title: "Credential minted on-chain",
              description:
                "Reviewer approved the submission and minted the PoCT credential with wallet-signed confirmation.",
              actorAddress: req.user.address,
              metadata: {
                tokenId: mintedLog.tokenId,
                txHash,
                eduAmount: submission.eduAmount ?? 0,
                verificationStatus: newVerificationStatus,
              },
            }),
          },
        },
        { new: true }
      );

      if (!atomicResult) {
        return sendError(
          res,
          409,
          "ALREADY_MINTED",
          "This submission was minted by another request"
        );
      }

      console.info(
        `[Mint Finalized] tokenId=${mintedLog.tokenId} txHash=${txHash} verifier=${req.user.address}`
      );

      return sendSuccess(res, {
        submission: toSubmissionResponse(atomicResult.toObject()),
        txHash,
        tokenId: mintedLog.tokenId,
      });
    } catch (error) {
      return handleServerError(res, error, "Could not finalize the mint");
    }
  }
);

export default router;
