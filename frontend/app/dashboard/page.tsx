"use client"

import Link from "next/link"
import { useEffect, useState } from "react"
import { toast } from "sonner"
import { AuditTrailList } from "@/components/AuditTrailList"
import { DashboardCard } from "@/components/DashboardCard"
import { MetricCard } from "@/components/MetricCard"
import { PageLayout } from "@/components/PageLayout"
import { RoleBadge } from "@/components/RoleBadge"
import { WalletBadge } from "@/components/WalletBadge"
import { useAuth } from "@/components/AuthProvider"
import { fetchMySubmissions, isAbortError } from "@/lib/api"
import { getEduBalance } from "@/lib/contracts/edu"
import { getOwnedCertificates } from "@/lib/contracts/poct"
import { formatDateTime, truncateValue } from "@/lib/formatting"
import type { OnChainOwnedCertificate, Submission } from "@/lib/types"

export default function DashboardPage() {
  const {
    connectAndSignIn,
    isAuthenticated,
    isAuthenticating,
    isReady,
    token,
    user,
  } = useAuth()

  const [submissions, setSubmissions] = useState<Submission[]>([])
  const [ownedCertificates, setOwnedCertificates] = useState<OnChainOwnedCertificate[]>(
    []
  )
  const [eduBalance, setEduBalance] = useState("0")
  const [isLoading, setIsLoading] = useState(false)
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
        toast.error(message)
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
              {isAuthenticating ? "Connecting..." : "Connect & Sign In"}
            </button>
          </div>
        </DashboardCard>
      ) : null}

      {isReady && isAuthenticated && user ? (
        <>
          <div className="mb-8 rounded-[24px_12px_24px_12px] border border-[#b8892d]/25 bg-[#b8892d]/10 px-5 py-4 text-sm text-[#f3d9a2]">
            Minted credentials automatically unlock the public verification sheet,
            VC JSON-LD export, and Open Badge export. No extra admin action is
            required after approval and minting.
          </div>

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
            <div className="mb-8 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
              {chainError}
            </div>
          ) : null}

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.1fr_0.9fr]">
            <DashboardCard title="Owned Credentials">
              {isLoading ? (
                <div className="py-12 text-center text-slate-300">
                  Loading your blockchain credentials...
                </div>
              ) : ownedCertificates.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
                  <h3 className="mb-2 text-xl font-semibold text-white">
                    No on-chain credentials yet
                  </h3>
                  <p className="mb-5 text-slate-400">
                    Upload a certificate and wait for admin approval to mint your
                    first PoCT credential.
                  </p>
                  <Link
                    href="/upload"
                    className="brand-button-primary px-5 py-3 text-sm"
                  >
                    Go to Upload
                  </Link>
                </div>
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
                          <div>
                            <div className="text-sm uppercase tracking-[0.2em] text-[#8bbbd5]">
                              Token #{certificate.tokenId}
                            </div>
                            <h3 className="mt-2 text-lg font-semibold text-white">
                              {submission?.courseName ?? `Credential #${certificate.tokenId}`}
                            </h3>
                            <p className="text-sm text-slate-400">
                              {submission?.instituteName ?? "Institute metadata unavailable"}
                            </p>
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
                            <span className="text-slate-500">CID</span>
                            <span className="font-mono text-[#d5e7f1]">
                              {truncateValue(certificate.cid, 12, 10)}
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
                          verification sheet for this credential.
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <a
                            href={submission?.ipfsUrl ?? `https://ipfs.io/ipfs/${certificate.cid}`}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                          >
                            Open IPFS
                          </a>
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

            <DashboardCard title="Submission Timeline">
              {isLoading ? (
                <div className="py-12 text-center text-slate-300">
                  Loading your submission history...
                </div>
              ) : submissions.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
                  <h3 className="mb-2 text-xl font-semibold text-white">
                    No submissions recorded
                  </h3>
                  <p className="text-slate-400">
                    Your uploaded certificates will appear here with their review and
                    minting lifecycle state.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {submissions.map((submission) => (
                    <div
                      key={submission.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5"
                    >
                      <div className="mb-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <h3 className="text-lg font-semibold text-white">
                            {submission.courseName}
                          </h3>
                          <p className="text-sm text-slate-400">
                            {submission.instituteName}
                          </p>
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
                        <a
                          href={submission.ipfsUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                        >
                          Open IPFS
                        </a>
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
                          automatic VC and Open Badge downloads.
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
        </>
      ) : null}
    </PageLayout>
  )
}
