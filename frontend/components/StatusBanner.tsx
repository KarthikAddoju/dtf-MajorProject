"use client"

import type { ReactNode } from "react"

type StatusBannerTone = "neutral" | "info" | "success" | "warning" | "error"

interface StatusBannerProps {
  title: string
  message: string
  tone?: StatusBannerTone
  progress?: number | null
  compact?: boolean
  action?: ReactNode
  className?: string
}

const toneClasses: Record<StatusBannerTone, string> = {
  neutral:
    "border-white/[0.10] bg-white/[0.04] text-[#a0a0a0]",
  info: "border-[#4f7ef5]/20 bg-[#4f7ef5]/08 text-[#a5c0f8]",
  success: "border-emerald-500/25 bg-emerald-500/08 text-emerald-300",
  warning: "border-amber-500/25 bg-amber-500/10 text-amber-200",
  error: "border-rose-500/25 bg-rose-500/10 text-rose-300",
}

const progressClasses: Record<StatusBannerTone, string> = {
  neutral: "bg-[linear-gradient(90deg,#666666,#a0a0a0)]",
  info: "bg-[linear-gradient(90deg,#4f7ef5,#6fa8f8)]",
  success: "bg-[linear-gradient(90deg,#10b981,#34d399)]",
  warning: "bg-[linear-gradient(90deg,#d97706,#fbbf24)]",
  error: "bg-[linear-gradient(90deg,#be185d,#fb7185)]",
}

export function StatusBanner({
  title,
  message,
  tone = "info",
  progress,
  compact = false,
  action,
  className,
}: StatusBannerProps) {
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      aria-live={tone === "error" ? "assertive" : "polite"}
      className={[
        "rounded-xl border",
        compact ? "px-4 py-3" : "px-5 py-4",
        toneClasses[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold tracking-[0.08em] opacity-85">
            {title}
          </div>
          <p className={compact ? "mt-1 text-sm leading-6" : "mt-1.5 text-sm leading-6"}>
            {message}
          </p>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </div>

      {typeof progress === "number" ? (
        <div className="mt-3">
          <div className="mb-2 flex items-center justify-between text-xs tracking-[0.06em] opacity-80">
            <span>Progress</span>
            <span>{Math.max(0, Math.min(100, Math.round(progress)))}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-black/15">
            <div
              className={`h-full rounded-full transition-all ${progressClasses[tone]}`}
              style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}
