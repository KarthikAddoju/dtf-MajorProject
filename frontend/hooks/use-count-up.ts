"use client"

import { useEffect, useRef, useState } from "react"

export function useCountUp(
  target: number,
  duration = 1200,
  enabled = true
): number {
  const [current, setCurrent] = useState(0)
  const frameRef = useRef<number | null>(null)
  const startTimeRef = useRef<number | null>(null)
  const shouldAnimate = enabled && target !== 0

  useEffect(() => {
    if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    startTimeRef.current = null
    if (!shouldAnimate) return

    function step(timestamp: number) {
      if (!startTimeRef.current) startTimeRef.current = timestamp
      const elapsed = timestamp - startTimeRef.current
      const progress = Math.min(elapsed / duration, 1)
      // Ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3)
      setCurrent(Math.round(eased * target))

      if (progress < 1) {
        frameRef.current = requestAnimationFrame(step)
      }
    }

    frameRef.current = requestAnimationFrame(step)

    return () => {
      if (frameRef.current !== null) cancelAnimationFrame(frameRef.current)
    }
  }, [target, duration, shouldAnimate])

  return shouldAnimate ? current : target
}
