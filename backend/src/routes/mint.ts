import express from "express";
import { ethers } from "ethers";
import { sendError, sendSuccess, handleServerError } from "../lib/api";
import { createAuditTrailEvent } from "../lib/audit";
import { authenticate, authorize } from "../middleware/authMiddleware";
import { parsePositiveNumber, isValidObjectId } from "../lib/validation";
import { CertificateSubmissionModel } from "../models/CertificateSubmission";
import {
  buildMintSignature,
  isCurrentVerifierAuthorized,
  mintControllerContract,
  parseDualMintReceipt,
  wallet,
} from "../services/blockchain";

const router = express.Router();

router.post(
  "/",
  authenticate,
  authorize("admin"),
  async (req, res) => {
    try {
      const { submissionId, eduAmount, reviewNote } = req.body as {
        submissionId?: string;
        eduAmount?: unknown;
        reviewNote?: unknown;
      };

      if (
        typeof submissionId !== "string" ||
        !isValidObjectId(submissionId) ||
        eduAmount === undefined ||
        (reviewNote !== undefined && typeof reviewNote !== "string")
      ) {
        return sendError(
          res,
          400,
          "VALIDATION_ERROR",
          "submissionId and eduAmount are required"
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

      const verifierAuthorized = await isCurrentVerifierAuthorized();

      if (!verifierAuthorized) {
        return sendError(
          res,
          409,
          "VERIFIER_NOT_AUTHORIZED",
          "The configured backend signer is not an authorized verifier"
        );
      }

      const parsedAmountWei = ethers.parseUnits(parsedEduAmount.toString(), 18);
      const signature = await buildMintSignature(
        submission.studentAddress,
        submission.cid,
        parsedAmountWei
      );

      const tx = await mintControllerContract.dualMint(
        submission.studentAddress,
        submission.cid,
        parsedAmountWei,
        wallet.address,
        signature
      );

      const receipt = await tx.wait();

      if (!receipt) {
        return sendError(
          res,
          500,
          "MINT_RECEIPT_MISSING",
          "The mint transaction completed without a receipt"
        );
      }

      const tokenId = parseDualMintReceipt(receipt);

      if (!tokenId) {
        return sendError(
          res,
          500,
          "TOKEN_ID_NOT_FOUND",
          "Mint succeeded but tokenId could not be extracted"
        );
      }

      const now = new Date();

      submission.status = "minted";
      submission.eduAmount = parsedEduAmount;
      submission.eduAmountWei = parsedAmountWei.toString();
      submission.tokenId = tokenId;
      submission.txHash = tx.hash;
      submission.verifierAddress = wallet.address.toLowerCase();
      submission.reviewNote =
        typeof reviewNote === "string" && reviewNote.trim().length > 0
          ? reviewNote.trim()
          : submission.reviewNote;
      submission.reviewedAt = now;
      submission.mintedAt = now;
      submission.auditTrail = [
        ...(submission.auditTrail ?? []),
        createAuditTrailEvent({
          type: "submission_minted",
          title: "Credential minted on-chain",
          description:
            "Admin approved the submission and minted the PoCT certificate with EDU rewards.",
          actorAddress: wallet.address,
          metadata: {
            tokenId,
            txHash: tx.hash,
            eduAmount: parsedEduAmount,
            status: "minted",
          },
        }),
      ];
      await submission.save();

      return sendSuccess(res, {
        txHash: tx.hash,
        tokenId,
        eduAmount: parsedEduAmount,
        submissionId: submission.id,
      });

    } catch (err) {
      return handleServerError(res, err, "Mint failed");
    }
  }
);

export default router;
