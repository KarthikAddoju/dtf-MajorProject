import { buildMerkleTree } from "../lib/merkle";

interface PublicProofInput {
  courseName: string;
  credentialType: string;
  instituteName: string;
  instituteShortCode: string;
  instituteHash: string;
  studentAddress: string;
  evidenceHash: string;
  eduAmount: number;
  expiresAt: string | null;
}

export interface PreparedPublicProof {
  claimSet: Record<string, unknown>;
  claimsRoot: string;
  publicProofPayload: Record<string, unknown>;
}

export function buildPreparedPublicProof(
  input: PublicProofInput
): PreparedPublicProof {
  const claimSet = {
    courseName: input.courseName,
    credentialType: input.credentialType,
    instituteName: input.instituteName,
    instituteShortCode: input.instituteShortCode,
    studentAddress: input.studentAddress,
    evidenceHash: input.evidenceHash,
    eduAmount: input.eduAmount,
    expiresAt: input.expiresAt,
  };
  const merkleTree = buildMerkleTree(claimSet);
  const publicProofPayload = {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://purl.imsglobal.org/spec/ob/v3p0/context.json"
    ],
    type: ["VerifiableCredential", "OpenBadgeCredential"],
    id: `urn:uuid:${input.evidenceHash.replace("0x", "").slice(0, 36)}`,
    issuer: {
      id: `urn:dacs:institute:${input.instituteHash}`,
      type: "Profile",
      name: input.instituteName,
    },
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: `urn:dacs:student:${input.studentAddress}`,
      achievement: {
        id: `urn:dacs:achievement:${input.instituteShortCode}-${input.credentialType}`,
        type: "Achievement",
        name: input.courseName,
        description: `Successfully awarded the ${input.credentialType} on the DACS ledger.`,
      }
    },
    evidence: [{
      id: `urn:dacs:evidence:${input.evidenceHash}`,
      type: "DocumentVerification",
      name: "Encrypted Course Material",
      narrative: "Evidence resides off-chain in encrypted form.",
    }],
    version: "1.0",
    proofType: "DACS_PUBLIC_PROOF",
    courseName: input.courseName,
    credentialType: input.credentialType,
    instituteName: input.instituteName,
    instituteShortCode: input.instituteShortCode,
    instituteHash: input.instituteHash,
    evidenceHash: input.evidenceHash,
    eduAmount: input.eduAmount,
    expiresAt: input.expiresAt,
    claimsRoot: merkleTree.root,
    publicClaimKeys: [
      "courseName",
      "credentialType",
      "instituteName",
      "instituteShortCode",
      "evidenceHash",
      "eduAmount",
      "expiresAt",
    ],
    privacyModel: "private-evidence-public-proof",
    disclosureModel: "merkle-selective-disclosure-v1",
    soulbound: true,
    createdAt: new Date().toISOString(),
  };

  return {
    claimSet,
    claimsRoot: merkleTree.root,
    publicProofPayload,
  };
}
