"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { toast } from "sonner"
import { CredentialTimeline } from "@/components/CredentialTimeline"
import { DashboardCard } from "@/components/DashboardCard"
import { EmptyStatePanel } from "@/components/EmptyStatePanel"
import { MetricCard } from "@/components/MetricCard"
import { PageLayout } from "@/components/PageLayout"
import { RoleBadge } from "@/components/RoleBadge"
import { SkeletonBlock } from "@/components/SkeletonBlock"
import { StatusBanner } from "@/components/StatusBanner"
import { SubmissionStatusCenter } from "@/components/SubmissionStatusCenter"
import { WalletBadge } from "@/components/WalletBadge"
import { DisclosureBuilderModal } from "@/components/DisclosureBuilderModal"
import { useAuth } from "@/components/AuthProvider"
import { fetchMySubmissions, fetchMyDisclosures, isAbortError } from "@/lib/api"
import { getEduBalance } from "@/lib/contracts/edu"
import { getOwnedCertificates } from "@/lib/contracts/poct"
import { openPrivateEvidence } from "@/lib/evidence"
import { getWalletSignInLabel } from "@/lib/wallet"
import {
  formatCredentialTypeLabel,
  formatDateTime,
  truncateValue,
} from "@/lib/formatting"
import type { OnChainOwnedCertificate, SavedDisclosureRecord, Submission } from "@/lib/types"

function getPassportHeadline(input: {
  mintedCount: number
  pendingCount: number
  rejectedCount: number
}) {
  if (input.pendingCount > 0) {
    return {
      title: "Your credential passport is actively moving through review.",
      description:
        "One or more submissions are still in the verification queue, so DACS is waiting on reviewer action before those achievements become public proof artifacts.",
      ctaHref: "/upload",
      ctaLabel: "Submit Another Credential",
    }
  }

  if (input.mintedCount > 0) {
    return {
      title: "Your academic proof portfolio is live on-chain.",
      description:
        "Minted credentials are now public trust artifacts with verification sheets, export formats, and wallet-bound ownership anchored to your student identity.",
      ctaHref: "/verify",
      ctaLabel: "Open Verification Portal",
    }
  }

  if (input.rejectedCount > 0) {
    return {
      title: "A reviewer asked for another pass before minting.",
      description:
        "You already have tracked submission history. Tighten the evidence or reviewer note feedback, then resubmit with a cleaner credential record.",
      ctaHref: "/upload",
      ctaLabel: "Prepare A Better Submission",
    }
  }

    return {
      title: "This passport is ready for its first verified credential.",
      description:
        "Connect your latest academic evidence to the DACS review rail, then let the reviewer flow turn it into a minted public credential with EDU attached.",
      ctaHref: "/upload",
      ctaLabel: "Start Credential Submission",
  }
}

