import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";
import { AUDIT_TRAIL_EVENT_TYPES } from "../lib/audit";

export const CERTIFICATE_STATUSES = [
  "pending_review",
  "rejected",
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
    cid: {
      type: String,
      required: true,
      trim: true,
      index: true,
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
      index: true,
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

export const CertificateSubmissionModel =
  models.CertificateSubmission ||
  model("CertificateSubmission", certificateSubmissionSchema);
