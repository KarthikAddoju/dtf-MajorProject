import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";

const loginChallengeSchema = new Schema(
  {
    address: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      index: true,
    },
    nonce: {
      type: String,
      required: true,
      trim: true,
    },
    ipAddress: {
      type: String,
      trim: true,
    },
    userAgent: {
      type: String,
      trim: true,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    consumedAt: {
      type: Date,
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

loginChallengeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export type LoginChallenge = InferSchemaType<typeof loginChallengeSchema>;
export type LoginChallengeDocument = HydratedDocument<LoginChallenge>;

export const LoginChallengeModel =
  models.LoginChallenge || model("LoginChallenge", loginChallengeSchema);
