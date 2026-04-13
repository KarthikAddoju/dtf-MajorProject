import { Router } from "express";
import { toAuditTrailResponse } from "../lib/audit";
import { sendError, sendSuccess, handleServerError } from "../lib/api";
import { buildCredentialExports } from "../lib/credentialExports";
import { getBlockchainReadiness } from "../lib/blockchainReadiness";
import { CertificateSubmissionModel } from "../models/CertificateSubmission";
import {
  eduAddress,
  mintControllerAddress,
  poctAddress,
  poctReadContract,
  getVerificationStatusLabel,
} from "../services/blockchain";
import { buildIpfsGatewayUrl, fetchJsonFromIPFS } from "../services/ipfs";

/**
 * Public verification route that combines on-chain credential data with stored submission metadata.
 */
const router = Router();
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

function isMissingCertificateError(error: unknown) {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error && typeof error.code === "string" ? error.code : null;
  const message =
    "message" in error && typeof error.message === "string"
      ? error.message.toLowerCase()
      : "";
  const shortMessage =
    "shortMessage" in error && typeof error.shortMessage === "string"
      ? error.shortMessage.toLowerCase()
      : "";
  const combinedMessage = `${message} ${shortMessage}`;

  return (
    code === "CALL_EXCEPTION" ||
    combinedMessage.includes("token does not exist") ||
    combinedMessage.includes("nonexistent token")
  );
}

/**
 * Verifies a token id against the active chain and returns proof details when present.
 *
 * Auth: public
 * Input: `tokenId` route param
 * Errors: `VALIDATION_ERROR`, `BLOCKCHAIN_UNAVAILABLE`, `TOKEN_NOT_FOUND`
 */
router.get("/:tokenId", async (req, res) => {
  try {
    const { tokenId } = req.params;

    if (!/^\d+$/.test(tokenId)) {
      return sendError(
        res,
        400,
        "VALIDATION_ERROR",
        "Token id must be a positive integer"
      );
    }

    const tokenIdValue = BigInt(tokenId);
    const blockchainReadiness = await getBlockchainReadiness();

    if (
      blockchainReadiness.status !== "connected" ||
      !blockchainReadiness.contractsReady ||
      blockchainReadiness.chainId === null
    ) {
      return sendError(
        res,
        503,
        "BLOCKCHAIN_UNAVAILABLE",
        "The active chain is unavailable or the configured contracts are not deployed on it yet."
      );
    }

    let owner: string;
    let certificate: {
      publicProofCid: string;
      claimsRoot: string;
      instituteHash: string;
      verifier: string;
      issuedAt: bigint;
      expiresAt: bigint;
      revoked: boolean;
      revocationReasonHash: string;
    };
    let verificationStatus: "active" | "expired" | "revoked";

    try {
      owner = await poctReadContract.ownerOf(tokenIdValue);
      certificate = await poctReadContract.certificates(tokenIdValue);
      verificationStatus = getVerificationStatusLabel(
        await poctReadContract.credentialStatus(tokenIdValue)
      );
    } catch (error) {
      if (!isMissingCertificateError(error)) {
        return sendError(
          res,
          503,
          "BLOCKCHAIN_UNAVAILABLE",
          "The active chain is unavailable or the configured contracts are not deployed on it yet."
        );
      }

      return sendError(
        res,
        404,
        "CERTIFICATE_NOT_FOUND",
        "No certificate exists for that token id"
      );
    }

    const submission = await CertificateSubmissionModel.findOne({
      tokenId,
    }).lean();

    let publicProof: Record<string, unknown> | null = null;

    if (certificate.publicProofCid) {
      try {
        publicProof = await fetchJsonFromIPFS<Record<string, unknown>>(
          certificate.publicProofCid
        );
      } catch {
        publicProof = null;
      }
    }

    const issuedAt = new Date(Number(certificate.issuedAt) * 1000).toISOString();
    const expiresAt =
      Number(certificate.expiresAt) > 0
        ? new Date(Number(certificate.expiresAt) * 1000).toISOString()
        : null;
    const courseName =
      typeof publicProof?.courseName === "string"
        ? publicProof.courseName
        : "Unknown Credential";
    const credentialType =
      typeof publicProof?.credentialType === "string"
        ? publicProof.credentialType
        : "course";
    const instituteName =
      typeof publicProof?.instituteName === "string"
        ? publicProof.instituteName
        : "Unknown Institute";
    const evidenceHash =
      typeof publicProof?.evidenceHash === "string"
        ? publicProof.evidenceHash
        : null;
    const eduAmount =
      typeof publicProof?.eduAmount === "number" ? publicProof.eduAmount : null;
    const txHash =
      typeof publicProof?.txHash === "string" ? publicProof.txHash : null;
    const publicProofUrl = certificate.publicProofCid
      ? buildIpfsGatewayUrl(certificate.publicProofCid)
      : null;

    const record = {
      tokenId,
      studentAddress: owner.toLowerCase(),
      verifierAddress: certificate.verifier.toLowerCase(),
      issuedAt,
      expiresAt,
      verificationStatus,
      publicProofCid: certificate.publicProofCid,
      claimsRoot: certificate.claimsRoot,
      instituteHash: certificate.instituteHash,
      evidenceHash,
      courseName,
      credentialType,
      instituteName,
      eduAmount,
      txHash,
      publicProofUrl,
      reviewNote: null,
      auditTrail: (submission?.auditTrail ?? []).map(toAuditTrailResponse),
      publicProof,
      proof: {
        chainId: blockchainReadiness.chainId,
        poctAddress,
        eduAddress,
        mintControllerAddress,
        soulbound: true,
      },
      // Legacy aliases retained for the existing frontend surfaces.
      cid: certificate.publicProofCid,
      ipfsUrl: publicProofUrl,
    };
    const standards = buildCredentialExports(
      {
        tokenId: record.tokenId,
        studentAddress: record.studentAddress,
        verifierAddress: record.verifierAddress,
        issuedAt: record.issuedAt,
        expiresAt: record.expiresAt,
        verificationStatus: record.verificationStatus,
        publicProofCid: record.publicProofCid,
        claimsRoot: record.claimsRoot,
        courseName: record.courseName,
        credentialType: record.credentialType,
        instituteName: record.instituteName,
        evidenceHash: record.evidenceHash,
        eduAmount: record.eduAmount,
        txHash: record.txHash,
        publicProofUrl: record.publicProofUrl,
        chainId: record.proof.chainId,
        poctAddress: record.proof.poctAddress,
        eduAddress: record.proof.eduAddress,
        mintControllerAddress: record.proof.mintControllerAddress,
        soulbound: record.proof.soulbound,
      },
      FRONTEND_ORIGIN
    );

    return sendSuccess(res, {
      record: {
        ...record,
        standards,
      },
    });
  } catch (error) {
    return handleServerError(res, error, "Could not verify certificate");
  }
});

export default router;
