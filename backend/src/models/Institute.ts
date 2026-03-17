import { HydratedDocument, InferSchemaType, Schema, model, models } from "mongoose";

const instituteSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
      unique: true,
      index: true,
    },
    shortCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
      unique: true,
      index: true,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export type Institute = InferSchemaType<typeof instituteSchema>;
export type InstituteDocument = HydratedDocument<Institute>;

export const InstituteModel =
  models.Institute || model("Institute", instituteSchema);
