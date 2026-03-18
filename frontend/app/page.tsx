"use client"

import Link from "next/link"
import { useEffect, useMemo, useState } from "react"
import { PageLayout } from "@/components/PageLayout"
import { FeatureCard } from "@/components/FeatureCard"
import { StatusBanner } from "@/components/StatusBanner"
import { useAuth } from "@/components/AuthProvider"
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

function getStatusStyles(status: string) {
  switch (status) {
    case "ok":
    case "configured":
    case "connected":
      return "border-[#0f766e]/30 bg-[#0f766e]/12 text-[#c9f0e7]"
    case "warning":
      return "border-[#b8892d]/30 bg-[#b8892d]/12 text-[#f3d9a2]"
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

  const heroStats = useMemo(
    () => [
      {
        label: "Live Colleges",
        value:
          analyticsOverview !== null
            ? analyticsOverview.activeInstitutes.toLocaleString()
            : "Ready",
      },
      {
        label: "EDU Minted",
        value:
          analyticsOverview !== null
            ? `${analyticsOverview.totalEduMinted.toLocaleString()}+`
            : "Growing",
      },
      {
        label: "Top Institute",
        value: analyticsOverview?.leadInstituteName ?? "Leaderboard Live",
      },
    ],
    [analyticsOverview]
  )
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
          "Connect MetaMask first so DACS can restore your wallet identity and unlock signed student or admin flows.",
      }
    }

    if (!isSupportedNetwork) {
      return {
        kind: "button" as const,
        label: "Switch To Hardhat And Sign In",
        description:
          "Your wallet is connected, but the network must be Hardhat localhost before upload, minting, and private dashboards can continue.",
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

    if (user?.role === "admin") {
      return {
        kind: "link" as const,
        href: "/admin",
        label: "Open Admin Review Console",
        description:
          "Review pending submissions, approve or reject certificates, and mint PoCT plus EDU rewards.",
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
  const guidedJourneys = useMemo(
    () => [
      {
        title: "Student Journey",
        eyebrow: "Submission Flow",
        accent: "text-[#9ad8cf]",
        steps: [
          "Connect wallet and sign in with MetaMask.",
          "Drag and drop a certificate into the upload workspace.",
          "Track review, mint, and EDU reward outcomes on the dashboard.",
        ],
        href: isAuthenticated && user?.role === "student" ? "/upload" : "/dashboard",
        cta: isAuthenticated && user?.role === "student" ? "Continue Student Flow" : "View Dashboard",
      },
      {
        title: "Admin Journey",
        eyebrow: "Verification Flow",
        accent: "text-[#f3d9a2]",
        steps: [
          "Open the review console and inspect the pending queue.",
          "Preview the evidence file, assign reward amount, and leave a reviewer note.",
          "Approve to mint the credential or reject with a tracked audit event.",
        ],
        href: "/admin",
        cta: "Open Admin Console",
      },
      {
        title: "Public Trust Journey",
        eyebrow: "Verification Flow",
        accent: "text-[#d8c39e]",
        steps: [
          "Verify a credential by token ID on the public page.",
          "Inspect lifecycle evidence, proof contracts, and QR-linked shareable output.",
          "Explore the colleges leaderboard to compare EDU output by institute.",
        ],
        href: "/verify",
        cta: "Verify A Credential",
      },
    ],
    [isAuthenticated, user?.role]
  )
  const sessionTiles = useMemo(
    () => [
      {
        label: "Wallet Provider",
        value: hasWalletProvider ? "MetaMask detected" : "MetaMask not detected",
        tone: hasWalletProvider
          ? "border-[#0f766e]/30 bg-[#0f766e]/12 text-[#c9f0e7]"
          : "border-[#b8892d]/30 bg-[#b8892d]/12 text-[#f3d9a2]",
      },
      {
        label: "Connected Wallet",
        value: connectedWalletAddress
          ? `${connectedWalletAddress.slice(0, 8)}...${connectedWalletAddress.slice(-6)}`
          : "Not connected",
        tone: connectedWalletAddress
          ? "border-[#b8892d]/30 bg-[#b8892d]/12 text-[#f3d9a2]"
          : "border-[#3a3020]/70 bg-black/20 text-[#d3cdc1]",
      },
      {
        label: "Network",
        value: networkLabel,
        tone:
          connectedWalletAddress && isSupportedNetwork
            ? "border-[#0f766e]/30 bg-[#0f766e]/12 text-[#c9f0e7]"
            : connectedWalletAddress
              ? "border-[#b8892d]/30 bg-[#b8892d]/12 text-[#f3d9a2]"
              : "border-[#3a3020]/70 bg-black/20 text-[#d3cdc1]",
      },
      {
        label: "Session",
        value: isAuthenticated
          ? user?.role === "admin"
            ? "Admin authenticated"
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
            ? "border-[#b8892d]/30 bg-[#b8892d]/12 text-[#f3d9a2]"
            : connectedWalletAddress
              ? "border-[#8bbbd5]/30 bg-[#8bbbd5]/12 text-[#d8ebf5]"
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
      "Student signs in and submits academic credential evidence into IPFS-backed storage.",
      "Admin reviews the evidence, adds a note, and mints PoCT plus EDU.",
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
              <div className="mt-6 text-[11px] uppercase tracking-[0.34em] text-[#4f5966]">
                DACS / Proof-first academic trust network
              </div>
              <h1 className="display-serif mt-4 max-w-4xl text-5xl font-semibold leading-[0.94] text-[#101828] sm:text-6xl xl:text-[5.25rem]">
                Academic credentials that feel official, verify instantly, and carry evidence end to end.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-[#243246]">
                DACS turns student achievement into a premium proof artifact: upload
                into IPFS-backed storage, review through an admin console, mint a
                soulbound credential, reward EDU, and publish a public verification
                sheet that looks trustworthy on first glance.
              </p>

              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                {isAuthenticated && user?.role === "admin" ? (
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
                {heroStats.map((stat) => (
                  <div
                    key={stat.label}
                    className="rounded-[26px_14px_26px_14px] border border-[#101828]/12 bg-[rgba(255,255,255,0.8)] px-5 py-5 shadow-[0_12px_30px_rgba(8,12,20,0.08)]"
                  >
                    <div className="text-[11px] uppercase tracking-[0.28em] text-[#4d596d]">
                      {stat.label}
                    </div>
                    <div className="display-serif mt-3 text-[1.85rem] leading-none text-[#101828]">
                      {stat.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-10 grid gap-5 lg:grid-cols-[1.05fr_0.95fr] lg:items-start">
                <div className="rounded-[28px_14px_28px_14px] border border-[#101828]/12 bg-[rgba(255,255,255,0.82)] p-6">
                  <div className="brand-chip-light">Why It Lands Well</div>
                  <div className="mt-5 space-y-4 text-[#344255]">
                    <p className="text-base leading-7">
                      This product is designed to make trust legible. Instead of
                      hiding the blockchain and backend behind “magic”, DACS exposes
                      the proof rail clearly enough for reviewers, recruiters, and
                      institutes to understand what they are looking at.
                    </p>
                    <div className="brand-divider" />
                    <div className="grid gap-3 sm:grid-cols-3">
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.26em] text-[#6f563f]">
                          Thesis
                        </div>
                        <div className="mt-2 font-medium text-[#101828]">
                          Trust should travel with the credential.
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.26em] text-[#6f563f]">
                          Medium
                        </div>
                        <div className="mt-2 font-medium text-[#101828]">
                          IPFS, MongoDB, and on-chain proof.
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] uppercase tracking-[0.26em] text-[#6f563f]">
                          Outcome
                        </div>
                        <div className="mt-2 font-medium text-[#101828]">
                          A public credential sheet with evidence.
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="brand-panel p-6">
                  <div className="text-[11px] uppercase tracking-[0.28em] text-[#f5c88a]">
                    Proof Rail
                  </div>
                  <div className="mt-3 display-serif text-[1.9rem] leading-tight text-[#f7efe3]">
                    One flow, four trust checkpoints.
                  </div>
                  <div className="mt-6 space-y-3">
                    {demoChecklist.slice(0, 4).map((step, index) => (
                      <div
                        key={step}
                        className="flex items-start gap-4 rounded-[22px_12px_22px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-4"
                      >
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-[16px] bg-[#f2e7d7] text-sm font-semibold text-[#101828]">
                          {index + 1}
                        </div>
                        <p className="text-[#d4dbea]">{step}</p>
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
                  <div className="text-[11px] uppercase tracking-[0.3em] text-[#8bbbd5]">
                    Platform Health
                  </div>
                  <h2 className="display-serif mt-2 text-[2rem] font-semibold text-[#f7efe3]">
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
                  { label: "IPFS", status: platformHealth?.services.ipfs.status ?? "missing" },
                  { label: "Auth", status: platformHealth?.services.auth.status ?? "warning" },
                ].map((service) => (
                  <div
                    key={service.label}
                    className="rounded-[22px_12px_22px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-4"
                  >
                    <div className="text-[11px] uppercase tracking-[0.26em] text-[#8ea0b8]">
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
                <div className="text-[11px] uppercase tracking-[0.3em] text-[#f5c88a]">
                  Session Readiness
                </div>
                <h2 className="display-serif text-[2rem] font-semibold text-[#f7efe3]">
                  Operate the right flow
                </h2>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {sessionTiles.map((tile) => (
                  <div
                    key={tile.label}
                    className="rounded-[22px_12px_22px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-4"
                  >
                    <div className="text-[11px] uppercase tracking-[0.26em] text-[#8ea0b8]">
                      {tile.label}
                    </div>
                    <div className={`mt-3 inline-flex rounded-full border px-3 py-1.5 text-sm font-medium ${tile.tone}`}>
                      {tile.value}
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 rounded-[24px_12px_24px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-5">
                <div className="text-[11px] uppercase tracking-[0.26em] text-[#8ea0b8]">
                  Recommended Next Action
                </div>
                <h3 className="display-serif mt-3 text-[1.8rem] leading-tight text-[#f7efe3]">
                  {recommendedAction.label}
                </h3>
                <p className="mt-3 max-w-2xl text-[#c8d0de]">
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

        <div className="grid gap-8 xl:grid-cols-[0.92fr_1.08fr] xl:items-start">
          <div className="brand-panel p-8">
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#f5c88a]">
              Demo Runbook
            </div>
            <h2 className="display-serif mt-2 text-[2.4rem] font-semibold text-[#f7efe3]">
              Four beats for a confident final presentation
            </h2>
            <p className="mt-3 max-w-2xl text-[#c8d0de]">
              Use this sequence when you want DACS to feel like a finished trust
              product rather than a disconnected set of screens.
            </p>

            <div className="mt-8 space-y-4">
              {demoChecklist.map((step, index) => (
                <div
                  key={step}
                  className="grid gap-4 rounded-[24px_12px_24px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-4 sm:grid-cols-[48px_1fr]"
                >
                  <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[rgba(242,231,215,0.92)] text-sm font-semibold text-[#101828]">
                    {index + 1}
                  </div>
                  <p className="self-center text-[#d8e0ec]">{step}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="brand-panel-light p-8">
            <div className="text-[11px] uppercase tracking-[0.3em] text-[#6f563f]">
              Guided Product Paths
            </div>
            <h2 className="display-serif mt-2 text-[2.4rem] font-semibold text-[#101828]">
              Each user type gets a distinct journey.
            </h2>
            <p className="mt-3 max-w-2xl text-[#243246]">
              DACS is strongest when the path feels intentional for whoever opens the
              product first: student, admin, or public verifier.
            </p>

            <div className="mt-8 space-y-4">
              {guidedJourneys.map((journey) => (
                <div
                  key={journey.title}
                  className="rounded-[24px_12px_24px_12px] border border-[#101828]/12 bg-[rgba(255,255,255,0.82)] p-5 shadow-[0_12px_30px_rgba(8,12,20,0.06)]"
                >
                  <div className={`text-[11px] uppercase tracking-[0.3em] ${journey.accent}`}>
                    {journey.eyebrow}
                  </div>
                  <h3 className="display-serif mt-2 text-[1.9rem] font-semibold text-[#101828]">
                    {journey.title}
                  </h3>
                  <div className="mt-4 grid gap-3">
                    {journey.steps.map((step, index) => (
                      <div
                        key={step}
                        className="grid gap-3 rounded-[18px_10px_18px_10px] border border-[#101828]/8 bg-white/55 p-3 text-sm text-[#405064] sm:grid-cols-[30px_1fr]"
                      >
                        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-[#101828] text-xs font-semibold text-[#f7efe3]">
                          {index + 1}
                        </div>
                        <p>{step}</p>
                      </div>
                    ))}
                  </div>
                  <Link
                    href={journey.href}
                    className="mt-5 inline-flex rounded-full border border-[#101828]/12 bg-[#101828] px-4 py-2.5 text-sm font-semibold text-[#f7efe3] transition hover:bg-[#172136]"
                  >
                    {journey.cta}
                  </Link>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="grid gap-8 xl:grid-cols-[1.05fr_0.95fr] xl:items-start">
          <div className="space-y-5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-[#8bbbd5]">
                Live Credential Activity
              </div>
              <h2 className="display-serif mt-3 text-[2.6rem] font-semibold text-[#f7efe3]">
                Real issuance makes the trust layer feel alive.
              </h2>
              <p className="mt-3 max-w-3xl text-[#c8d0de]">
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
                      <div className="text-[11px] uppercase tracking-[0.26em] text-[#8bbbd5]">
                        {activity.tokenId ? `Token #${activity.tokenId}` : "Minted Record"}
                      </div>
                      <h3 className="display-serif mt-2 text-[1.9rem] font-semibold text-[#f7efe3] [overflow-wrap:anywhere]">
                        {activity.courseName}
                      </h3>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <div className="text-sm text-[#b9c3d4]">{activity.instituteName}</div>
                        <div className="rounded-full border border-[#b8892d]/20 bg-[#b8892d]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#f3d9a2]">
                          {formatCredentialTypeLabel(activity.credentialType)}
                        </div>
                      </div>

                      <div className="mt-5 grid gap-3 text-sm text-[#d8e0ec] sm:grid-cols-2">
                        <div className="rounded-[18px_10px_18px_10px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-3">
                          <div className="text-[11px] uppercase tracking-[0.24em] text-[#8ea0b8]">
                            Student
                          </div>
                          <div className="mt-2 font-mono text-[#d5e7f1]">
                            {truncateValue(activity.studentAddress, 10, 8)}
                          </div>
                        </div>
                        <div className="rounded-[18px_10px_18px_10px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-3">
                          <div className="text-[11px] uppercase tracking-[0.24em] text-[#8ea0b8]">
                            Minted At
                          </div>
                          <div className="mt-2 text-[#f7efe3]">
                            {formatDateTime(activity.mintedAt)}
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-col justify-between gap-4">
                      <div className="brand-chip w-fit self-start border-[#77997f]/22 bg-[#77997f]/10 text-[#d7ebd8]">
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
                <h3 className="display-serif text-[2rem] font-semibold text-[#f7efe3]">
                  Activity feed is primed for the next mint
                </h3>
                <p className="mt-3 text-[#c8d0de]">
                  Once a credential is approved and minted, it will appear here
                  with its token-backed verification link.
                </p>
              </div>
            )}
          </div>

          <div className="space-y-5">
            <div>
              <div className="text-[11px] uppercase tracking-[0.3em] text-[#f5c88a]">
                Product Edges
              </div>
              <h2 className="display-serif mt-3 text-[2.6rem] font-semibold text-[#f7efe3]">
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
                description="Admins review evidence, assign EDU, reject with notes, and mint directly from a queue that feels like a real operations desk."
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
              { label: "Storage", value: "IPFS", detail: "Evidence lives on distributed storage" },
              { label: "Workflow", value: "MongoDB", detail: "Submission lifecycle is persisted off-chain" },
              { label: "Credential", value: "PoCT NFT", detail: "Soulbound academic proof record" },
              { label: "Rewards", value: "EDU Token", detail: "Student incentive rail for verified outcomes" },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-[22px_12px_22px_12px] border border-[#eedfce]/10 bg-[rgba(255,255,255,0.03)] p-5"
              >
                <div className="text-[11px] uppercase tracking-[0.26em] text-[#8ea0b8]">
                  {item.label}
                </div>
                <div className="display-serif mt-3 text-[2rem] text-[#f7efe3]">
                  {item.value}
                </div>
                <div className="mt-2 text-sm text-[#c8d0de]">{item.detail}</div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </PageLayout>
  )
}
