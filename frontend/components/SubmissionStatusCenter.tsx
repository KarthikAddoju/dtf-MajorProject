"use client"

import Link from "next/link"
import { DashboardCard } from "@/components/DashboardCard"
import { EmptyStatePanel } from "@/components/EmptyStatePanel"
import { formatDateTime } from "@/lib/formatting"
import { buildSubmissionNotifications } from "@/lib/notifications"
import type { Submission } from "@/lib/types"

interface SubmissionStatusCenterProps {
  submissions: Submission[]
  staleTokenIds?: ReadonlySet<string>
  title?: string
  emptyTitle?: string
  emptyDescription?: string
}

function getToneClasses(tone: "minted" | "pending" | "rejected") {
  switch (tone) {
    case "minted":
      return {
        badge:
          "border border-emerald-500/25 bg-emerald-500/10 text-emerald-300",
        card:
          "border-emerald-500/15 bg-emerald-500/06",
      }
    case "rejected":
      return {
        badge:
          "border border-rose-500/25 bg-rose-500/10 text-rose-300",
        card:
          "border-rose-500/15 bg-rose-500/06",
      }
    default:
      return {
        badge:
          "border border-amber-500/25 bg-amber-500/10 text-amber-200",
        card:
          "border-amber-500/15 bg-amber-500/06",
      }
  }
}

export function SubmissionStatusCenter({
  submissions,
  staleTokenIds,
  title = "Student Status Center",
  emptyTitle = "No status updates yet",
  emptyDescription = "Once you submit a credential, review and mint updates will appear here with the next recommended action.",
}: SubmissionStatusCenterProps) {
  const notifications = buildSubmissionNotifications(submissions)
  const mintedCount = submissions.filter(
    (submission) => submission.status === "minted"
  ).length
  const pendingCount = submissions.filter(
    (submission) => submission.status === "pending_review"
  ).length
  const attentionCount = submissions.filter(
    (submission) => submission.status === "rejected"
  ).length

  return (
    <DashboardCard title={title}>
      {notifications.length === 0 ? (
        <EmptyStatePanel
          eyebrow="Signal stream"
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-emerald-500/15 bg-emerald-500/06 p-4">
              <div className="text-xs text-[#666666]">
                Minted
              </div>
              <div className="mt-2 text-2xl font-semibold text-[#f0f0f0]">{mintedCount}</div>
            </div>
            <div className="rounded-xl border border-amber-500/15 bg-amber-500/06 p-4">
              <div className="text-xs text-[#666666]">
                In Review
              </div>
              <div className="mt-2 text-2xl font-semibold text-[#f0f0f0]">{pendingCount}</div>
            </div>
            <div className="rounded-xl border border-rose-500/15 bg-rose-500/06 p-4">
              <div className="text-xs text-[#666666]">
                Needs Attention
              </div>
              <div className="mt-2 text-2xl font-semibold text-[#f0f0f0]">{attentionCount}</div>
            </div>
          </div>

          <div className="space-y-3">
            {notifications.slice(0, 4).map((notification) => {
              const isStale =
                notification.tone === "minted" &&
                notification.tokenId != null &&
                (staleTokenIds?.has(notification.tokenId) ?? false)
              const tone = isStale
                ? getToneClasses("pending")
                : getToneClasses(notification.tone)

              return (
                <div
                  key={notification.id}
                  className={`rounded-xl border p-4 ${tone.card}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-2xl">
                      <div
                        className={`inline-flex rounded-full px-3 py-1 text-[11px] font-medium ${tone.badge}`}
                      >
                        {isStale
                          ? "Chain Stale"
                          : notification.tone === "minted"
                            ? "Ready"
                            : notification.tone === "rejected"
                              ? "Action Needed"
                              : "In Review"}
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-[#f0f0f0]">
                        {notification.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-[#a0a0a0]">
                        {isStale
                          ? `Token #${notification.tokenId} is not present on the current chain. The persistent local devnet was likely reset or replaced with a fresh chain after this credential was minted.`
                          : notification.message}
                      </p>
                    </div>

                    <div className="text-sm text-[#666666]">
                      {formatDateTime(notification.timestamp)}
                    </div>
                  </div>

                  <div className="mt-4">
                    {isStale ? (
                      <span className="inline-flex cursor-not-allowed rounded-full border border-white/[0.06] bg-white/[0.02] px-4 py-2 text-sm font-medium text-[#666666]">
                        Token Unavailable
                      </span>
                    ) : (
                      <Link
                        href={notification.href}
                        className="inline-flex rounded-full border border-white/[0.10] bg-white/[0.04] px-4 py-2 text-sm font-medium text-[#f0f0f0] transition hover:bg-white/[0.08]"
                      >
                        {notification.ctaLabel}
                      </Link>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </DashboardCard>
  )
}
