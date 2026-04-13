"use client"

import { motion } from "framer-motion"

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

  const motionProps = {
    initial: { opacity: 0.6 },
    animate: { opacity: 1 },
    transition: {
      repeat: Infinity,
      repeatType: "reverse" as const,
      duration: 1.5,
    },
  }

  if (variant === "heading") {
    return (
      <motion.div {...motionProps} className={`h-8 w-3/4 rounded-xl ${base} ${className}`} />
    )
  }

  if (variant === "badge") {
    return (
      <motion.div {...motionProps} className={`h-7 w-24 rounded-full ${base} ${className}`} />
    )
  }

  if (variant === "metric") {
    return (
      <motion.div
        {...motionProps}
        className={`min-h-[172px] rounded-xl border border-white/[0.08] bg-white/[0.03] p-6 ${className}`}
      >
        <div className={`mb-4 h-3 w-24 rounded-full ${base}`} />
        <div className={`h-9 w-1/2 rounded-xl ${base}`} />
        <div className={`mt-4 h-3 w-3/4 rounded-full ${base}`} />
      </motion.div>
    )
  }

  if (variant === "card") {
    return (
      <motion.div
        {...motionProps}
        className={`rounded-2xl border border-white/10 bg-white/[0.03] p-5 ${className}`}
      >
        <div className={`mb-3 h-5 w-2/3 rounded-lg ${base}`} />
        <div className="space-y-2">
          {Array.from({ length: lines }).map((_, i) => (
            <div
              key={i}
              className={`h-4 rounded-full ${base} ${i === lines - 1 ? "w-1/2" : "w-full"}`}
            />
          ))}
        </div>
      </motion.div>
    )
  }

  // "line" variant
  if (lines > 1) {
    return (
      <motion.div {...motionProps} className={`space-y-2 ${className}`}>
        {Array.from({ length: lines }).map((_, i) => (
          <div
            key={i}
            className={`h-4 rounded-full ${base} ${i === lines - 1 ? "w-3/4" : "w-full"}`}
          />
        ))}
      </motion.div>
    )
  }

  return (
    <motion.div {...motionProps} className={`h-4 w-full rounded-full ${base} ${className}`} />
  )
}
