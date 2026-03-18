"use client"

import Link from "next/link"
import { DashboardCard } from "@/components/DashboardCard"
import { EmptyStatePanel } from "@/components/EmptyStatePanel"
import { formatDateTime } from "@/lib/formatting"
import { buildSubmissionNotifications } from "@/lib/notifications"
import type { Submission } from "@/lib/types"

interface SubmissionStatusCenterProps {
  submissions: Submission[]
  title?: string
  emptyTitle?: string
  emptyDescription?: string
}

function getToneClasses(tone: "minted" | "pending" | "rejected") {
  switch (tone) {
    case "minted":
      return {
        badge:
          "border border-[#0f766e]/30 bg-[#0f766e]/12 text-[#c9f0e7]",
        card:
          "border-[#0f766e]/18 bg-[#0f766e]/10",
      }
    case "rejected":
      return {
        badge:
          "border border-rose-500/30 bg-rose-500/10 text-rose-200",
        card:
          "border-rose-500/18 bg-rose-500/10",
      }
    default:
      return {
        badge:
          "border border-[#b8892d]/30 bg-[#b8892d]/12 text-[#f3d9a2]",
        card:
          "border-[#b8892d]/18 bg-[#b8892d]/10",
      }
  }
}

export function SubmissionStatusCenter({
  submissions,
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
            <div className="rounded-2xl border border-[#0f766e]/18 bg-[#0f766e]/10 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[#9fd8ce]">
                Minted
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">{mintedCount}</div>
            </div>
            <div className="rounded-2xl border border-[#b8892d]/18 bg-[#b8892d]/10 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-[#f3d9a2]">
                In Review
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">{pendingCount}</div>
            </div>
            <div className="rounded-2xl border border-rose-500/18 bg-rose-500/10 p-4">
              <div className="text-xs uppercase tracking-[0.2em] text-rose-200">
                Needs Attention
              </div>
              <div className="mt-2 text-2xl font-semibold text-white">{attentionCount}</div>
            </div>
          </div>

          <div className="space-y-3">
            {notifications.slice(0, 4).map((notification) => {
              const tone = getToneClasses(notification.tone)

              return (
                <div
                  key={notification.id}
                  className={`rounded-2xl border p-4 ${tone.card}`}
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="max-w-2xl">
                      <div
                        className={`inline-flex rounded-full px-3 py-1 text-[11px] font-medium uppercase tracking-[0.18em] ${tone.badge}`}
                      >
                        {notification.tone === "minted"
                          ? "Ready"
                          : notification.tone === "rejected"
                            ? "Action Needed"
                            : "In Review"}
                      </div>
                      <h3 className="mt-3 text-lg font-semibold text-white">
                        {notification.title}
                      </h3>
                      <p className="mt-2 text-sm leading-6 text-slate-300">
                        {notification.message}
                      </p>
                    </div>

                    <div className="text-sm text-slate-400">
                      {formatDateTime(notification.timestamp)}
                    </div>
                  </div>

                  <div className="mt-4">
                    <Link
                      href={notification.href}
                      className="inline-flex rounded-full border border-white/10 bg-black/20 px-4 py-2 text-sm font-medium text-white transition hover:bg-white/10"
                    >
                      {notification.ctaLabel}
                    </Link>
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
