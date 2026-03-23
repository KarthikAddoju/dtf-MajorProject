"use client"

import { formatDateTime } from "@/lib/formatting"
import type { Submission } from "@/lib/types"

interface TimelineStep {
  label: string
  headline: string
  timestamp: string | null
  state: "completed" | "active" | "rejected" | "pending"
}

function buildSteps(submission: Submission): TimelineStep[] {
  const { status, uploadedAt, reviewedAt, mintedAt } = submission

  const submittedStep: TimelineStep = {
    label: "Submitted",
    headline: "Evidence uploaded to the review queue",
    timestamp: uploadedAt,
    state: "completed",
  }

  if (status === "minted") {
    return [
      submittedStep,
      {
        label: "In Review",
        headline: "Reviewer evaluated the credential evidence",
        timestamp: reviewedAt,
        state: "completed",
      },
      {
        label: "Minted",
        headline: "PoCT credential minted and live on-chain",
        timestamp: mintedAt,
        state: "completed",
      },
    ]
  }

  if (status === "rejected") {
    return [
      submittedStep,
      {
        label: "In Review",
        headline: "Reviewer evaluated the credential evidence",
        timestamp: reviewedAt,
        state: "completed",
      },
      {
        label: "Rejected",
        headline: "Submission was rejected by the reviewer",
        timestamp: reviewedAt,
        state: "rejected",
      },
    ]
  }

  // pending_review
  return [
    submittedStep,
    {
      label: "In Review",
      headline: "Awaiting reviewer decision",
      timestamp: null,
      state: "active",
    },
    {
      label: "Minting",
      headline: "Will be minted after approval",
      timestamp: null,
      state: "pending",
    },
  ]
}

function CheckIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  )
}

function XIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

function StepNode({ step, index }: { step: TimelineStep; index: number }) {
  if (step.state === "completed") {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
        <CheckIcon />
      </div>
    )
  }

  if (step.state === "rejected") {
    return (
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-300">
        <XIcon />
      </div>
    )
  }

  if (step.state === "active") {
    return (
      <div className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#4f7ef5]/40 bg-[#4f7ef5]/12 text-[#a5c0f8]">
        <span className="brand-status-dot absolute -right-1 -top-1" />
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </div>
    )
  }

  // pending
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-slate-600 text-sm font-semibold">
      {index + 1}
    </div>
  )
}

interface CredentialTimelineProps {
  submission: Submission
}

export function CredentialTimeline({ submission }: CredentialTimelineProps) {
  const steps = buildSteps(submission)

  return (
    <div className="space-y-0">
      {steps.map((step, index) => (
        <div key={step.label} className="relative flex gap-4 pb-7 last:pb-0">
          {/* Connector line */}
          {index < steps.length - 1 ? (
            <div className="absolute left-5 top-10 bottom-0 w-px bg-white/10" />
          ) : null}

          <StepNode step={step} index={index} />

          <div className="flex-1 pt-1.5 min-w-0">
            <div className="text-[10px] tracking-[0.06em] text-[#666666]">
              {step.label}
            </div>
            <div
              className={`mt-1 text-sm font-medium ${
                step.state === "rejected"
                  ? "text-rose-300"
                  : step.state === "active"
                    ? "text-[#a5c0f8]"
                    : step.state === "pending"
                      ? "text-slate-600"
                      : "text-white"
              }`}
            >
              {step.headline}
            </div>
            {step.timestamp ? (
              <div className="mt-1 text-xs text-slate-500">
                {formatDateTime(step.timestamp)}
              </div>
            ) : step.state === "active" ? (
              <div className="mt-1 text-xs text-[#4f7ef5]/70">
                Waiting for reviewer action...
              </div>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
