"use client"

import type { ReactNode } from "react"

interface EmptyStatePanelProps {
  title: string
  description: string
  eyebrow?: string
  tone?: "dark" | "light"
  action?: ReactNode
}

export function EmptyStatePanel({
  title,
  description,
  eyebrow = "Nothing here yet",
  tone = "dark",
  action,
}: EmptyStatePanelProps) {
  const shellClassName =
    tone === "light"
      ? "rounded-[28px_14px_28px_14px] border border-[#101828]/12 bg-[rgba(255,255,255,0.82)] p-8 text-center"
      : "rounded-[28px_14px_28px_14px] border border-white/10 bg-white/[0.03] p-8 text-center"
  const eyebrowClassName =
    tone === "light"
      ? "text-[#5f7f68]"
      : "text-[#8ea0b8]"
  const titleClassName = tone === "light" ? "text-[#101828]" : "text-white"
  const descriptionClassName =
    tone === "light" ? "text-[#425168]" : "text-slate-400"

  return (
    <div className={shellClassName}>
      <div
        className={`text-[11px] uppercase tracking-[0.28em] ${eyebrowClassName}`}
      >
        {eyebrow}
      </div>
      <h3 className={`display-serif mt-3 text-[2rem] font-semibold ${titleClassName}`}>
        {title}
      </h3>
      <p className={`mx-auto mt-3 max-w-2xl leading-7 ${descriptionClassName}`}>
        {description}
      </p>
      {action ? <div className="mt-6 flex justify-center">{action}</div> : null}
    </div>
  )
}