export default function DashboardPage() {
  const {
    authFlowState,
    connectAndSignIn,
    connectedWalletAddress,
    isAuthenticated,
    isAuthenticating,
    isReady,
    token,
    user,
    walletNote,
  } = useAuth()

  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [ownedCertificates, setOwnedCertificates] = useState<OnChainOwnedCertificate[]>(
    []
  )
  const [eduBalance, setEduBalance] = useState("0")
  const [isLoading, setIsLoading] = useState(false)
  const [chainDataLoaded, setChainDataLoaded] = useState(false)
  const [dataWarning, setDataWarning] = useState<string | null>(null)
  const [chainError, setChainError] = useState<string | null>(null)
  const [isPolling, setIsPolling] = useState(false)
  const [retryNonce, setRetryNonce] = useState(0)
  const [disclosureTokenId, setDisclosureTokenId] = useState<string | null>(null)
  const [savedDisclosures, setSavedDisclosures] = useState<SavedDisclosureRecord[]>([])

  useEffect(() => {
    if (!token || !user) {
      setSubmissions([])
      setOwnedCertificates([])
      setEduBalance("0")
      setSavedDisclosures([])
      return
    }

    const controller = new AbortController()
    const authToken = token
    const userAddress = user.address

    async function loadDashboardData() {
      try {
        setIsLoading(true)
        setChainError(null)
        setDataWarning(null)

        const submissionsResponse = await fetchMySubmissions(
          authToken,
          controller.signal
        )

        if (controller.signal.aborted) {
          return
        }

        setSubmissions(submissionsResponse.submissions)

        // Load saved disclosure packages (best-effort — non-blocking)
        try {
          const disclosuresResponse = await fetchMyDisclosures(authToken, controller.signal)
          if (!controller.signal.aborted) {
            setSavedDisclosures(disclosuresResponse.disclosures)
          }
        } catch {
          // Disclosures are optional — don't block the rest of the dashboard
        }

        const [balanceResult, certificatesResult] = await Promise.allSettled([
          getEduBalance(userAddress),
          getOwnedCertificates(userAddress),
        ])

        if (balanceResult.status === "fulfilled") {
          setEduBalance(balanceResult.value.formatted)
        } else {
          setChainError(
            "Could not read the EDU balance from the configured RPC endpoint."
          )
        }

        if (certificatesResult.status === "fulfilled") {
          setOwnedCertificates(certificatesResult.value)
          setChainDataLoaded(true)
        } else {
          setChainDataLoaded(false)
          setChainError(
            "Could not read the student certificate list from the PoCT contract."
          )
        }
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          return
        }

        const message =
          error instanceof Error ? error.message : "Could not load dashboard data"
        setDataWarning(message)
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadDashboardData()

    return () => controller.abort()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user, retryNonce])

  // Auto-poll every 30s when there are pending submissions
  const hasPendingRef = useRef(false)
  hasPendingRef.current = submissions.some((s) => s.status === "pending_review")

  useEffect(() => {
    if (!token || !user || !isAuthenticated) {
      setIsPolling(false)
      return
    }

    if (!hasPendingRef.current) {
      setIsPolling(false)
      return
    }

    setIsPolling(true)

    const intervalId = setInterval(async () => {
      if (!hasPendingRef.current) {
        clearInterval(intervalId)
        setIsPolling(false)
        return
      }
      try {
        const controller = new AbortController()
        const response = await fetchMySubmissions(token, controller.signal)
        setSubmissions(response.submissions)
      } catch {
        // Silently ignore poll failures
      }
    }, 30_000)

    return () => {
      clearInterval(intervalId)
      setIsPolling(false)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, user, isAuthenticated])

  const mintedSubmissions = submissions.filter(
    (submission) => submission.status === "minted"
  )
  const pendingSubmissions = submissions.filter(
    (submission) => submission.status === "pending_review"
  )
  const rejectedSubmissions = submissions.filter(
    (submission) => submission.status === "rejected"
  )
  const submissionByTokenId = new Map(
    mintedSubmissions
      .filter((submission): submission is Submission & { tokenId: string } => !!submission.tokenId)
      .map((submission) => [submission.tokenId, submission])
  )
  // Stale = minted in Mongo but absent from on-chain read (only meaningful when chain read succeeded)
  const staleTokenIds = (() => {
    if (!chainDataLoaded || isLoading) return new Set<string>()
    const onChain = new Set(ownedCertificates.map((c) => c.tokenId))
    return new Set(
      mintedSubmissions
        .filter((s): s is Submission & { tokenId: string } => !!s.tokenId && !onChain.has(s.tokenId))
        .map((s) => s.tokenId)
    )
  })()
  const formattedEduBalance = Number(eduBalance || 0).toLocaleString("en-IN", {
    maximumFractionDigits: 2,
  })
  const totalEduRewarded = mintedSubmissions.reduce(
    (total, submission) => total + (submission.eduAmount ?? 0),
    0
  )
  const passportHeadline = getPassportHeadline({
    mintedCount: mintedSubmissions.length,
    pendingCount: pendingSubmissions.length,
    rejectedCount: rejectedSubmissions.length,
  })
  const insightTiles = [
    {
      label: "Public proof sheets",
      value: `${mintedSubmissions.length} live`,
      detail:
        mintedSubmissions.length > 0
          ? "Each minted credential now has a public verification destination."
          : "Minting the first credential unlocks the public trust surface.",
    },
    {
      label: "Total EDU rewarded",
      value: `${totalEduRewarded.toLocaleString()} EDU`,
      detail: "This reflects what has already been attached to approved outcomes.",
    },
    {
      label: "Review posture",
      value:
        pendingSubmissions.length > 0
          ? `${pendingSubmissions.length} in review`
          : rejectedSubmissions.length > 0
            ? `${rejectedSubmissions.length} need attention`
            : "Clear queue",
      detail:
        pendingSubmissions.length > 0
          ? "Review is underway and the next mint can happen without another upload."
          : rejectedSubmissions.length > 0
            ? "Use the reviewer notes below to prepare the next submission."
            : "No open review blockers are holding back your passport.",
    },
  ]

  async function handleOpenEvidence(submission: Submission) {
    if (!token) {
      return
    }

    try {
      await openPrivateEvidence(token, submission.id, submission.fileName)
    } catch (error) {
      setDataWarning(
        error instanceof Error
          ? error.message
          : "Could not open the private evidence file"
      )
    }
  }

  return (
    <PageLayout>
      <section className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="brand-chip mb-4">
            Student Dashboard
          </div>
          <h1 className="mb-3 text-4xl font-semibold text-white sm:text-5xl">
            Track your on-chain credentials and EDU rewards in one place.
          </h1>
          <p className="text-[#a0a0a0]">
            This dashboard combines your authenticated submission history with live
            contract reads from the PoCT NFT and EDU token contracts.
          </p>
        </div>

        {user ? (
          <div className="flex flex-wrap items-center gap-3">
            <RoleBadge role={user.role} />
            <WalletBadge address={user.address} label="Student" />
            {isPolling ? (
              <div className="flex items-center gap-1.5 rounded-full border border-[#0f766e]/30 bg-[#0f766e]/10 px-3 py-1.5 text-[11px] font-medium text-[#c9f0e7]">
                <span className="brand-status-dot" />
                Live updates
              </div>
            ) : null}
          </div>
        ) : null}
      </section>

      {!isReady ? (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <SkeletonBlock variant="metric" />
            <SkeletonBlock variant="metric" />
            <SkeletonBlock variant="metric" />
            <SkeletonBlock variant="metric" />
          </div>
          <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
            <SkeletonBlock variant="card" lines={4} />
            <SkeletonBlock variant="card" lines={4} />
          </div>
        </div>
      ) : null}

      {isReady && !isAuthenticated ? (
        <DashboardCard>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="mb-2 text-[2rem] font-semibold text-white">
                Sign in to load your student dashboard
              </h2>
              <p className="max-w-2xl text-[#a0a0a0]">
                Your wallet-based session unlocks private submission history and
                uses your wallet address for live EDU balance and owned NFT reads.
              </p>
            </div>
            <button
              onClick={() => void connectAndSignIn()}
              disabled={isAuthenticating}
              className="brand-button-primary px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {getWalletSignInLabel(authFlowState, Boolean(connectedWalletAddress))}
            </button>
          </div>
          {walletNote ? (
            <StatusBanner
              className="mt-5"
              compact
              tone="neutral"
              title="Session Note"
              message={walletNote}
            />
          ) : null}
        </DashboardCard>
      ) : null}

      {isReady && isAuthenticated && user ? (
        <>
          {dataWarning ? (
            <StatusBanner
              className="mb-8"
              tone="error"
              title="Dashboard data issue"
              message={dataWarning}
              action={
                <button
                  type="button"
                  onClick={() => setRetryNonce((n) => n + 1)}
                  className="brand-button-secondary px-4 py-2 text-xs"
                >
                  Retry
                </button>
              }
            />
          ) : null}

          <div className="mb-8 rounded-xl border border-[#4f7ef5]/20 bg-[#4f7ef5]/08 px-5 py-4 text-sm text-[#a5c0f8]">
            Minted credentials automatically become public proof artifacts after
            approval. Use the verification sheet to access shareable exports,
            standards files, and proof anchors in one place.
          </div>

          <section className="mb-10 grid gap-8 xl:grid-cols-[1.02fr_0.98fr] xl:items-start">
            <div className="brand-panel-light px-8 py-8 sm:px-10">
              <div className="brand-kicker">Credential Passport</div>
              <div className="mt-6 text-[11px] uppercase tracking-[0.34em] text-[#666666]">
                Student / private proof / progress posture
              </div>
              <h2 className="mt-4 max-w-4xl text-4xl font-semibold leading-[0.96] text-[#f0f0f0] sm:text-5xl">
                {passportHeadline.title}
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[#a0a0a0]">
                {passportHeadline.description}
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link
                  href={passportHeadline.ctaHref}
                  className="brand-button-primary px-5 py-3 text-sm"
                >
                  {passportHeadline.ctaLabel}
                </Link>
                <Link
                  href="/verify"
                  className="brand-button-secondary px-5 py-3 text-sm"
                >
                  Open Trust Portal
                </Link>
              </div>

              <div className="mt-8 grid gap-4 sm:grid-cols-3">
                {insightTiles.map((tile) => (
                  <div
                    key={tile.label}
                    className="rounded-xl border border-white/[0.08] bg-[#2a2a2a] p-5"
                  >
                    <div className="text-[11px] uppercase tracking-[0.26em] text-[#666666]">
                      {tile.label}
                    </div>
                    <div className="mt-3 text-[1.9rem] text-[#f0f0f0]">
                      {tile.value}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#a0a0a0]">{tile.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <DashboardCard title="Passport Summary">
              <div className="space-y-5">
                <div className="rounded-xl border border-[#4f7ef5]/15 bg-[#4f7ef5]/08 p-5">
                  <div className="text-xs uppercase tracking-[0.24em] text-[#a5c0f8]">
                    Current Standing
                  </div>
                  <div className="mt-3 grid gap-4 sm:grid-cols-2">
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        Wallet-bound identity
                      </div>
                      <div className="mt-2 text-white">Confirmed for {user.role} role</div>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        Next milestone
                      </div>
                      <div className="mt-2 text-white">
                        {pendingSubmissions.length > 0
                          ? "Wait for reviewer decision"
                          : mintedSubmissions.length > 0
                            ? "Share proof artifacts"
                            : "Submit first credential"}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {[
                    "All minted credentials are available as public verification sheets.",
                    "VC and Open Badge exports are generated automatically after approval.",
                    "Reviewer notes stay attached to rejected or audited submissions for follow-up.",
                  ].map((point, index) => (
                    <div
                      key={point}
                      className="grid gap-3 rounded-xl border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-[40px_1fr]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-[#1d2b4a] text-sm font-semibold text-[#f0f0f0]">
                        {index + 1}
                      </div>
                      <p className="self-center text-[#a0a0a0]">{point}</p>
                    </div>
                  ))}
                </div>
              </div>
            </DashboardCard>
          </section>

          <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Wallet"
              value={<WalletBadge address={user.address} label="Active" />}
              accentColor="blue"
            />
            <MetricCard
              title="Role"
              value={<RoleBadge role={user.role} />}
              accentColor="purple"
            />
            <MetricCard
              title="EDU Balance"
              value={<span className="text-[#4f7ef5]">{formattedEduBalance} EDU</span>}
              accentColor="yellow"
            />
            <MetricCard
              title="On-Chain Credentials"
              value={<span className="text-[#d7ebd8]">{ownedCertificates.length}</span>}
              accentColor="green"
            />
          </div>

          <div className="mb-8 grid grid-cols-1 gap-6 sm:grid-cols-3">
            <DashboardCard>
              <div className="text-sm text-[#a0a0a0]">Pending Review</div>
              <div className="mt-2 text-4xl font-semibold text-[#f0f0f0]">
                {pendingSubmissions.length}
              </div>
            </DashboardCard>
            <DashboardCard>
              <div className="text-sm text-[#a0a0a0]">Minted Submissions</div>
              <div className="mt-2 text-4xl font-semibold text-[#d7ebd8]">
                {mintedSubmissions.length}
              </div>
            </DashboardCard>
            <DashboardCard>
              <div className="text-sm text-[#a0a0a0]">Rejected Submissions</div>
              <div className="mt-2 text-4xl font-semibold text-rose-300">
                {rejectedSubmissions.length}
              </div>
            </DashboardCard>
          </div>

          {chainError ? (
            <StatusBanner
              className="mb-8"
              tone="warning"
              title="Chain read warning"
              message={chainError}
              action={
                <button
                  type="button"
                  onClick={() => setRetryNonce((n) => n + 1)}
                  className="brand-button-secondary px-4 py-2 text-xs"
                >
                  Retry
                </button>
              }
            />
          ) : null}

          {staleTokenIds.size > 0 ? (
            <StatusBanner
              className="mb-8"
              tone="warning"
              title="Stale credential records detected"
              message={`${staleTokenIds.size} minted submission${staleTokenIds.size > 1 ? "s" : ""} in your history (token${staleTokenIds.size > 1 ? "s" : ""} ${[...staleTokenIds].map((id) => `#${id}`).join(", ")}) no longer exist on the current chain. This usually means the local Hardhat network was restarted. Proof-sheet links for these records have been disabled. Mint a fresh credential to restore a live proof sheet.`}
            />
          ) : null}

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.1fr_0.9fr] xl:items-start">
            <DashboardCard title="Owned Credentials">
              {isLoading ? (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  <SkeletonBlock variant="card" lines={4} />
                  <SkeletonBlock variant="card" lines={4} />
                </div>
              ) : ownedCertificates.length === 0 ? (
                <EmptyStatePanel
                  eyebrow="Minting has not started"
                  title="No on-chain credentials yet"
                  description="Submit academic credential evidence and wait for reviewer approval to mint your first PoCT credential."
                  icon={
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                    </svg>
                  }
                  action={
                    <Link
                      href="/upload"
                      className="brand-button-primary px-5 py-3 text-sm"
                    >
                      Go to Upload
                    </Link>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
                  {ownedCertificates.map((certificate) => {
                    const submission = submissionByTokenId.get(certificate.tokenId)

                    return (
                      <div
                        key={certificate.tokenId}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                      >
                        <div className="mb-4 flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="text-sm uppercase tracking-[0.2em] text-[#a0a0a0]">
                              Token #{certificate.tokenId}
                            </div>
                            <h3 className="mt-2 text-lg font-semibold text-white [overflow-wrap:anywhere]">
                              {submission?.courseName ?? `Credential #${certificate.tokenId}`}
                            </h3>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <p className="text-sm text-slate-400">
                                {submission?.instituteName ?? "Institute metadata unavailable"}
                              </p>
                              {submission ? (
                                <div className="rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-200">
                                  {formatCredentialTypeLabel(submission.credentialType)}
                                </div>
                              ) : null}
                            </div>
                          </div>
                          <div className="rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-200">
                            Minted
                          </div>
                        </div>

                        <div className="space-y-2 text-sm text-slate-300">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">Issued</span>
                            <span>{formatDateTime(certificate.issuedAt)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">Proof CID</span>
                            <span className="font-mono text-[#a5c0f8]">
                              {truncateValue(certificate.cid, 12, 10)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">Status</span>
                            <span className="capitalize">
                              {certificate.verificationStatus}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">Verifier</span>
                            <span className="font-mono text-[#a0a0a0]">
                              {truncateValue(certificate.verifierAddress, 10, 8)}
                            </span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">EDU Reward</span>
                            <span>
                              {submission?.eduAmount !== null && submission?.eduAmount !== undefined
                                ? `${submission.eduAmount.toLocaleString()} EDU`
                                : "Unavailable"}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 rounded-2xl border border-white/[0.10] bg-white/[0.04] p-3 text-sm text-amber-200">
                          VC JSON-LD and Open Badge exports are ready on the public
                          verification sheet for this credential. Private evidence
                          stays behind authenticated access.
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          {submission ? (
                            <button
                              type="button"
                              onClick={() => void handleOpenEvidence(submission)}
                              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                            >
                              Open Private Evidence
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => {
                              void navigator.clipboard.writeText(certificate.tokenId)
                              toast.success(`Token ID #${certificate.tokenId} copied`)
                            }}
                            className="flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-sm text-[#a0a0a0] transition hover:bg-white/10"
                          >
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 0 1-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 0 1 1.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 0 0-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 0 1-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 0 0-3.375-3.375h-1.5a1.125 1.125 0 0 1-1.125-1.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H9.75" />
                            </svg>
                            Copy Token ID
                          </button>
                          {submission?.txHash ? (
                            <button
                              type="button"
                              onClick={() => {
                                void navigator.clipboard.writeText(submission.txHash!)
                                toast.success("Transaction hash copied")
                              }}
                              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-sm text-[#a0a0a0] transition hover:bg-white/10"
                              title={`TX: ${submission.txHash}`}
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                              </svg>
                              Copy TX Hash
                            </button>
                          ) : null}
                          <Link
                            href={`/verify?tokenId=${certificate.tokenId}`}
                            className="brand-button-primary px-4 py-2.5 text-sm"
                          >
                            Verify & Export
                          </Link>
                          {!staleTokenIds.has(certificate.tokenId) && token ? (
                            <button
                              type="button"
                              onClick={() => setDisclosureTokenId(certificate.tokenId)}
                              className="cursor-pointer rounded-lg border border-[#4f7ef5]/25 bg-[#4f7ef5]/08 px-4 py-2 text-sm text-[#a5c0f8] transition hover:bg-[#4f7ef5]/15"
                            >
                              Create Disclosure
                            </button>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </DashboardCard>

            <div className="space-y-8">
              <SubmissionStatusCenter submissions={submissions} staleTokenIds={staleTokenIds} />

              <DashboardCard title="Submission Timeline">
                {isLoading ? (
                  <div className="space-y-4">
                    <SkeletonBlock variant="card" lines={3} />
                    <SkeletonBlock variant="card" lines={3} />
                    <SkeletonBlock variant="card" lines={3} />
                  </div>
                ) : submissions.length === 0 ? (
                  <EmptyStatePanel
                    eyebrow="Submission history"
                    title="No submissions recorded"
                    description="Your uploaded credentials will appear here with their review and minting lifecycle state."
                    icon={
                      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z" />
                      </svg>
                    }
                    action={
                      <Link
                        href="/upload"
                        className="brand-button-secondary px-5 py-3 text-sm"
                      >
                        Open Submission Studio
                      </Link>
                    }
                  />
                ) : (
                  <div className="space-y-4">
                    {submissions.map((submission) => (
                      <div
                        key={submission.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                      >
                        <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div className="min-w-0">
                            <h3 className="text-lg font-semibold text-white [overflow-wrap:anywhere]">
                              {submission.courseName}
                            </h3>
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              <p className="text-sm text-slate-400">
                                {submission.instituteName}
                              </p>
                              <div className="rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-200">
                                {formatCredentialTypeLabel(submission.credentialType)}
                              </div>
                            </div>
                          </div>
                          <div
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              submission.status === "minted"
                                ? "border border-emerald-500/20 bg-emerald-500/08 text-[#d7ebd8]"
                                : submission.status === "rejected"
                                  ? "border border-rose-500/24 bg-rose-500/10 text-[#f5c0d0]"
                                  : "border border-amber-500/25 bg-amber-500/10 text-amber-200"
                            }`}
                          >
                            {submission.status === "pending_review"
                              ? "Pending Review"
                              : submission.status === "minted"
                                ? "Minted"
                                : "Rejected"}
                          </div>
                        </div>

                        <div className="space-y-2 text-sm text-slate-300">
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">Uploaded</span>
                            <span>{formatDateTime(submission.uploadedAt)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">Token ID</span>
                            <span>{submission.tokenId ? `#${submission.tokenId}` : "Pending"}</span>
                          </div>
                          <div className="flex items-center justify-between gap-3">
                            <span className="text-slate-500">Reward</span>
                            <span>
                              {submission.eduAmount !== null
                                ? `${submission.eduAmount.toLocaleString()} EDU`
                                : "Pending"}
                            </span>
                          </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => void handleOpenEvidence(submission)}
                            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                          >
                            Open Private Evidence
                          </button>
                          {submission.txHash ? (
                            <button
                              type="button"
                              onClick={() => {
                                void navigator.clipboard.writeText(submission.txHash!)
                                toast.success("Transaction hash copied")
                              }}
                              className="flex items-center gap-1.5 rounded-lg border border-white/10 px-4 py-2 text-sm text-[#a0a0a0] transition hover:bg-white/10"
                            >
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 0 1 1.242 7.244l-4.5 4.5a4.5 4.5 0 0 1-6.364-6.364l1.757-1.757m13.35-.622 1.757-1.757a4.5 4.5 0 0 0-6.364-6.364l-4.5 4.5a4.5 4.5 0 0 0 1.242 7.244" />
                              </svg>
                              Copy TX Hash
                            </button>
                          ) : null}
                          {submission.tokenId ? (
                            staleTokenIds.has(submission.tokenId) ? (
                              <span
                                title="This token is not present on the current chain"
                                className="inline-flex cursor-not-allowed items-center rounded-lg border border-white/[0.06] bg-white/[0.02] px-4 py-2.5 text-sm text-[#666666]"
                              >
                                Token Unavailable
                              </span>
                            ) : (
                              <Link
                                href={`/verify?tokenId=${submission.tokenId}`}
                                className="brand-button-primary px-4 py-2.5 text-sm"
                              >
                                Verify & Export
                              </Link>
                            )
                          ) : null}
                        </div>

                        {submission.status === "minted" && submission.tokenId && !staleTokenIds.has(submission.tokenId) ? (
                          <div className="mt-4 rounded-2xl border border-[#0f766e]/24 bg-[#0f766e]/10 p-3 text-sm text-[#c9f0e7]">
                            This minted credential now has a public proof page plus
                            automatic VC and Open Badge downloads while the source
                            evidence remains private.
                          </div>
                        ) : null}

                        {submission.reviewNote ? (
                          <div className="mt-4 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                            <span className="text-slate-500">Review note:</span>{" "}
                            {submission.reviewNote}
                          </div>
                        ) : null}

                        <div className="mt-5 border-t border-white/10 pt-5">
                          <div className="mb-4 text-xs uppercase tracking-[0.2em] text-slate-500">
                            Credential Journey
                          </div>
                          <CredentialTimeline submission={submission} />
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </DashboardCard>
            </div>
          </div>

          {savedDisclosures.length > 0 && (
            <DashboardCard title="Saved Disclosure Packages">
              <div className="space-y-3">
                {savedDisclosures.map((disc) => {
                  const pkg = {
                    tokenId: disc.tokenId,
                    claimsRoot: disc.claimsRoot,
                    disclosedClaims: disc.disclosedClaims,
                    merkleProofs: disc.merkleProofs,
                    audience: disc.audience,
                    expiresAt: disc.expiresAt,
                  }
                  const pkgJson = JSON.stringify(pkg, null, 2)

                  return (
                    <div
                      key={disc.id}
                      className="flex flex-col gap-3 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="text-sm font-medium text-[#f0f0f0]">
                            Token #{disc.tokenId}
                          </span>
                          <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-2 py-0.5 text-xs text-[#a0a0a0]">
                            {disc.claimCount} claim{disc.claimCount !== 1 ? "s" : ""}
                          </span>
                          {disc.audience && (
                            <span className="rounded-full border border-[#4f7ef5]/20 bg-[#4f7ef5]/08 px-2 py-0.5 text-xs text-[#a5c0f8]">
                              {disc.audience}
                            </span>
                          )}
                          {disc.expiresAt && (
                            <span className="rounded-full border border-amber-500/20 bg-amber-500/08 px-2 py-0.5 text-xs text-amber-200">
                              Expires {disc.expiresAt}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 text-xs text-[#666666]">
                          Created {formatDateTime(disc.createdAt)}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            void navigator.clipboard.writeText(pkgJson)
                            toast.success("Disclosure package JSON copied")
                          }}
                          className="cursor-pointer rounded-lg border border-white/10 px-3 py-1.5 text-xs text-[#a0a0a0] transition hover:bg-white/10"
                        >
                          Copy JSON
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const blob = new Blob([pkgJson], { type: "application/json" })
                            const url = URL.createObjectURL(blob)
                            const a = document.createElement("a")
                            a.href = url
                            a.download = `dacs-disclosure-token-${disc.tokenId}.json`
                            a.click()
                            URL.revokeObjectURL(url)
                          }}
                          className="cursor-pointer rounded-lg border border-[#4f7ef5]/25 bg-[#4f7ef5]/08 px-3 py-1.5 text-xs text-[#a5c0f8] transition hover:bg-[#4f7ef5]/15"
                        >
                          Download
                        </button>
                      </div>
                    </div>
                  )
                })}
              </div>
            </DashboardCard>
          )}

          {disclosureTokenId && token ? (
            <DisclosureBuilderModal
              tokenId={disclosureTokenId}
              isOpen={true}
              onClose={() => setDisclosureTokenId(null)}
              token={token}
            />
          ) : null}
        </>
      ) : null}
    </PageLayout>
  )
}
