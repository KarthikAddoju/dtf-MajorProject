import { formatCredentialTypeLabel } from "@/lib/formatting"
import type { Submission } from "@/lib/types"

export type SubmissionNotificationTone = "minted" | "pending" | "rejected"

export interface SubmissionNotification {
  id: string
  tone: SubmissionNotificationTone
  title: string
  message: string
  timestamp: string
  href: string
  ctaLabel: string
  /** Token ID of the minted credential — only set for minted notifications. */
  tokenId?: string
}

function getNotificationTimestamp(submission: Submission) {
  return submission.mintedAt ?? submission.reviewedAt ?? submission.uploadedAt
}

export function buildSubmissionNotifications(submissions: Submission[]) {
  return [...submissions]
    .sort(
      (left, right) =>
        new Date(getNotificationTimestamp(right)).getTime() -
        new Date(getNotificationTimestamp(left)).getTime()
    )
    .map<SubmissionNotification>((submission) => {
      const credentialType = formatCredentialTypeLabel(submission.credentialType)

      if (submission.status === "minted") {
        return {
          id: submission.id,
          tone: "minted",
          title: `${credentialType} credential minted`,
          message: `"${submission.courseName}" is now live on DACS with token #${
            submission.tokenId ?? "pending"
          } and export-ready proof artifacts.`,
          timestamp: submission.mintedAt ?? submission.reviewedAt ?? submission.uploadedAt,
          href: submission.tokenId ? `/verify?tokenId=${submission.tokenId}` : "/dashboard",
          ctaLabel: "Open Proof Sheet",
          tokenId: submission.tokenId ?? undefined,
        }
      }

      if (submission.status === "rejected") {
        return {
          id: submission.id,
          tone: "rejected",
          title: `${credentialType} submission needs attention`,
          message:
            submission.reviewNote?.trim() ||
            `"${submission.courseName}" was reviewed and needs an updated submission before minting.`,
          timestamp: submission.reviewedAt ?? submission.uploadedAt,
          href: "/upload",
          ctaLabel: "Submit Revision",
        }
      }

      return {
        id: submission.id,
        tone: "pending",
        title: `${credentialType} submission in review`,
        message: `"${submission.courseName}" is queued for institute review and will move to minting once approved.`,
        timestamp: submission.uploadedAt,
        href: "/upload",
        ctaLabel: "View Submission Queue",
      }
    })
}
