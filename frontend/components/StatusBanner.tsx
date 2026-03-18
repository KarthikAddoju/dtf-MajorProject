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
    "border-[#8ea0b8]/18 bg-[rgba(142,160,184,0.08)] text-[#d5deea]",
  info: "border-[#8bbbd5]/18 bg-[#8bbbd5]/10 text-[#d6edf8]",
  success: "border-[#77997f]/24 bg-[#77997f]/10 text-[#d7ebd8]",
  warning: "border-[#f0c57f]/24 bg-[#f0c57f]/10 text-[#fde4b8]",
  error: "border-rose-500/24 bg-rose-500/10 text-[#f7c8d5]",
}

const progressClasses: Record<StatusBannerTone, string> = {
  neutral: "bg-[linear-gradient(90deg,#94a3b8,#cbd5e1)]",
  info: "bg-[linear-gradient(90deg,#8bbbd5,#d25b36)]",
  success: "bg-[linear-gradient(90deg,#5f9d78,#9fd1ab)]",
  warning: "bg-[linear-gradient(90deg,#d39a35,#f0c57f)]",
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
        "rounded-[24px_12px_24px_12px] border",
        compact ? "px-4 py-3" : "px-5 py-4",
        toneClasses[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] opacity-85">
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
          <div className="mb-2 flex items-center justify-between text-xs uppercase tracking-[0.18em] opacity-80">
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
