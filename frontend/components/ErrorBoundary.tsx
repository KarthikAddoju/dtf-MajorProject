"use client"

import { Component, type ErrorInfo, type ReactNode } from "react"

interface ErrorBoundaryProps {
  children: ReactNode
  fallback?: ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack)
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback
      }

      return (
        <div
          role="alert"
          className="mx-auto max-w-2xl rounded-xl border border-rose-500/20 bg-rose-500/[0.06] p-8 text-center"
        >
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full border border-rose-500/25 bg-rose-500/10">
            <svg
              className="h-6 w-6 text-rose-400"
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

          <h2 className="mb-2 text-lg font-semibold text-rose-300">
            Something went wrong
          </h2>
          <p className="mb-6 text-sm text-[#a0a0a0]">
            An unexpected error occurred while rendering this section. You can
            try recovering below, or reload the page if the issue persists.
          </p>

          {this.state.error ? (
            <details className="mb-6 text-left">
              <summary className="cursor-pointer text-xs font-medium text-[#666666] hover:text-[#a0a0a0]">
                Technical details
              </summary>
              <pre className="mt-2 max-h-40 overflow-auto rounded-lg border border-white/[0.06] bg-[#111] p-3 font-mono text-xs text-[#a0a0a0]">
                {this.state.error.message}
              </pre>
            </details>
          ) : null}

          <div className="flex justify-center gap-3">
            <button
              type="button"
              onClick={this.handleReset}
              className="brand-button-secondary px-5 py-2.5 text-sm"
            >
              Try Again
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="brand-button-primary px-5 py-2.5 text-sm"
            >
              Reload Page
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
