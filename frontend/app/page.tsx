"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { PageLayout } from "@/components/PageLayout"
import { FeatureCard } from "@/components/FeatureCard"
import { StatusBanner } from "@/components/StatusBanner"
import { useAuth } from "@/components/AuthProvider"
import { useCountUp } from "@/hooks/use-count-up"
import { useInViewport } from "@/hooks/use-in-viewport"
import {
  fetchAnalyticsOverview,
  fetchPlatformHealth,
  isAbortError,
} from "@/lib/api"
import {
  formatCredentialTypeLabel,
  formatDateTime,
  truncateValue,
} from "@/lib/formatting"
import { getWalletNetworkLabel, getWalletSignInLabel } from "@/lib/wallet"
import type { AnalyticsOverview, PlatformHealth } from "@/lib/types"

function StatCounter({
  value,
  label,
}: {
  value: number | null
  label: string
}) {
  const { ref, inView } = useInViewport()
  const animated = useCountUp(value ?? 0, 1200, inView && value !== null)
  return (
    <div
      ref={ref}
      className="rounded-xl border border-white/[0.08] bg-[#2a2a2a] px-5 py-5 shadow-[0_12px_30px_rgba(8,12,20,0.08)]"
    >
      <div className="text-[11px] uppercase tracking-[0.28em] text-[#666666]">
        {label}
      </div>
      <div className="mt-3 text-[1.85rem] leading-none text-[#f0f0f0]">
        {value !== null ? animated.toLocaleString() : "—"}
      </div>
    </div>
  )
}

function getStatusStyles(status: string) {
  switch (status) {
    case "ok":
    case "configured":
    case "connected":
      return "border-[#0f766e]/30 bg-[#0f766e]/12 text-[#c9f0e7]"
    case "warning":
      return "border-amber-500/25 bg-amber-500/10 text-amber-200"
    default:
      return "border-[#7f2f47]/30 bg-[#7f2f47]/12 text-[#efc2cf]"
  }
}

