import { Types } from "mongoose";
import type { AuthTokenPayload } from "../middleware/authMiddleware";
import { InstituteModel } from "../models/Institute";
import { normalizeWalletAddress } from "./institutes";

export function isReviewerRole(role: string) {
  return role === "admin" || role === "verifier";
}

export function instituteHasVerifierAddress(
  verifierAddresses: string[] | undefined,
  address: string
) {
  const normalizedAddress = normalizeWalletAddress(address);

  return (verifierAddresses ?? []).includes(normalizedAddress);
}

export async function getReviewerInstituteIds(address: string) {
  const institutes = await InstituteModel.find({
    verifierAddresses: normalizeWalletAddress(address),
  })
    .select("_id")
    .lean();

  return institutes.map((institute) =>
    institute._id instanceof Types.ObjectId
      ? institute._id
      : new Types.ObjectId(String(institute._id))
  );
}

export async function buildReviewerSubmissionScope(user?: AuthTokenPayload) {
  if (!user) {
    return null;
  }

  if (user.role === "admin") {
    return {};
  }

  if (user.role !== "verifier") {
    return null;
  }

  const instituteIds = await getReviewerInstituteIds(user.address);

  return {
    instituteId: {
      $in: instituteIds,
    },
  };
}

export async function assertInstituteReviewerAccess(
  user: AuthTokenPayload | undefined,
  instituteId: unknown
) {
  if (!user || !isReviewerRole(user.role)) {
    return false;
  }

  if (user.role === "admin") {
    return true;
  }

  const institute = await InstituteModel.findById(instituteId)
    .select("verifierAddresses")
    .lean();

  return instituteHasVerifierAddress(institute?.verifierAddresses, user.address);
}
