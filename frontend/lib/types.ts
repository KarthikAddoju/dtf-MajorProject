export type UserRole = "student" | "admin" | "verifier"

export type AuditTrailEventType =
  | "submission_created"
  | "mint_prepared"
  | "submission_rejected"
  | "submission_minted"
  | "submission_revoked"

export interface AuditTrailEvent {
  id: string
  type: AuditTrailEventType
  title: string
  description: string | null
  actorAddress: string | null
  createdAt: string
  metadata: Record<string, unknown>
}

export interface AuthUser {
  address: string
  role: UserRole
}

export type VerificationStatus = "active" | "expired" | "revoked"

export type AuthFlowState =
  | "idle"
  | "wallet_connected"
  | "connecting_wallet"
  | "awaiting_signature"
  | "authenticated"

export interface Institute {
  id: string
  name: string
  slug: string
  shortCode: string
  isActive: boolean
  verifierAddresses: string[]
  createdAt: string | null
  updatedAt: string | null
}

export type SubmissionStatus = "pending_review" | "rejected" | "minted"
export type CredentialType =
  | "course"
  | "workshop"
  | "quiz"
  | "hackathon"
  | "competition"
  | "seminar"
  | "bootcamp"
  | "internship"
  | "certification"
  | "other"

export const CREDENTIAL_TYPE_OPTIONS: CredentialType[] = [
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
]

export interface Submission {
  id: string
  studentAddress: string
  courseName: string
  credentialType: CredentialType
  instituteId: string
  instituteName: string
  instituteHash: string
  evidenceHash: string
  evidenceUrl: string
  publicProofCid: string | null
  publicProofUrl: string | null
  claimsRoot: string | null
  fileName: string
  mimeType: string
  status: SubmissionStatus
  verificationStatus: VerificationStatus | null
  eduAmount: number | null
  tokenId: string | null
  txHash: string | null
  verifierAddress: string | null
  reviewNote: string | null
  expiresAt: string | null
  revokedAt: string | null
  revocationReason: string | null
  uploadedAt: string
  reviewedAt: string | null
  mintedAt: string | null
  cid: string | null
  ipfsUrl: string | null
  auditTrail: AuditTrailEvent[]
}

export interface CollegeLeaderboardEntry {
  rank: number
  instituteName: string
  slug: string | null
  totalEduMinted: number
  mintedCertificates: number
  uniqueStudents: number
  lastMintedAt: string | null
}

export interface RecentMintActivity {
  id: string
  tokenId: string | null
  courseName: string
  credentialType: CredentialType
  instituteName: string
  studentAddress: string
  verifierAddress: string | null
  eduAmount: number | null
  evidenceHash: string
  publicProofCid: string | null
  publicProofUrl: string | null
  verificationStatus: VerificationStatus | null
  mintedAt: string
  cid: string | null
  txHash: string | null
  ipfsUrl: string | null
}

export interface AnalyticsOverview {
  activeInstitutes: number
  totalEduMinted: number
  mintedCredentials: number
  uniqueStudents: number
  leadInstituteName: string | null
  recentActivity: RecentMintActivity[]
}

export interface InstituteProfileCourse {
  courseName: string
  credentialType: CredentialType
  mintedCount: number
  totalEduMinted: number
}

export interface InstituteProfile {
  institute: Institute
  stats: {
    totalEduMinted: number
    mintedCredentials: number
    uniqueStudents: number
    pendingSubmissions: number
    rejectedSubmissions: number
    lastMintedAt: string | null
  }
  topCourses: InstituteProfileCourse[]
  recentCredentials: RecentMintActivity[]
}

export interface VerificationRecord {
  tokenId: string
  studentAddress: string
  verifierAddress: string
  issuedAt: string
  expiresAt: string | null
  verificationStatus: VerificationStatus
  publicProofCid: string
  claimsRoot: string
  instituteHash: string
  evidenceHash: string | null
  courseName: string
  credentialType: CredentialType
  instituteName: string
  eduAmount: number | null
  txHash: string | null
  publicProofUrl: string | null
  reviewNote: string | null
  revokedAt?: string | null
  revocationReason?: string | null
  auditTrail: AuditTrailEvent[]
  publicProof: Record<string, unknown> | null
  proof: {
    chainId: number
    poctAddress: string
    eduAddress: string
    mintControllerAddress: string
    soulbound: boolean
  }
  cid: string
  ipfsUrl: string | null
  fileName?: string | null
  mimeType?: string | null
  standards: {
    note: string
    issuer: {
      id: string
      type: string
      name: string
      url: string
      description: string
    }
    verifiableCredential: Record<string, unknown>
    openBadgeCredential: Record<string, unknown>
  }
}

export interface PlatformHealth {
  status: "ok" | "degraded"
  checkedAt: string
  services: {
    api: {
      status: "ok" | "degraded"
    }
    database: {
      status: "ok" | "degraded"
      state: string
    }
    blockchain: {
      status: "connected" | "degraded"
      chainId: number | null
      blockNumber: number | null
    }
    ipfs: {
      status: "configured" | "missing"
    }
    auth: {
      status: "configured" | "warning"
    }
    evidenceVault: {
      status: "configured" | "warning"
    }
  }
  contracts: {
    poctAddress: string
    eduAddress: string
    mintControllerAddress: string
  }
}

export interface UploadSubmissionInput {
  certificate: File
  courseName: string
  credentialType: CredentialType
  instituteId: string
}

export interface UploadSubmissionResult {
  submission: Submission
}

export interface MintSubmissionInput {
  submissionId: string
  eduAmount: number
  reviewNote?: string
  expiresAt?: string | null
}

export interface OnChainOwnedCertificate {
  tokenId: string
  publicProofCid: string
  cid: string
  verifierAddress: string
  issuedAt: string
  expiresAt: string | null
  verificationStatus: VerificationStatus
}

export interface PrepareMintResult {
  submission: Submission
  mintPayload: {
    studentAddress: string
    publicProofCid: string
    claimsRoot: string
    instituteHash: string
    eduAmountWei: string
    expiresAt: number
  }
}

export interface FinalizeMintResult {
  submission: Submission
  txHash: string
  tokenId: string
}

export interface RevocationResult {
  submission: Submission
}

export interface DisclosurePackage {
  tokenId: string
  claimsRoot: string
  disclosedClaims: Record<string, unknown>
  merkleProofs: Record<string, string[]>
  audience: string | null
  expiresAt: string | null
}