export default function HomePage() {
  const {
    authFlowState,
    chainId,
    connectAndSignIn,
    connectedWalletAddress,
    hasWalletProvider,
    isAuthenticated,
    isAuthenticating,
    isReady,
    isSupportedNetwork,
    user,
    walletNote,
    walletWarning,
  } = useAuth()
  const [analyticsOverview, setAnalyticsOverview] = useState<AnalyticsOverview | null>(
    null
  )
  const [platformHealth, setPlatformHealth] = useState<PlatformHealth | null>(null)

  useEffect(() => {
    const controller = new AbortController()

    async function loadStats() {
      try {
        const [analyticsResponse, healthResponse] = await Promise.all([
          fetchAnalyticsOverview(controller.signal),
          fetchPlatformHealth(controller.signal),
        ])

        if (controller.signal.aborted) {
          return
        }

        setAnalyticsOverview(analyticsResponse.overview)
        setPlatformHealth(healthResponse)
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          return
        }

        setAnalyticsOverview(null)
        setPlatformHealth(null)
      }
    }

    loadStats()

    return () => controller.abort()
  }, [])

  const networkLabel = getWalletNetworkLabel(chainId)
  const recommendedAction = useMemo(() => {
    if (!hasWalletProvider) {
      return {
        kind: "link" as const,
        href: "/verify",
        label: "Explore Public Verification",
        description:
          "MetaMask is not available in this browser yet, so public trust and verification flows are the best entry point.",
      }
    }

    if (!connectedWalletAddress) {
      return {
        kind: "button" as const,
        label: "Connect Wallet To Start",
        description:
          "Connect MetaMask first so DACS can restore your wallet identity and unlock signed student or reviewer flows.",
      }
    }

    if (!isSupportedNetwork) {
      return {
        kind: "button" as const,
        label: "Switch Network And Sign In",
        description:
          "Your wallet is connected, but the configured DACS network must be selected before upload, minting, and private dashboards can continue.",
      }
    }

    if (!isAuthenticated) {
      return {
        kind: "button" as const,
        label: "Complete Signed Session",
        description:
          "Finish the wallet signature challenge so DACS can restore your role and secure API access.",
      }
    }

    if (user?.role === "admin" || user?.role === "verifier") {
      return {
        kind: "link" as const,
        href: "/admin",
        label: "Open Review Console",
        description:
          "Review pending submissions, prepare public proof payloads, and submit wallet-signed mint or revoke transactions.",
      }
    }

    return {
      kind: "link" as const,
      href: "/upload",
      label: "Upload A New Credential",
      description:
        "You are signed in as a student, so the next premium path is drag-and-drop upload into the review queue.",
    }
  }, [
    connectedWalletAddress,
    hasWalletProvider,
    isAuthenticated,
    isSupportedNetwork,
    user?.role,
  ])
  const sessionTiles = useMemo(
    () => [
      {
        label: "Wallet Provider",
        value: hasWalletProvider ? "MetaMask detected" : "MetaMask not detected",
        tone: hasWalletProvider
          ? "border-[#0f766e]/30 bg-[#0f766e]/12 text-[#c9f0e7]"
          : "border-amber-500/25 bg-amber-500/10 text-amber-200",
      },
      {
        label: "Connected Wallet",
        value: connectedWalletAddress
          ? `${connectedWalletAddress.slice(0, 8)}...${connectedWalletAddress.slice(-6)}`
          : "Not connected",
        tone: connectedWalletAddress
          ? "border-amber-500/25 bg-amber-500/10 text-amber-200"
          : "border-[#3a3020]/70 bg-black/20 text-[#d3cdc1]",
      },
      {
        label: "Network",
        value: networkLabel,
        tone:
          connectedWalletAddress && isSupportedNetwork
            ? "border-[#0f766e]/30 bg-[#0f766e]/12 text-[#c9f0e7]"
            : connectedWalletAddress
              ? "border-amber-500/25 bg-amber-500/10 text-amber-200"
              : "border-[#3a3020]/70 bg-black/20 text-[#d3cdc1]",
      },
      {
        label: "Session",
        value: isAuthenticated
          ? user?.role === "admin"
            ? "Admin authenticated"
            : user?.role === "verifier"
              ? "Verifier authenticated"
              : "Student authenticated"
          : authFlowState === "awaiting_signature"
            ? "Awaiting signature"
            : authFlowState === "connecting_wallet"
              ? "Connecting wallet"
              : authFlowState === "wallet_connected"
                ? "Wallet connected"
                : isReady
                  ? "Awaiting sign-in"
                  : "Restoring session",
        tone: isAuthenticated
          ? "border-[#0f766e]/30 bg-[#0f766e]/12 text-[#c9f0e7]"
          : authFlowState === "awaiting_signature" ||
              authFlowState === "connecting_wallet"
            ? "border-amber-500/25 bg-amber-500/10 text-amber-200"
            : connectedWalletAddress
              ? "border-[#4f7ef5]/25 bg-[#4f7ef5]/10 text-[#a5c0f8]"
              : "border-[#3a3020]/70 bg-black/20 text-[#d3cdc1]",
      },
    ],
    [
      connectedWalletAddress,
      hasWalletProvider,
      isAuthenticated,
      isReady,
      isSupportedNetwork,
      authFlowState,
      networkLabel,
      user?.role,
    ]
  )
  const demoChecklist = useMemo(
    () => [
      "Student signs in and submits academic credential evidence into private encrypted storage.",
      "An authorized reviewer prepares the public proof payload and submits the mint from their own wallet.",
      "Public verifier opens the token-backed record and scans the QR link.",
      "Student dashboard and college index reflect the minted outcome live.",
    ],
    []
  )
  const recentActivity = analyticsOverview?.recentActivity ?? []

  return (
    <PageLayout>
      <section className="space-y-8">
        <div className="grid gap-8 xl:grid-cols-[1.08fr_0.92fr] xl:items-start">
          <div className="brand-panel-light px-8 py-10 sm:px-10 lg:px-12">
            <div className="relative">
              <div className="brand-kicker">Credential Operating System</div>
              <div className="mt-6 text-[11px] uppercase tracking-[0.34em] text-[#666666]">
                DACS / Proof-first academic trust network
              </div>
              <h1 className="display-serif mt-4 max-w-4xl text-5xl font-semibold leading-[0.94] text-[#f0f0f0] sm:text-6xl xl:text-[5.25rem]">
                Academic credentials that feel official, verify instantly, and carry evidence end to end.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#a0a0a0]">
                DACS turns student achievement into a premium proof artifact: upload
                into private encrypted storage, review through a wallet-driven
                verification console, mint a soulbound credential, reward EDU, and
                publish a public verification sheet that looks trustworthy on first glance.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {isAuthenticated && (user?.role === "admin" || user?.role === "verifier") ? (
                  <Link href="/admin" className="brand-button-primary px-6 py-4 text-base">
                    Open Review Command Desk
                  </Link>
                ) : isAuthenticated ? (
                  <Link href="/upload" className="brand-button-primary px-6 py-4 text-base">
                    Start Credential Submission
                  </Link>
                ) : (
                  <button
                    onClick={() => void connectAndSignIn()}
                    disabled={isAuthenticating}
                    className="brand-button-primary px-6 py-4 text-base disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {getWalletSignInLabel(
                      authFlowState,
                      Boolean(connectedWalletAddress)
                    )}
                  </button>
                )}
                <Link
                  href={isAuthenticated ? "/dashboard" : "/verify"}
                  className="brand-button-secondary px-6 py-4 text-base"
                >
                  {isAuthenticated ? "Open Passport Dashboard" : "Open Verification Portal"}
                </Link>
                <Link href="/colleges" className="brand-chip-light w-fit px-4 py-4">
                  College Index
                </Link>
              </div>

              <div className="mt-10 grid gap-4 sm:grid-cols-3">
                <div className="animate-fade-in-up">
                  <StatCounter
                    label="Live Colleges"
                    value={analyticsOverview?.activeInstitutes ?? null}
                  />
                </div>
                <div className="animate-fade-in-up animate-delay-100">
                  <StatCounter
                    label="EDU Minted"
                    value={analyticsOverview?.totalEduMinted ?? null}
                  />
                </div>
                <div className="animate-fade-in-up animate-delay-200 rounded-xl border border-white/[0.08] bg-[#2a2a2a] px-5 py-5 shadow-[0_12px_30px_rgba(8,12,20,0.08)]">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-[#666666]">
                    Top Institute
                  </div>
                  <div className="mt-3 text-[1.85rem] leading-none text-[#f0f0f0]">
                    {analyticsOverview?.leadInstituteName ?? "Leaderboard Live"}
                  </div>
                </div>
              </div>

              <div className="mt-10 grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
                <div className="rounded-xl border border-white/[0.08] bg-[#2a2a2a] p-6">
                  <div className="brand-chip-light">Why It Lands Well</div>
                  <div className="mt-5 space-y-4 text-[#a0a0a0]">
                    <p className="text-base leading-7">
                      This product is designed to make trust legible. Instead of
                      hiding the blockchain and backend behind “magic”, DACS exposes
                      the proof rail clearly enough for reviewers, recruiters, and
                      institutes to understand what they are looking at.
                    </p>
                    <div className="brand-divider" />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.26em] text-[#666666]">
                          Thesis
                        </div>
                        <div className="mt-2 font-medium text-[#f0f0f0]">
                          Trust should travel with the credential.
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.26em] text-[#666666]">
                          Medium
                        </div>
                        <div className="mt-2 font-medium text-[#f0f0f0]">
                          Private evidence vault, MongoDB workflow, and on-chain proof.
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.26em] text-[#666666]">
                          Outcome
                        </div>
                        <div className="mt-2 font-medium text-[#f0f0f0]">
                          A public credential sheet with proof, hashes, and status.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="brand-panel p-6">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-[#a0a0a0]">
                    Proof Rail
                  </div>
                  <div className="mt-3 text-[1.9rem] leading-tight text-[#f0f0f0]">
                    One flow, four trust checkpoints.
                  </div>
                  <div className="mt-6 space-y-3">
                    {demoChecklist.slice(0, 4).map((step, index) => (
                      <div
                        key={step}
                        className="flex items-start gap-4 rounded-xl border border-white/[0.06] bg-[rgba(255,255,255,0.03)] p-4"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[#1d2b4a] text-sm font-semibold text-[#a5c0f8]">
                          {index + 1}
                        </div>
                        <p className="text-[#a0a0a0]">{step}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="brand-panel p-7">
              <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                <div>
                  <div className="text-[11px] uppercase tracking-[0.3em] text-[#4f7ef5]">
                    Platform Health
                  </div>
                  <h2 className="mt-2 text-[2rem] font-semibold text-[#f0f0f0]">
                    Live delivery stack
                  </h2>
                </div>
                <div
                  className={`inline-flex w-fit rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.2em] ${getStatusStyles(platformHealth?.status ?? "degraded")}`}
                >
                  {platformHealth?.status === "ok" ? "System Ready" : "Checking Services"}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {[
                  { label: "API", status: platformHealth?.services.api.status ?? "degraded" },
                  {
                    label: "Database",
                    status: platformHealth?.services.database.status ?? "degraded",
                  },
                  {
                    label: "Blockchain",
                    status: platformHealth?.services.blockchain.status ?? "degraded",
                  },
                  {
                    label: "Proof Storage",
                    status: platformHealth?.services.ipfs.status ?? "missing",
                  },
                  { label: "Auth", status: platformHealth?.services.auth.status ?? "warning" },
                ].map((service) => (
                  <div
                    key={service.label}
                    className="rounded-xl border border-white/[0.06] bg-[rgba(255,255,255,0.03)] p-4"
                  >
                    <div className="text-[11px] uppercase tracking-[0.26em] text-[#a0a0a0]">
                      {service.label}
                    </div>
                    <div
                      className={`mt-3 inline-flex rounded-full border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.2em] ${getStatusStyles(service.status)}`}
                    >
                      {service.status}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="brand-panel p-7">
              <div className="mb-5 flex flex-col gap-2">
                <div className="text-[11px] uppercase tracking-[0.3em] text-[#a0a0a0]">
                  Session Readiness
                </div>
                <h2 className="text-[2rem] font-semibold text-[#f0f0f0]">
                  Operate the right flow
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {sessionTiles.map((tile) => (
                  <div
                    key={tile.label}
                    className="rounded-xl border border-white/[0.06] bg-[rgba(255,255,255,0.03)] p-4"
                  >
                    <div className="text-[11px] uppercase tracking-[0.26em] text-[#a0a0a0]">
                      {tile.label}
                    </div>
                    <div className={`mt-3 inline-flex rounded-full border px-3 py-1.5 text-sm font-medium ${tile.tone}`}>
                      {tile.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-xl border border-white/[0.06] bg-[rgba(255,255,255,0.03)] p-5">
                <div className="text-[11px] uppercase tracking-[0.26em] text-[#a0a0a0]">
                  Recommended Next Action
                </div>
                <h3 className="mt-3 text-[1.8rem] leading-tight text-[#f0f0f0]">
                  {recommendedAction.label}
                </h3>
                <p className="mt-3 max-w-2xl text-[#a0a0a0]">
                  {recommendedAction.description}
                </p>
                <div className="mt-5">
                  {recommendedAction.kind === "button" ? (
                    <button
                      onClick={() => void connectAndSignIn()}
                      disabled={isAuthenticating}
                      className="brand-button-primary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isAuthenticating
                        ? getWalletSignInLabel(
                            authFlowState,
                            Boolean(connectedWalletAddress)
                          )
                        : recommendedAction.label}
                    </button>
                  ) : (
                    <Link
                      href={recommendedAction.href}
                      className="brand-button-primary px-5 py-3 text-sm"
                    >
                      {recommendedAction.label}
                    </Link>
                  )}
                </div>
                {walletWarning ? (
                  <StatusBanner
                    className="mt-4"
                    compact
                    tone="warning"
                    title="Wallet Attention"
                    message={walletWarning}
                  />
                ) : walletNote ? (
                  <StatusBanner
                    className="mt-4"
                    compact
                    tone="neutral"
                    title="Session Note"
                    message={walletNote}
                  />
                ) : null}
              </div>
            </div>
          </div>
        </div>

        <div className="brand-panel p-8">
          <div className="text-[11px] uppercase tracking-[0.3em] text-[#a0a0a0]">
            Demo Runbook
          </div>
          <h2 className="mt-2 text-[2.4rem] font-semibold text-[#f0f0f0]">
            Four beats for a confident final presentation
          </h2>
          <p className="mt-3 max-w-2xl text-[#a0a0a0]">
            Use this sequence when you want DACS to feel like a finished trust
            product rather than a disconnected set of screens.
          </p>

          <div className="mt-8 grid gap-4 md:grid-cols-2">
            {demoChecklist.map((step, index) => (
              <div
                key={step}
                className="grid gap-4 rounded-xl border border-white/[0.06] bg-[rgba(255,255,255,0.03)] p-4 sm:grid-cols-[48px_1fr]"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[#1d2b4a] text-sm font-semibold text-[#a5c0f8]">
                  {index + 1}
                </div>
                <p className="self-center text-[#a0a0a0]">{step}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
          <div className="space-y-5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-[#4f7ef5]">
                Live Credential Activity
              </div>
              <h2 className="mt-3 text-[2.6rem] font-semibold text-[#f0f0f0]">
                Real issuance makes the trust layer feel alive.
              </h2>
              <p className="mt-3 max-w-3xl text-[#a0a0a0]">
                The fastest way to make a reviewer trust a product like DACS is to
                show that it is not static. Credentials are being issued, rewards are
                being minted, and public proof sheets resolve immediately.
              </p>
            </div>

            {recentActivity.length > 0 ? (
              <div className="space-y-4">
                {recentActivity.slice(0, 4).map((activity) => (
                  <div
                    key={activity.id}
                    className="brand-panel grid gap-4 p-6 sm:grid-cols-[1fr_auto]"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] uppercase tracking-[0.26em] text-[#4f7ef5]">
                        {activity.tokenId ? `Token #${activity.tokenId}` : "Minted Record"}
                      </div>
                      <h3 className="mt-2 text-[1.9rem] font-semibold text-[#f0f0f0] [overflow-wrap:anywhere]">
                        {activity.courseName}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <div className="text-sm text-[#a0a0a0]">{activity.instituteName}</div>
                        <div className="rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-200">
                          {formatCredentialTypeLabel(activity.credentialType)}
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 text-sm text-[#a0a0a0] sm:grid-cols-2">
                        <div className="rounded-xl border border-white/[0.06] bg-[rgba(255,255,255,0.03)] p-3">
                          <div className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">
                            Student
                          </div>
                          <div className="mt-2 font-mono text-[#a5c0f8]">
                            {truncateValue(activity.studentAddress, 10, 8)}
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/[0.06] bg-[rgba(255,255,255,0.03)] p-3">
                          <div className="text-[11px] uppercase tracking-[0.24em] text-[#a0a0a0]">
                            Minted At
                          </div>
                          <div className="mt-2 text-[#f0f0f0]">
                            {formatDateTime(activity.mintedAt)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col justify-between gap-4">
                      <div className="brand-chip w-fit self-start border-emerald-500/18 bg-emerald-500/08 text-[#d7ebd8]">
                        {activity.eduAmount !== null
                          ? `${activity.eduAmount.toLocaleString()} EDU`
                          : "Reward pending"}
                      </div>
                      {activity.tokenId ? (
                        <Link
                          href={`/verify?tokenId=${activity.tokenId}`}
                          className="brand-button-secondary px-4 py-3 text-sm"
                        >
                          Open Verification Sheet
                        </Link>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="brand-panel p-8 text-center">
                <h3 className="text-[2rem] font-semibold text-[#f0f0f0]">
                  Activity feed is primed for the next mint
                </h3>
                <p className="mt-3 text-[#a0a0a0]">
                  Once a credential is approved and minted, it will appear here
                  with its token-backed verification link.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-[#a0a0a0]">
                Product Edges
              </div>
              <h2 className="mt-3 text-[2.6rem] font-semibold text-[#f0f0f0]">
                Designed to look credible before anyone reads the docs.
              </h2>
            </div>
            <div className="grid gap-5">
              <FeatureCard
                title="Verification Sheet, Not Just A Hash"
                description="Every minted credential resolves to a human-readable proof surface with token, verifier, timing, evidence, and audit details."
                icon={
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                    />
                  </svg>
                }
              />
              <FeatureCard
                title="Operator-Grade Review Workflow"
                description="Admins and verifiers review evidence, assign EDU, reject with notes, and submit wallet-signed mint or revoke actions from a queue that feels like a real operations desk."
                icon={
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 7h16M4 12h16M4 17h10"
                    />
                  </svg>
                }
              />
              <FeatureCard
                title="Public Trust Layer For Institutes"
                description="Institute rankings, profile pages, and public proof cards help DACS feel like a network, not a single upload form."
                icon={
                  <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M3 21h18M5 21V8l7-5 7 5v13M9 12h6M9 16h6"
                    />
                  </svg>
                }
              />
            </div>
          </div>
        </div>

        <div className="brand-panel px-8 py-7">
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            {[
              {
                label: "Storage",
                value: "Private vault + IPFS proof",
                detail: "Evidence stays private while proof metadata stays public",
              },
              { label: "Workflow", value: "MongoDB", detail: "Submission lifecycle is persisted off-chain" },
              { label: "Credential", value: "PoCT NFT", detail: "Soulbound academic proof record" },
              { label: "Rewards", value: "EDU Token", detail: "Student incentive rail for verified outcomes" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-white/[0.06] bg-[rgba(255,255,255,0.03)] p-5"
              >
                <div className="text-[11px] uppercase tracking-[0.26em] text-[#a0a0a0]">
                  {item.label}
                </div>
                <div className="mt-3 text-[2rem] text-[#f0f0f0]">
                  {item.value}
                </div>
                <div className="mt-2 text-sm text-[#a0a0a0]">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
