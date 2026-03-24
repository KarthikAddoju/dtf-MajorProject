"use client"

import { Skeleton } from "@/components/ui/skeleton"

interface SkeletonBlockProps {
  variant?: "line" | "heading" | "card" | "metric" | "badge"
  lines?: number
  className?: string
}

export function SkeletonBlock({
  variant = "line",
  lines = 1,
  className = "",
}: SkeletonBlockProps) {
  const base = "bg-white/[0.06] skeleton-shimmer"

  if (variant === "heading") {
    return (
      <Skeleton className={`h-8 w-3/4 rounded-xl ${base} ${className}`} />
    )
  }

  if (variant === "badge") {
    return (
      <Skeleton className={`h-7 w-24 rounded-full ${base} ${className}`} />
    )
  }

  if (variant === "metric") {
    return (
      <div
        className={`min-h-[172px] rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 ${className}`}
      >
        <Skeleton className={`mb-4 h-3 w-24 rounded-full ${base}`} />
        <Skeleton className={`h-9 w-1/2 rounded-xl ${base}`} />
        <Skeleton className={`mt-4 h-3 w-3/4 rounded-full ${base}`} />
      </div>
    )
  }

  if (variant === "card") {
    return (
      <div
        className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 ${className}`}
      >
        <Skeleton className={`mb-3 h-5 w-2/3 rounded-lg ${base}`} />
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <Skeleton
              key={i}
              className={`h-4 rounded-full ${base} ${i === lines - 1 ? "w-1/2" : "w-full"}`}
            />
          ))}
        </div>
      </div>
    )
  }

  // "line" variant
  if (lines > 1) {
    return (
      <div className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <Skeleton
            key={i}
            className={`h-4 rounded-full ${base} ${i === lines - 1 ? "w-3/4" : "w-full"}`}
          />
        ))}
      </div>
    )
  }

  return (
    <Skeleton className={`h-4 w-full rounded-full ${base} ${className}`} />
  )
}
