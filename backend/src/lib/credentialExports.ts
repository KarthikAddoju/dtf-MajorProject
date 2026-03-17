interface ExportInput {
  tokenId: string;
  studentAddress: string;
  verifierAddress: string;
  issuedAt: string;
  cid: string;
  courseName: string;
  instituteName: string;
  instituteSlug: string | null;
  eduAmount: number | null;
  txHash: string | null;
  ipfsUrl: string;
  fileName: string | null;
  mimeType: string | null;
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
    input.instituteSlug
  );
  const subjectDid = toDidPkh(input.chainId, input.studentAddress);
  const proofAnchor = {
    type: "BlockchainProofAnchor",
    verificationPage,
    chainId: input.chainId,
    poctAddress: input.poctAddress,
    eduAddress: input.eduAddress,
    mintControllerAddress: input.mintControllerAddress,
    tokenId: input.tokenId,
    txHash: input.txHash,
    ipfsCid: input.cid,
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
      sourceCid: `${normalizeOrigin(frontendOrigin)}/terms#sourceCid`,
    },
  ];

  const criteriaNarrative =
    "The learner submitted evidence through DACS, the institute verifier reviewed the submission, and the credential was minted on-chain after approval.";
  const credentialDescription = `${input.courseName} credential issued by ${input.instituteName}, anchored to DACS and linked to on-chain PoCT token #${input.tokenId}.`;

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
        description: `Academic completion credential for ${input.courseName}.`,
        achievementType: "Certificate",
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
      sourceCid: input.cid,
      verificationPage,
      eduReward: input.eduAmount,
    },
    evidence: [
      {
        id: input.ipfsUrl,
        type: ["Evidence"],
        name: input.fileName ?? `Evidence file for ${input.courseName}`,
        description: `Original certificate evidence stored on IPFS with CID ${input.cid}.`,
        genre: input.mimeType ?? "application/octet-stream",
        narrative: `This evidence supports PoCT token #${input.tokenId} and the public verification page at ${verificationPage}.`,
      },
    ],
    proofAnchor,
  };

  const openBadgeCredential = {
    "@context": sharedContext,
    id: `${verificationPage}#open-badge`,
    type: ["VerifiableCredential", "OpenBadgeCredential"],
    name: `${input.courseName} Completion Badge`,
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
        description: `Completion badge issued for ${input.courseName}.`,
        achievementType: "Certificate",
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
        id: input.ipfsUrl,
        type: ["Evidence"],
        name: input.fileName ?? `${input.courseName} evidence`,
        description: `Supporting evidence file stored on IPFS for ${input.courseName}.`,
        genre: input.mimeType ?? "application/octet-stream",
        narrative: `CID ${input.cid} supports this badge and resolves through the DACS verification page.`,
      },
    ],
    proofAnchor,
  };

  return {
    note: "These exports follow the VC 2.0 and Open Badges 3.0 document models, but this DACS version does not yet attach a DID/Data Integrity issuer proof. Verifiability currently comes from the blockchain, the public verification page, and the IPFS evidence anchor.",
    issuer,
    verifiableCredential,
    openBadgeCredential,
  };
}
