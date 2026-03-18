import mongoose from "mongoose";

const CREDENTIAL_TYPE_SET = new Set([
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
]);

export function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function isOptionalString(value: unknown): value is string | undefined {
  return value === undefined || typeof value === "string";
}

export function isValidObjectId(value: string) {
  return mongoose.Types.ObjectId.isValid(value);
}

export function normalizeAddress(address: string) {
  return address.toLowerCase();
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
}

export function parsePositiveNumber(value: unknown) {
  const parsedValue =
    typeof value === "number" ? value : Number.parseFloat(String(value));

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return null;
  }

  return parsedValue;
}

export function isCredentialType(value: unknown): value is string {
  return typeof value === "string" && CREDENTIAL_TYPE_SET.has(value);
}
