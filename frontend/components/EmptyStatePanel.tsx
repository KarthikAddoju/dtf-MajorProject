"use client"

import type { ReactNode } from "react"

interface EmptyStatePanelProps {
  title: string
  description: string
  eyebrow?: string
  tone?: "dark" | "light"
  action?: ReactNode
  icon?: ReactNode
  size?: "sm" | "md"
}

export function EmptyStatePanel({
  title,
  description,
  eyebrow = "Nothing here yet",
  tone = "dark",
  action,
  icon,
  size = "md",
}: EmptyStatePanelProps) {
  const shellClassName =
    tone === "light"
      ? "rounded-xl border border-white/[0.08] bg-[#242424] p-8 text-center"
      : "rounded-xl border border-white/[0.08] bg-white/[0.03] p-8 text-center"
  const eyebrowClassName = "text-[#666666]"
  const titleClassName = "text-[#f0f0f0]"
  const descriptionClassName = "text-[#a0a0a0]"
  const iconContainerClassName =
    tone === "light"
      ? "border border-white/[0.08] bg-[#2a2a2a] text-[#a0a0a0]"
      : "border border-white/[0.08] bg-white/[0.04] text-[#a0a0a0]"
  const iconSizeClassName = size === "sm" ? "h-12 w-12" : "h-16 w-16"

  return (
    <div className={shellClassName}>
      {icon ? (
        <div
          className={`mx-auto mb-5 flex items-center justify-center rounded-xl ${iconContainerClassName} ${iconSizeClassName}`}
        >
          {icon}
        </div>
      ) : null}
      <div
        className={`text-[11px] tracking-[0.06em] ${eyebrowClassName}`}
      >
        {eyebrow}
      </div>
      <h3 className={`mt-3 text-[2rem] font-semibold ${titleClassName}`}>
        {title}
      </h3>
      <p className={`mx-auto mt-3 max-w-2xl leading-7 ${descriptionClassName}`}>
        {description}
      </p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  )
}
