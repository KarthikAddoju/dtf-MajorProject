interface ExportInput {
  tokenId: string;
  studentAddress: string;
  verifierAddress: string;
  issuedAt: string;
  expiresAt: string | null;
  verificationStatus: string;
  publicProofCid: string;
  claimsRoot: string;
  courseName: string;
  credentialType: string;
  instituteName: string;
  evidenceHash: string | null;
  eduAmount: number | null;
  txHash: string | null;
  publicProofUrl: string | null;
  chainId: number;
  poctAddress: string;
  eduAddress: string;
  mintControllerAddress: string;
  soulbound: boolean;
}

interface IssuerProfile {
  id: string;
  type: "Profile";
  name: string;
  url: string;
  description: string;
}

function normalizeOrigin(origin: string) {
  return origin.endsWith("/") ? origin.slice(0, -1) : origin;
}

function buildUrl(origin: string, path: string) {
  return new URL(path, normalizeOrigin(origin)).toString();
}

function toDidPkh(chainId: number, address: string) {
  return `did:pkh:eip155:${chainId}:${address.toLowerCase()}`;
}

function formatCredentialTypeLabel(credentialType: string) {
  return credentialType
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
}

function mapAchievementType(credentialType: string) {
  switch (credentialType) {
    case "workshop":
      return "Workshop";
    case "quiz":
      return "Assessment";
    case "hackathon":
      return "Competition";
    case "competition":
      return "Competition";
    case "seminar":
      return "Seminar";
    case "bootcamp":
      return "Course";
    case "internship":
      return "Internship";
    case "certification":
      return "Certification";
    case "other":
      return "Achievement";
    default:
      return "Certificate";
  }
}

function buildIssuerProfile(
  frontendOrigin: string,
  instituteName: string,
  instituteSlug: string | null
): IssuerProfile {
  const issuerUrl = instituteSlug
    ? buildUrl(frontendOrigin, `/colleges/${instituteSlug}`)
    : buildUrl(frontendOrigin, "/colleges");

  return {
    id: `${issuerUrl}#issuer`,
    type: "Profile",
    name: instituteName,
    url: issuerUrl,
    description: `${instituteName} issuer profile on the DACS academic trust network.`,
  };
}

