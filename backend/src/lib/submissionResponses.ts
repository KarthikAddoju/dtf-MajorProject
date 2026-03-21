import type { Types } from "mongoose";
import {
  CERTIFICATE_STATUSES,
  CREDENTIAL_TYPES,
  type VERIFICATION_STATUSES,
} from "../models/CertificateSubmission";
import { toAuditTrailResponse } from "./audit";
import { buildIpfsGatewayUrl } from "../services/ipfs";

type VerificationStatus = (typeof VERIFICATION_STATUSES)[number];

interface SubmissionResponseInput {
  _id: unknown;
  studentAddress: string;
  courseName: string;
  credentialType?: (typeof CREDENTIAL_TYPES)[number];
  instituteId: unknown;
  instituteName: string;
  instituteHash: string;
  evidenceHash: string;
  publicProofCid?: string;
  claimsRoot?: string;
  fileName: string;
  mimeType: string;
  status: (typeof CERTIFICATE_STATUSES)[number];
  verificationStatus?: VerificationStatus;
  eduAmount?: number;
  tokenId?: string;
  txHash?: string;
  verifierAddress?: string;
  reviewNote?: string;
  expiresAt?: Date;
  revokedAt?: Date;
  revocationReason?: string;
  uploadedAt: Date;
  reviewedAt?: Date;
  mintedAt?: Date;
  auditTrail?: Array<{
    _id?: unknown;
    type: string;
    title: string;
    description?: string;
    actorAddress?: string;
    createdAt: Date;
    metadata?: Record<string, unknown>;
  }>;
}

export function resolveSubmissionVerificationStatus(input: {
  status: (typeof CERTIFICATE_STATUSES)[number];
  verificationStatus?: VerificationStatus;
  expiresAt?: Date;
  revokedAt?: Date;
}) {
  if (input.status !== "minted") {
    return null;
  }

  if (input.revokedAt || input.verificationStatus === "revoked") {
    return "revoked";
  }

  if (
    input.expiresAt &&
    input.expiresAt.getTime() > 0 &&
    input.expiresAt.getTime() < Date.now()
  ) {
    return "expired";
  }

  return input.verificationStatus ?? "active";
}

export function buildEvidenceUrl(submissionId: string) {
  return `/api/evidence/${submissionId}`;
}

export function toSubmissionResponse(submission: SubmissionResponseInput) {
  const id =
    typeof submission._id === "object" && submission._id !== null
      ? String((submission._id as Types.ObjectId).toString())
      : String(submission._id);
  const publicProofCid = submission.publicProofCid ?? null;
  const publicProofUrl = publicProofCid ? buildIpfsGatewayUrl(publicProofCid) : null;
  const verificationStatus = resolveSubmissionVerificationStatus(submission);

  return {
    id,
    studentAddress: submission.studentAddress,
    courseName: submission.courseName,
    credentialType: submission.credentialType ?? "course",
    instituteId: String(submission.instituteId),
    instituteName: submission.instituteName,
    instituteHash: submission.instituteHash,
    evidenceHash: submission.evidenceHash,
    evidenceUrl: buildEvidenceUrl(id),
    publicProofCid,
    publicProofUrl,
    claimsRoot: submission.claimsRoot ?? null,
    fileName: submission.fileName,
    mimeType: submission.mimeType,
    status: submission.status,
    verificationStatus,
    eduAmount: submission.eduAmount ?? null,
    tokenId: submission.tokenId ?? null,
    txHash: submission.txHash ?? null,
    verifierAddress: submission.verifierAddress ?? null,
    reviewNote: submission.reviewNote ?? null,
    expiresAt: submission.expiresAt?.toISOString() ?? null,
    revokedAt: submission.revokedAt?.toISOString() ?? null,
    revocationReason: submission.revocationReason ?? null,
    uploadedAt: submission.uploadedAt.toISOString(),
    reviewedAt: submission.reviewedAt?.toISOString() ?? null,
    mintedAt: submission.mintedAt?.toISOString() ?? null,
    auditTrail: (submission.auditTrail ?? []).map((event) =>
      toAuditTrailResponse(event as never)
    ),
    // Legacy aliases kept for UI compatibility during the migration.
    cid: publicProofCid,
    ipfsUrl: publicProofUrl,
  };
}
