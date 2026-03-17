import { Router } from "express";
import { toAuditTrailResponse } from "../lib/audit";
import { sendError, sendSuccess, handleServerError } from "../lib/api";
import { buildCredentialExports } from "../lib/credentialExports";
import { CertificateSubmissionModel } from "../models/CertificateSubmission";
import { InstituteModel } from "../models/Institute";
import {
  eduAddress,
  mintControllerAddress,
  poctAddress,
  poctReadContract,
  provider,
} from "../services/blockchain";

const router = Router();
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

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

    let owner: string;
    let certificate: {
      cid: string;
      verifier: string;
      issuedAt: bigint;
    };

    try {
      owner = await poctReadContract.ownerOf(tokenIdValue);
      certificate = await poctReadContract.certificates(tokenIdValue);
    } catch {
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
    const institute =
      submission?.instituteId
        ? await InstituteModel.findById(submission.instituteId)
            .select("slug")
            .lean()
        : null;
    const network = await provider.getNetwork();
    const record = {
      tokenId,
      studentAddress: owner.toLowerCase(),
      verifierAddress: certificate.verifier.toLowerCase(),
      issuedAt: new Date(Number(certificate.issuedAt) * 1000).toISOString(),
      cid: certificate.cid,
      courseName: submission?.courseName ?? "Unknown Course",
      instituteName: submission?.instituteName ?? "Unknown Institute",
      eduAmount: submission?.eduAmount ?? null,
      txHash: submission?.txHash ?? null,
      ipfsUrl: `https://ipfs.io/ipfs/${certificate.cid}`,
      fileName: submission?.fileName ?? null,
      mimeType: submission?.mimeType ?? null,
      reviewNote: submission?.reviewNote ?? null,
      auditTrail: (submission?.auditTrail ?? []).map(toAuditTrailResponse),
      proof: {
        chainId: Number(network.chainId),
        poctAddress,
        eduAddress,
        mintControllerAddress,
        soulbound: true,
      },
    };
    const standards = buildCredentialExports(
      {
        tokenId: record.tokenId,
        studentAddress: record.studentAddress,
        verifierAddress: record.verifierAddress,
        issuedAt: record.issuedAt,
        cid: record.cid,
        courseName: record.courseName,
        instituteName: record.instituteName,
        instituteSlug: institute?.slug ?? null,
        eduAmount: record.eduAmount,
        txHash: record.txHash,
        ipfsUrl: record.ipfsUrl,
        fileName: record.fileName,
        mimeType: record.mimeType,
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
