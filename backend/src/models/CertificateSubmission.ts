import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";
import { AUDIT_TRAIL_EVENT_TYPES } from "../lib/audit";

export const CERTIFICATE_STATUSES = [
  "pending_review",
  "rejected",
  "minted",
] as const;

export const VERIFICATION_STATUSES = [
  "active",
  "expired",
  "revoked",
] as const;

export const MINT_STATES = [
  "unprepared",
  "prepared",
  "minted",
] as const;

export const CREDENTIAL_TYPES = [
  "course",
  "workshop",
  "quiz",
  "hackathon",
  "competition",
  "seminar",
  "bootcamp",
  "internship",
  "certification",
  "other",
] as const;

const auditTrailEventSchema = new Schema(
  {
    type: {
      type: String,
      enum: AUDIT_TRAIL_EVENT_TYPES,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    actorAddress: {
      type: String,
      trim: true,
      lowercase: true,
    },
    createdAt: {
      type: Date,
      default: () => new Date(),
      required: true,
    },
    metadata: {
      type: Schema.Types.Mixed,
    },
  },
  {
    _id: true,
    id: false,
  }
);

const mintDraftSchema = new Schema(
  {
    publicProofCid: {
      type: String,
      required: true,
      trim: true,
    },
    publicProofPayload: {
      type: Schema.Types.Mixed,
      required: true,
    },
    claimsRoot: {
      type: String,
      required: true,
      trim: true,
    },
    claimSet: {
      type: Schema.Types.Mixed,
      required: true,
    },
    eduAmount: {
      type: Number,
      required: true,
      min: 0,
    },
    eduAmountWei: {
      type: String,
      required: true,
      trim: true,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    preparedBy: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    preparedAt: {
      type: Date,
      required: true,
    },
  },
  {
    _id: false,
    id: false,
  }
);

const certificateSubmissionSchema = new Schema(
  {
    studentAddress: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    courseName: {
      type: String,
      required: true,
      trim: true,
    },
    credentialType: {
      type: String,
      enum: CREDENTIAL_TYPES,
      default: "course",
      required: true,
      index: true,
    },
    instituteId: {
      type: Schema.Types.ObjectId,
      ref: "Institute",
      required: true,
      index: true,
    },
    instituteName: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    instituteHash: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    evidenceHash: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    privateEvidenceRef: {
      type: String,
      required: true,
      trim: true,
    },
    publicProofCid: {
      type: String,
      trim: true,
      index: true,
    },
    publicProofPayload: {
      type: Schema.Types.Mixed,
    },
    claimsRoot: {
      type: String,
      trim: true,
      index: true,
    },
    claimSet: {
      type: Schema.Types.Mixed,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: CERTIFICATE_STATUSES,
      default: "pending_review",
      index: true,
    },
    mintState: {
      type: String,
      enum: MINT_STATES,
      default: "unprepared",
      index: true,
    },
    mintDraft: {
      type: mintDraftSchema,
      default: null,
    },
    verificationStatus: {
      type: String,
      enum: VERIFICATION_STATUSES,
      index: true,
    },
    eduAmount: {
      type: Number,
      min: 0,
    },
    eduAmountWei: {
      type: String,
      trim: true,
    },
    tokenId: {
      type: String,
      trim: true,
      unique: true,
      sparse: true,
    },
    txHash: {
      type: String,
      trim: true,
    },
    verifierAddress: {
      type: String,
      trim: true,
      lowercase: true,
    },
    reviewNote: {
      type: String,
      trim: true,
    },
    aiInsight: {
      type: Schema.Types.Mixed,
      default: null,
    },
    expiresAt: {
      type: Date,
      index: true,
    },
    revokedAt: {
      type: Date,
      index: true,
    },
    revocationReason: {
      type: String,
      trim: true,
    },
    revocationReasonHash: {
      type: String,
      trim: true,
    },
    uploadedAt: {
      type: Date,
      default: () => new Date(),
      index: true,
    },
    reviewedAt: Date,
    mintedAt: Date,
    auditTrail: {
      type: [auditTrailEventSchema],
      default: () => [],
    },
  },
  {
    timestamps: true,
  }
);

export type CertificateSubmission = InferSchemaType<
  typeof certificateSubmissionSchema
>;
export type CertificateSubmissionDocument =
  HydratedDocument<CertificateSubmission>;

// Compound indexes for common query patterns
certificateSubmissionSchema.index(
  { studentAddress: 1, evidenceHash: 1 },
  { unique: true }
);
certificateSubmissionSchema.index({ studentAddress: 1, status: 1 });
certificateSubmissionSchema.index({ instituteId: 1, status: 1 });

export const CertificateSubmissionModel =
  models.CertificateSubmission ||
  model("CertificateSubmission", certificateSubmissionSchema);
