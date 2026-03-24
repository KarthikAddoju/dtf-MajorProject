"use client"

import Link from "next/link"
import { useEffect } from "react"

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("[GlobalError]", error)
  }, [error])

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-rose-500/20 bg-rose-500/[0.06]">
        <svg
          className="h-10 w-10 text-rose-400"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
          />
        </svg>
      </div>

      <div className="mb-2 text-[11px] uppercase tracking-[0.3em] text-[#666666]">
        Application Error
      </div>
      <h1 className="mb-3 text-4xl font-semibold text-[#f0f0f0]">
        Something went wrong
      </h1>
      <p className="mx-auto mb-6 max-w-md text-[#a0a0a0]">
        An unexpected error occurred while rendering this page. You can try
        again or return to the home page.
      </p>

      {error.message ? (
        <details className="mx-auto mb-6 max-w-lg text-left">
          <summary className="cursor-pointer text-xs font-medium text-[#666666] hover:text-[#a0a0a0]">
            Technical details
          </summary>
          <pre className="mt-2 max-h-32 overflow-auto rounded-lg border border-white/[0.06] bg-[#111] p-3 font-mono text-xs text-[#a0a0a0]">
            {error.message}
          </pre>
        </details>
      ) : null}

      <div className="flex flex-wrap justify-center gap-3">
        <button
          type="button"
          onClick={reset}
          className="brand-button-secondary px-5 py-3 text-sm"
        >
          Try Again
        </button>
        <Link href="/" className="brand-button-primary px-5 py-3 text-sm">
          Back to Home
        </Link>
      </div>
    </div>
  )
}
