import { MINT_STATES } from "../models/CertificateSubmission";

export type MintState = (typeof MINT_STATES)[number];

export interface MintDraftSnapshot {
  publicProofCid: string;
  publicProofPayload: Record<string, unknown>;
  claimsRoot: string;
  claimSet: Record<string, unknown>;
  eduAmount: number;
  eduAmountWei: string;
  expiresAt: Date | null;
  preparedBy: string | null;
  preparedAt: Date | null;
}

interface MintWorkflowSource {
  status?: string;
  mintState?: MintState | null;
  mintDraft?: {
    publicProofCid?: string | null;
    publicProofPayload?: unknown;
    claimsRoot?: string | null;
    claimSet?: unknown;
    eduAmount?: number | null;
    eduAmountWei?: string | null;
    expiresAt?: Date | null;
    preparedBy?: string | null;
    preparedAt?: Date | null;
  } | null;
  publicProofCid?: string | null;
  publicProofPayload?: unknown;
  claimsRoot?: string | null;
  claimSet?: unknown;
  eduAmount?: number | null;
  eduAmountWei?: string | null;
  expiresAt?: Date | null;
  verifierAddress?: string | null;
  reviewedAt?: Date | null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeMintDraft(
  draft: MintWorkflowSource["mintDraft"]
): MintDraftSnapshot | null {
  if (
    !draft ||
    typeof draft.publicProofCid !== "string" ||
    !draft.publicProofCid.trim() ||
    typeof draft.claimsRoot !== "string" ||
    !draft.claimsRoot.trim() ||
    typeof draft.eduAmount !== "number" ||
    typeof draft.eduAmountWei !== "string" ||
    !draft.eduAmountWei.trim() ||
    !isRecord(draft.publicProofPayload) ||
    !isRecord(draft.claimSet)
  ) {
    return null;
  }

  return {
    publicProofCid: draft.publicProofCid,
    publicProofPayload: draft.publicProofPayload,
    claimsRoot: draft.claimsRoot,
    claimSet: draft.claimSet,
    eduAmount: draft.eduAmount,
    eduAmountWei: draft.eduAmountWei,
    expiresAt: draft.expiresAt ?? null,
    preparedBy: draft.preparedBy ?? null,
    preparedAt: draft.preparedAt ?? null,
  };
}

export function getSubmissionMintDraft(
  source: MintWorkflowSource
): MintDraftSnapshot | null {
  const normalizedDraft = normalizeMintDraft(source.mintDraft);

  if (normalizedDraft) {
    return normalizedDraft;
  }

  if (
    typeof source.publicProofCid !== "string" ||
    !source.publicProofCid.trim() ||
    typeof source.claimsRoot !== "string" ||
    !source.claimsRoot.trim() ||
    typeof source.eduAmount !== "number" ||
    typeof source.eduAmountWei !== "string" ||
    !source.eduAmountWei.trim() ||
    !isRecord(source.publicProofPayload) ||
    !isRecord(source.claimSet)
  ) {
    return null;
  }

  return {
    publicProofCid: source.publicProofCid,
    publicProofPayload: source.publicProofPayload,
    claimsRoot: source.claimsRoot,
    claimSet: source.claimSet,
    eduAmount: source.eduAmount,
    eduAmountWei: source.eduAmountWei,
    expiresAt: source.expiresAt ?? null,
    preparedBy: source.verifierAddress ?? null,
    preparedAt: source.reviewedAt ?? null,
  };
}

export function resolveSubmissionMintState(source: MintWorkflowSource): MintState {
  if (source.status === "minted" || source.mintState === "minted") {
    return "minted";
  }

  if (source.mintState === "prepared" || getSubmissionMintDraft(source)) {
    return "prepared";
  }

  return "unprepared";
}
