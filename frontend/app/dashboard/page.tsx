"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { AuditTrailList } from "@/components/AuditTrailList"
import { DashboardCard } from "@/components/DashboardCard"
import { EmptyStatePanel } from "@/components/EmptyStatePanel"
import { MetricCard } from "@/components/MetricCard"
import { PageLayout } from "@/components/PageLayout"
import { RoleBadge } from "@/components/RoleBadge"
import { StatusBanner } from "@/components/StatusBanner"
import { SubmissionStatusCenter } from "@/components/SubmissionStatusCenter"
import { WalletBadge } from "@/components/WalletBadge"
import { useAuth } from "@/components/AuthProvider"
import { fetchMySubmissions, isAbortError } from "@/lib/api"
import { getEduBalance } from "@/lib/contracts/edu"
import { getOwnedCertificates } from "@/lib/contracts/poct"
import { openPrivateEvidence } from "@/lib/evidence"
import { getWalletSignInLabel } from "@/lib/wallet"
import {
  formatCredentialTypeLabel,
  formatDateTime,
  truncateValue,
} from "@/lib/formatting"
import type { OnChainOwnedCertificate, Submission } from "@/lib/types"

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
  const [dataWarning, setDataWarning] = useState<string | null>(null)
  const [chainError, setChainError] = useState<string | null>(null)

  useEffect(() => {
    if (!token || !user) {
      setSubmissions([])
      setOwnedCertificates([])
      setEduBalance("0")
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
        } else {
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
  }, [token, user])

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
          <h1 className="display-serif mb-3 text-4xl font-semibold text-white sm:text-5xl">
            Track your on-chain credentials and EDU rewards in one place.
          </h1>
          <p className="text-[#c8d0de]">
            This dashboard combines your authenticated submission history with live
            contract reads from the PoCT NFT and EDU token contracts.
          </p>
        </div>

        {user ? (
          <div className="flex flex-wrap items-center gap-3">
            <RoleBadge role={user.role} />
            <WalletBadge address={user.address} label="Student" />
          </div>
        ) : null}
      </section>

      {!isReady ? (
        <DashboardCard>
          <div className="py-12 text-center text-slate-300">
            Restoring your DACS dashboard...
          </div>
        </DashboardCard>
      ) : null}

      {isReady && !isAuthenticated ? (
        <DashboardCard>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="display-serif mb-2 text-[2rem] font-semibold text-white">
                Sign in to load your student dashboard
              </h2>
              <p className="max-w-2xl text-[#c8d0de]">
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
            />
          ) : null}

          <div className="mb-8 rounded-[24px_12px_24px_12px] border border-[#b8892d]/25 bg-[#b8892d]/10 px-5 py-4 text-sm text-[#f3d9a2]">
            Minted credentials automatically become public proof artifacts after
            approval. Use the verification sheet to access shareable exports,
            standards files, and proof anchors in one place.
          </div>

          <section className="mb-10 grid gap-8 xl:grid-cols-[1.02fr_0.98fr] xl:items-start">
            <div className="brand-panel-light px-8 py-8 sm:px-10">
              <div className="brand-kicker">Credential Passport</div>
              <div className="mt-6 text-[11px] uppercase tracking-[0.34em] text-[#4f5966]">
                Student / private proof / progress posture
              </div>
              <h2 className="display-serif mt-4 max-w-4xl text-4xl font-semibold leading-[0.96] text-[#101828] sm:text-5xl">
                {passportHeadline.title}
              </h2>
              <p className="mt-5 max-w-2xl text-lg leading-8 text-[#243246]">
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
                    className="rounded-[24px_12px_24px_12px] border border-[#101828]/12 bg-[rgba(255,255,255,0.82)] p-5"
                  >
                    <div className="text-[11px] uppercase tracking-[0.26em] text-[#4d596d]">
                      {tile.label}
                    </div>
                    <div className="display-serif mt-3 text-[1.9rem] text-[#101828]">
                      {tile.value}
                    </div>
                    <p className="mt-3 text-sm leading-6 text-[#425168]">{tile.detail}</p>
                  </div>
                ))}
              </div>
            </div>

            <DashboardCard title="Passport Summary">
              <div className="space-y-5">
                <div className="rounded-[22px_12px_22px_12px] border border-[#8bbbd5]/16 bg-[#8bbbd5]/10 p-5">
                  <div className="text-xs uppercase tracking-[0.24em] text-[#d6edf8]">
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
                      className="grid gap-3 rounded-[22px_12px_22px_12px] border border-white/10 bg-white/[0.03] p-4 sm:grid-cols-[40px_1fr]"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-[15px] bg-[#f2e7d7] text-sm font-semibold text-[#101828]">
                        {index + 1}
                      </div>
                      <p className="self-center text-[#d8e0ec]">{point}</p>
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
              value={<span className="text-[#ffe2af]">{formattedEduBalance} EDU</span>}
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
              <div className="text-sm text-[#8ea0b8]">Pending Review</div>
              <div className="display-serif mt-2 text-4xl font-semibold text-[#fde4b8]">
                {pendingSubmissions.length}
              </div>
            </DashboardCard>
            <DashboardCard>
              <div className="text-sm text-[#8ea0b8]">Minted Submissions</div>
              <div className="display-serif mt-2 text-4xl font-semibold text-[#d7ebd8]">
                {mintedSubmissions.length}
              </div>
            </DashboardCard>
            <DashboardCard>
              <div className="text-sm text-[#8ea0b8]">Rejected Submissions</div>
              <div className="display-serif mt-2 text-4xl font-semibold text-rose-300">
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
            />
          ) : null}

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.1fr_0.9fr] xl:items-start">
            <DashboardCard title="Owned Credentials">
              {isLoading ? (
                <div className="py-12 text-center text-slate-300">
                  Loading your blockchain credentials...
                </div>
              ) : ownedCertificates.length === 0 ? (
                <EmptyStatePanel
                  eyebrow="Minting has not started"
                  title="No on-chain credentials yet"
                  description="Submit academic credential evidence and wait for reviewer approval to mint your first PoCT credential."
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
                            <div className="text-sm uppercase tracking-[0.2em] text-[#8bbbd5]">
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
                                <div className="rounded-full border border-[#b8892d]/20 bg-[#b8892d]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#f3d9a2]">
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
                            <span className="font-mono text-[#d5e7f1]">
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
                            <span className="font-mono text-[#ffd7c8]">
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

                        <div className="mt-4 rounded-2xl border border-[#b8892d]/20 bg-[#b8892d]/8 p-3 text-sm text-[#f3d9a2]">
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
                          <Link
                            href={`/verify?tokenId=${certificate.tokenId}`}
                            className="brand-button-primary px-4 py-2.5 text-sm"
                          >
                            Verify & Export
                          </Link>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </DashboardCard>

            <div className="space-y-8">
              <SubmissionStatusCenter submissions={submissions} />

              <DashboardCard title="Submission Timeline">
                {isLoading ? (
                  <div className="py-12 text-center text-slate-300">
                    Loading your submission history...
                  </div>
                ) : submissions.length === 0 ? (
                  <EmptyStatePanel
                    eyebrow="Submission history"
                    title="No submissions recorded"
                    description="Your uploaded credentials will appear here with their review and minting lifecycle state."
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
                              <div className="rounded-full border border-[#b8892d]/20 bg-[#b8892d]/10 px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-[#f3d9a2]">
                                {formatCredentialTypeLabel(submission.credentialType)}
                              </div>
                            </div>
                          </div>
                          <div
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              submission.status === "minted"
                                ? "border border-[#77997f]/24 bg-[#77997f]/10 text-[#d7ebd8]"
                                : submission.status === "rejected"
                                  ? "border border-rose-500/24 bg-rose-500/10 text-[#f5c0d0]"
                                  : "border border-[#f0c57f]/24 bg-[#f0c57f]/10 text-[#fde4b8]"
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
                          {submission.tokenId ? (
                            <Link
                              href={`/verify?tokenId=${submission.tokenId}`}
                              className="brand-button-primary px-4 py-2.5 text-sm"
                            >
                              Verify & Export
                            </Link>
                          ) : null}
                        </div>

                        {submission.status === "minted" && submission.tokenId ? (
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

                        {submission.auditTrail.length > 0 ? (
                          <div className="mt-4">
                            <div className="mb-3 text-xs uppercase tracking-[0.2em] text-slate-500">
                              Lifecycle Timeline
                            </div>
                            <AuditTrailList events={submission.auditTrail} compact />
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </DashboardCard>
            </div>
          </div>
        </>
      ) : null}
    </PageLayout>
  )
}
