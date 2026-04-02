import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";

const disclosureRecordSchema = new Schema(
  {
    tokenId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    studentAddress: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    claimsRoot: {
      type: String,
      required: true,
      trim: true,
    },
    disclosedClaims: {
      type: Schema.Types.Mixed,
      required: true,
    },
    merkleProofs: {
      type: Schema.Types.Mixed,
      required: true,
    },
    audience: {
      type: String,
      trim: true,
      default: null,
    },
    expiresAt: {
      type: Date,
      default: null,
    },
    claimCount: {
      type: Number,
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

disclosureRecordSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type DisclosureRecord = InferSchemaType<typeof disclosureRecordSchema>;
export type DisclosureRecordDocument = HydratedDocument<DisclosureRecord>;

export const DisclosureRecordModel =
  models.DisclosureRecord || model("DisclosureRecord", disclosureRecordSchema);
