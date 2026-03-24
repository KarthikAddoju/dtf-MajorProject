import Link from "next/link"

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-6 text-center">
      <div className="mb-6 flex h-20 w-20 items-center justify-center rounded-2xl border border-white/[0.08] bg-[#1a1a1a]">
        <svg
          className="h-10 w-10 text-[#4f7ef5]"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z"
          />
        </svg>
      </div>

      <div className="mb-2 text-[11px] uppercase tracking-[0.3em] text-[#666666]">
        Error 404
      </div>
      <h1 className="mb-3 text-4xl font-semibold text-[#f0f0f0] sm:text-5xl">
        Page not found
      </h1>
      <p className="mx-auto mb-8 max-w-md text-[#a0a0a0]">
        The route you requested does not exist in the DACS application. It may
        have been moved or the URL may be incorrect.
      </p>

      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/" className="brand-button-primary px-5 py-3 text-sm">
          Back to Home
        </Link>
        <Link
          href="/verify"
          className="brand-button-secondary px-5 py-3 text-sm"
        >
          Verify a Credential
        </Link>
        <Link
          href="/colleges"
          className="brand-button-secondary px-5 py-3 text-sm"
        >
          Browse Institutes
        </Link>
      </div>

      <div className="mx-auto mt-12 grid max-w-2xl grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          {
            href: "/dashboard",
            label: "Student Dashboard",
            description: "View your credentials, EDU balance, and submission history.",
          },
          {
            href: "/upload",
            label: "Upload Credential",
            description: "Submit academic evidence for reviewer verification.",
          },
          {
            href: "/admin",
            label: "Review Console",
            description: "Admin panel for credential review and minting.",
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-xl border border-white/[0.08] bg-[#1a1a1a] p-5 text-left transition hover:border-[#4f7ef5]/30 hover:bg-[#1d2b4a]/20"
          >
            <div className="mb-2 text-sm font-semibold text-[#f0f0f0]">
              {item.label}
            </div>
            <p className="text-xs text-[#a0a0a0]">{item.description}</p>
          </Link>
        ))}
      </div>
    </div>
  )
}