export function buildCredentialExports(
  input: ExportInput,
  frontendOrigin: string
) {
  const verificationPage = buildUrl(
    frontendOrigin,
    `/verify?tokenId=${encodeURIComponent(input.tokenId)}`
  );
  const issuer = buildIssuerProfile(
    frontendOrigin,
    input.instituteName,
    null
  );
  const subjectDid = toDidPkh(input.chainId, input.studentAddress);
  const credentialTypeLabel = formatCredentialTypeLabel(input.credentialType);
  const achievementType = mapAchievementType(input.credentialType);
  const proofAnchor = {
    type: "BlockchainProofAnchor",
    verificationPage,
    chainId: input.chainId,
    poctAddress: input.poctAddress,
    eduAddress: input.eduAddress,
    mintControllerAddress: input.mintControllerAddress,
    tokenId: input.tokenId,
    txHash: input.txHash,
    publicProofCid: input.publicProofCid,
    claimsRoot: input.claimsRoot,
    evidenceHash: input.evidenceHash,
    verificationStatus: input.verificationStatus,
    expiresAt: input.expiresAt,
    soulbound: input.soulbound,
  };
  const sharedContext = [
    "https://www.w3.org/ns/credentials/v2",
    "https://purl.imsglobal.org/spec/ob/v3p0/context-3.0.3.json",
    {
      proofAnchor: `${normalizeOrigin(frontendOrigin)}/terms#proofAnchor`,
      verificationPage: `${normalizeOrigin(frontendOrigin)}/terms#verificationPage`,
      eduReward: `${normalizeOrigin(frontendOrigin)}/terms#eduReward`,
      tokenId: `${normalizeOrigin(frontendOrigin)}/terms#tokenId`,
      institute: `${normalizeOrigin(frontendOrigin)}/terms#institute`,
      publicProofCid: `${normalizeOrigin(frontendOrigin)}/terms#publicProofCid`,
      claimsRoot: `${normalizeOrigin(frontendOrigin)}/terms#claimsRoot`,
      evidenceHash: `${normalizeOrigin(frontendOrigin)}/terms#evidenceHash`,
    },
  ];

  const criteriaNarrative =
    "The learner submitted evidence through DACS, the institute verifier reviewed the submission, and the credential was minted on-chain after approval.";
  const credentialDescription = `${credentialTypeLabel} credential "${input.courseName}" issued by ${input.instituteName}, anchored to DACS and linked to on-chain PoCT token #${input.tokenId}.`;

  const verifiableCredential = {
    "@context": sharedContext,
    id: `${verificationPage}#vc`,
    type: ["VerifiableCredential"],
    name: `${input.courseName} Academic Credential`,
    description: credentialDescription,
    issuer,
    validFrom: input.issuedAt,
    credentialSubject: {
      id: subjectDid,
      achievement: {
        id: `${verificationPage}#achievement`,
        type: "Achievement",
        name: input.courseName,
        description: `${credentialTypeLabel} credential issued for ${input.courseName}.`,
        achievementType,
        criteria: {
          type: "Criteria",
          narrative: criteriaNarrative,
        },
      },
      institute: {
        id: issuer.url,
        name: input.instituteName,
      },
      tokenId: input.tokenId,
      credentialType: input.credentialType,
      publicProofCid: input.publicProofCid,
      claimsRoot: input.claimsRoot,
      evidenceHash: input.evidenceHash,
      verificationPage,
      eduReward: input.eduAmount,
    },
    evidence: [
      {
        id: input.publicProofUrl ?? verificationPage,
        type: ["Evidence"],
        name: `Public proof bundle for ${input.courseName}`,
        description: `Immutable public proof metadata stored at CID ${input.publicProofCid}.`,
        genre: "application/json",
        narrative:
          "The original evidence remains private; verification uses the public proof bundle, the evidence hash, and the on-chain claims root.",
      },
    ],
    proofAnchor,
  };

  const openBadgeCredential = {
    "@context": sharedContext,
    id: `${verificationPage}#open-badge`,
    type: ["VerifiableCredential", "OpenBadgeCredential"],
    name: `${input.courseName} ${credentialTypeLabel} Badge`,
    description: credentialDescription,
    issuer,
    validFrom: input.issuedAt,
    awardedDate: input.issuedAt,
    credentialSubject: {
      id: subjectDid,
      type: "AchievementSubject",
      achievement: {
        id: `${verificationPage}#achievement`,
        type: "Achievement",
        name: input.courseName,
        description: `${credentialTypeLabel} badge issued for ${input.courseName}.`,
        achievementType,
        criteria: {
          type: "Criteria",
          narrative: criteriaNarrative,
        },
      },
      narrative: `Credential earner wallet ${input.studentAddress.toLowerCase()} owns DACS token #${input.tokenId}.`,
      identifier: [
        {
          type: "IdentifierEntry",
          identifierType: "tokenId",
          identifier: input.tokenId,
        },
      ],
    },
    evidence: [
      {
        id: input.publicProofUrl ?? verificationPage,
        type: ["Evidence"],
        name: `${input.courseName} public proof bundle`,
        description: `Supporting public proof metadata stored on IPFS for ${input.courseName}.`,
        genre: "application/json",
        narrative: `CID ${input.publicProofCid} supports this badge and resolves through the DACS verification page without exposing the original evidence file.`,
      },
    ],
    proofAnchor,
  };

  return {
    note: "These exports follow the VC 2.0 and Open Badges 3.0 document models, but this DACS version does not yet attach a DID/Data Integrity issuer proof. Verifiability currently comes from the blockchain, the claims root, and the immutable public proof bundle.",
    issuer,
    verifiableCredential,
    openBadgeCredential,
  };
}
