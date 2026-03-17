export type UserRole = "student" | "admin"

export type AuditTrailEventType =
  | "submission_created"
  | "submission_rejected"
  | "submission_minted"

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

export interface Institute {
  id: string
  name: string
  slug: string
  shortCode: string
  isActive: boolean
  createdAt: string | null
  updatedAt: string | null
}

export type SubmissionStatus = "pending_review" | "rejected" | "minted"

export interface Submission {
  id: string
  studentAddress: string
  courseName: string
  instituteId: string
  instituteName: string
  cid: string
  fileName: string
  mimeType: string
  status: SubmissionStatus
  eduAmount: number | null
  tokenId: string | null
  txHash: string | null
  verifierAddress: string | null
  reviewNote: string | null
  uploadedAt: string
  reviewedAt: string | null
  mintedAt: string | null
  ipfsUrl: string
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
  instituteName: string
  studentAddress: string
  verifierAddress: string | null
  eduAmount: number | null
  mintedAt: string
  cid: string
  txHash: string | null
  ipfsUrl: string
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
  cid: string
  courseName: string
  instituteName: string
  eduAmount: number | null
  txHash: string | null
  ipfsUrl: string
  fileName: string | null
  mimeType: string | null
  reviewNote: string | null
  auditTrail: AuditTrailEvent[]
  proof: {
    chainId: number
    poctAddress: string
    eduAddress: string
    mintControllerAddress: string
    soulbound: boolean
  }
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
  instituteId: string
}

export interface UploadSubmissionResult {
  submission: Submission
}

export interface MintSubmissionInput {
  submissionId: string
  eduAmount: number
  reviewNote?: string
}

export interface MintSubmissionResult {
  txHash: string
  tokenId: string
  eduAmount: number
  submissionId: string
}

export interface OnChainOwnedCertificate {
  tokenId: string
  cid: string
  verifierAddress: string
  issuedAt: string
}
