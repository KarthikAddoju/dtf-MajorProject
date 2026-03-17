"use client"

import Image from "next/image"
import { type FormEvent, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import { AuditTrailList } from "@/components/AuditTrailList"
import { DashboardCard } from "@/components/DashboardCard"
import { MetricCard } from "@/components/MetricCard"
import { PageLayout } from "@/components/PageLayout"
import { RoleBadge } from "@/components/RoleBadge"
import { WalletBadge } from "@/components/WalletBadge"
import { useAuth } from "@/components/AuthProvider"
import {
  createInstitute,
  fetchAllSubmissions,
  fetchManageInstitutes,
  fetchPendingSubmissions,
  isAbortError,
  mintSubmission,
  rejectSubmission,
  updateInstitute,
} from "@/lib/api"
import { formatDateTime, truncateValue } from "@/lib/formatting"
import type { Institute, Submission } from "@/lib/types"

interface ReviewDraft {
  eduAmount: string
  reviewNote: string
}

export default function AdminPage() {
  const {
    connectAndSignIn,
    isAuthenticated,
    isAuthenticating,
    isReady,
    token,
    user,
  } = useAuth()

  const [pendingSubmissions, setPendingSubmissions] = useState<Submission[]>([])
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([])
  const [institutes, setInstitutes] = useState<Institute[]>([])
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isCreatingInstitute, setIsCreatingInstitute] = useState(false)
  const [processingSubmissionId, setProcessingSubmissionId] = useState<string | null>(
    null
  )
  const [togglingInstituteId, setTogglingInstituteId] = useState<string | null>(null)
  const [newInstituteName, setNewInstituteName] = useState("")
  const [newInstituteShortCode, setNewInstituteShortCode] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null)
  const [refreshNonce, setRefreshNonce] = useState(0)

  useEffect(() => {
    if (!pendingSubmissions.length) {
      return
    }

    setReviewDrafts((currentDrafts) => {
      const nextDrafts = { ...currentDrafts }

      for (const submission of pendingSubmissions) {
        if (!nextDrafts[submission.id]) {
          nextDrafts[submission.id] = {
            eduAmount: submission.eduAmount?.toString() ?? "100",
            reviewNote: submission.reviewNote ?? "",
          }
        }
      }

      return nextDrafts
    })
  }, [pendingSubmissions])

  useEffect(() => {
    if (!pendingSubmissions.length) {
      setSelectedSubmissionId(null)
      return
    }

    setSelectedSubmissionId((currentSelectedSubmissionId) => {
      if (
        currentSelectedSubmissionId &&
        pendingSubmissions.some((submission) => submission.id === currentSelectedSubmissionId)
      ) {
        return currentSelectedSubmissionId
      }

      return pendingSubmissions[0]?.id ?? null
    })
  }, [pendingSubmissions])

  useEffect(() => {
    if (!token || user?.role !== "admin") {
      setPendingSubmissions([])
      setAllSubmissions([])
      setInstitutes([])
      return
    }

    const controller = new AbortController()
    const authToken = token

    async function loadAdminData() {
      try {
        setIsLoading(true)
        const [pendingResponse, submissionsResponse, institutesResponse] =
          await Promise.all([
            fetchPendingSubmissions(authToken, controller.signal),
            fetchAllSubmissions(authToken, controller.signal),
            fetchManageInstitutes(authToken, controller.signal),
          ])

        if (controller.signal.aborted) {
          return
        }

        setPendingSubmissions(pendingResponse.submissions)
        setAllSubmissions(submissionsResponse.submissions)
        setInstitutes(institutesResponse.institutes)
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          return
        }

        const message =
          error instanceof Error ? error.message : "Could not load admin data"
        toast.error(message)
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadAdminData()

    return () => controller.abort()
  }, [refreshNonce, token, user?.role])

  async function handleApprove(submission: Submission) {
    if (!token) {
      return
    }

    const authToken = token

    const draft = reviewDrafts[submission.id]
    const parsedEduAmount = Number(draft?.eduAmount ?? "")

    if (!Number.isFinite(parsedEduAmount) || parsedEduAmount <= 0) {
      toast.error("Enter a valid positive EDU amount before approving.")
      return
    }

    setProcessingSubmissionId(submission.id)

    try {
      const response = await mintSubmission(authToken, {
        submissionId: submission.id,
        eduAmount: parsedEduAmount,
        reviewNote: draft?.reviewNote.trim() || undefined,
      })

      toast.success(
        `Minted token #${response.tokenId}, rewarded ${response.eduAmount} EDU, and enabled VC/Open Badge exports automatically.`
      )
      setRefreshNonce((value) => value + 1)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Minting failed unexpectedly"
      toast.error(message)
    } finally {
      setProcessingSubmissionId(null)
    }
  }

  async function handleReject(submission: Submission) {
    if (!token) {
      return
    }

    const authToken = token

    setProcessingSubmissionId(submission.id)

    try {
      const draft = reviewDrafts[submission.id]
      await rejectSubmission(
        authToken,
        submission.id,
        draft?.reviewNote.trim() || undefined
      )
      toast.success("Submission rejected and removed from the pending queue.")
      setRefreshNonce((value) => value + 1)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not reject submission"
      toast.error(message)
    } finally {
      setProcessingSubmissionId(null)
    }
  }

  async function handleCreateInstitute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    if (!token) {
      return
    }

    const authToken = token

    if (!newInstituteName.trim() || !newInstituteShortCode.trim()) {
      toast.error("Provide both the institute name and short code.")
      return
    }

    setIsCreatingInstitute(true)

    try {
      await createInstitute(authToken, {
        name: newInstituteName.trim(),
        shortCode: newInstituteShortCode.trim().toUpperCase(),
      })
      setNewInstituteName("")
      setNewInstituteShortCode("")
      toast.success("Institute created and added to the upload catalog.")
      setRefreshNonce((value) => value + 1)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not create institute"
      toast.error(message)
    } finally {
      setIsCreatingInstitute(false)
    }
  }

  async function handleToggleInstitute(institute: Institute) {
    if (!token) {
      return
    }

    const authToken = token

    setTogglingInstituteId(institute.id)

    try {
      await updateInstitute(authToken, institute.id, {
        isActive: !institute.isActive,
      })
      toast.success(
        institute.isActive
          ? "Institute deactivated from new uploads."
          : "Institute reactivated for new uploads."
      )
      setRefreshNonce((value) => value + 1)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not update institute"
      toast.error(message)
    } finally {
      setTogglingInstituteId(null)
    }
  }

  const mintedSubmissions = allSubmissions.filter(
    (submission) => submission.status === "minted"
  )
  const rejectedSubmissions = allSubmissions.filter(
    (submission) => submission.status === "rejected"
  )
  const totalEduDistributed = mintedSubmissions.reduce(
    (total, submission) => total + (submission.eduAmount ?? 0),
    0
  )
  const recentReviews = allSubmissions
    .filter((submission) => submission.status !== "pending_review")
    .slice(0, 6)
  const filteredPendingSubmissions = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase()

    if (!normalizedQuery) {
      return pendingSubmissions
    }

    return pendingSubmissions.filter((submission) =>
      [
        submission.courseName,
        submission.instituteName,
        submission.studentAddress,
        submission.fileName,
        submission.cid,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalizedQuery)
    )
  }, [pendingSubmissions, searchQuery])
  const selectedSubmission =
    filteredPendingSubmissions.find((submission) => submission.id === selectedSubmissionId) ??
    pendingSubmissions.find((submission) => submission.id === selectedSubmissionId) ??
    filteredPendingSubmissions[0] ??
    pendingSubmissions[0] ??
    null

  return (
    <PageLayout>
      <section className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="brand-chip mb-4">
            Admin Review Console
          </div>
          <h1 className="display-serif mb-3 text-4xl font-semibold text-white sm:text-5xl">
            Review submissions, mint credentials, and manage live institutes.
          </h1>
          <p className="text-[#c8d0de]">
            This console is backed by MongoDB for workflow state and uses the
            backend verifier to mint PoCT NFTs and EDU rewards on-chain.
          </p>
        </div>

        {user ? (
          <div className="flex flex-wrap items-center gap-3">
            <RoleBadge role={user.role} />
            <WalletBadge address={user.address} label="Admin Session" />
          </div>
        ) : null}
      </section>

      {!isReady ? (
        <DashboardCard>
          <div className="py-12 text-center text-slate-300">
            Restoring your admin session...
          </div>
        </DashboardCard>
      ) : null}

      {isReady && !isAuthenticated ? (
        <DashboardCard>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="display-serif mb-2 text-[2rem] font-semibold text-white">
                Admin wallet sign-in required
              </h2>
              <p className="max-w-2xl text-[#c8d0de]">
                The admin page is protected by JWT session auth and the configured
                admin wallet address. Connect the verifier wallet to continue.
              </p>
            </div>
            <button
              onClick={() => void connectAndSignIn()}
              disabled={isAuthenticating}
              className="brand-button-primary px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isAuthenticating ? "Connecting..." : "Connect Admin Wallet"}
            </button>
          </div>
        </DashboardCard>
      ) : null}

      {isReady && isAuthenticated && user?.role !== "admin" ? (
        <DashboardCard>
          <div className="py-12 text-center">
            <h2 className="mb-3 text-2xl font-semibold text-white">
              Access restricted
            </h2>
            <p className="mx-auto max-w-2xl text-slate-300">
              Your current wallet is signed in as a student account. Switch to the
              configured admin wallet to review pending certificates.
            </p>
          </div>
        </DashboardCard>
      ) : null}

      {isReady && isAuthenticated && user?.role === "admin" ? (
        <>
          <div className="mb-8 rounded-[24px_12px_24px_12px] border border-[#77997f]/24 bg-[#77997f]/10 px-5 py-4 text-sm text-[#d7ebd8]">
            VC and Open Badge exports are generated automatically after mint. The
            admin flow stays the same: review, approve or reject, and mint.
          </div>

          <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Pending Reviews"
              value={<span className="text-[#fde4b8]">{pendingSubmissions.length}</span>}
              accentColor="yellow"
            />
            <MetricCard
              title="Minted Credentials"
              value={<span className="text-[#d7ebd8]">{mintedSubmissions.length}</span>}
              accentColor="green"
            />
            <MetricCard
              title="Rejected Submissions"
              value={<span className="text-rose-300">{rejectedSubmissions.length}</span>}
              accentColor="purple"
            />
            <MetricCard
              title="EDU Distributed"
              value={
                <span className="text-[#d5e7f1]">
                  {totalEduDistributed.toLocaleString()} EDU
                </span>
              }
              accentColor="blue"
            />
          </div>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.3fr_0.7fr]">
            <DashboardCard title="Pending Submission Queue">
              <div className="mb-6 grid grid-cols-1 gap-4 rounded-2xl border border-white/10 bg-white/[0.03] p-4 md:grid-cols-[1fr_auto]">
                <div>
                  <label
                    htmlFor="pendingSearch"
                    className="mb-2 block text-sm font-medium text-slate-300"
                  >
                    Search Queue
                  </label>
                  <input
                    id="pendingSearch"
                    type="text"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="Search by course, institute, student wallet, file name, or CID"
                    className="w-full rounded-[18px] border border-[#eedfce]/12 bg-[rgba(255,255,255,0.04)] px-4 py-3 text-white placeholder:text-[#8ea0b8] focus:border-[#d25b36]/45 focus:outline-none"
                  />
                </div>
                <div className="flex flex-col justify-end">
                  <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
                    Showing {filteredPendingSubmissions.length} of {pendingSubmissions.length} pending submissions
                  </div>
                </div>
              </div>

              {isLoading ? (
                <div className="py-12 text-center text-slate-300">
                  Loading review queue...
                </div>
              ) : pendingSubmissions.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
                  <h3 className="mb-2 text-xl font-semibold text-white">
                    Queue clear
                  </h3>
                  <p className="text-slate-400">
                    There are no pending submissions right now. New uploads will
                    appear here automatically.
                  </p>
                </div>
              ) : filteredPendingSubmissions.length === 0 ? (
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-8 text-center">
                  <h3 className="mb-2 text-xl font-semibold text-white">
                    No queue matches that search
                  </h3>
                  <p className="text-slate-400">
                    Try a broader search term to bring the submission queue back
                    into view.
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {filteredPendingSubmissions.map((submission) => {
                    const draft = reviewDrafts[submission.id] ?? {
                      eduAmount: "100",
                      reviewNote: "",
                    }
                    const isProcessing = processingSubmissionId === submission.id
                    const isSelected = selectedSubmissionId === submission.id

                    return (
                      <div
                        key={submission.id}
                        className={`rounded-2xl border p-5 transition ${
                          isSelected
                            ? "border-[#d25b36]/35 bg-[#d25b36]/10 shadow-lg shadow-[#d25b36]/10"
                            : "border-white/10 bg-white/[0.03]"
                        }`}
                      >
                        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <div>
                            <h3 className="text-lg font-semibold text-white">
                              {submission.courseName}
                            </h3>
                            <p className="text-sm text-slate-400">
                              {submission.instituteName}
                            </p>
                          </div>
                          <div className="rounded-full border border-[#f0c57f]/24 bg-[#f0c57f]/10 px-3 py-1 text-xs font-medium text-[#fde4b8]">
                            Pending Review
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 text-sm text-slate-300 md:grid-cols-2">
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                              Student
                            </div>
                            <div className="mt-2 font-mono text-[#d5e7f1]">
                              {truncateValue(submission.studentAddress, 12, 10)}
                            </div>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                              CID
                            </div>
                            <div className="mt-2 font-mono text-[#d5e7f1]">
                              {truncateValue(submission.cid, 16, 12)}
                            </div>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                              Uploaded
                            </div>
                            <div className="mt-2">{formatDateTime(submission.uploadedAt)}</div>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                              File
                            </div>
                            <div className="mt-2">{submission.fileName}</div>
                          </div>
                        </div>

                        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-[0.35fr_0.65fr]">
                          <div>
                            <label
                              htmlFor={`eduAmount-${submission.id}`}
                              className="mb-2 block text-sm font-medium text-slate-300"
                            >
                              EDU Reward
                            </label>
                            <input
                              id={`eduAmount-${submission.id}`}
                              type="number"
                              min="1"
                              step="1"
                              value={draft.eduAmount}
                              onChange={(event) =>
                                setReviewDrafts((currentDrafts) => ({
                                  ...currentDrafts,
                                  [submission.id]: {
                                    ...draft,
                                    eduAmount: event.target.value,
                                  },
                                }))
                              }
                              className="w-full rounded-[18px] border border-[#eedfce]/12 bg-[rgba(255,255,255,0.04)] px-4 py-3 text-white focus:border-[#d25b36]/45 focus:outline-none"
                            />
                          </div>

                          <div>
                            <label
                              htmlFor={`reviewNote-${submission.id}`}
                              className="mb-2 block text-sm font-medium text-slate-300"
                            >
                              Review Note
                            </label>
                            <textarea
                              id={`reviewNote-${submission.id}`}
                              value={draft.reviewNote}
                              onChange={(event) =>
                                setReviewDrafts((currentDrafts) => ({
                                  ...currentDrafts,
                                  [submission.id]: {
                                    ...draft,
                                    reviewNote: event.target.value,
                                  },
                                }))
                              }
                              rows={3}
                              placeholder="Add an approval note or rejection reason"
                              className="w-full rounded-[18px] border border-[#eedfce]/12 bg-[rgba(255,255,255,0.04)] px-4 py-3 text-white placeholder:text-[#8ea0b8] focus:border-[#d25b36]/45 focus:outline-none"
                            />
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedSubmissionId(submission.id)}
                            className="rounded-full border border-[#d25b36]/24 bg-[#d25b36]/10 px-4 py-2 text-sm font-medium text-[#ffd7c8] transition hover:bg-[#d25b36]/20"
                          >
                            {isSelected ? "Previewing" : "Review Workspace"}
                          </button>
                          <a
                            href={submission.ipfsUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                          >
                            Open IPFS File
                          </a>
                          <button
                            type="button"
                            onClick={() => void handleReject(submission)}
                            disabled={isProcessing}
                            className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isProcessing ? "Processing..." : "Reject"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleApprove(submission)}
                            disabled={isProcessing}
                            className="brand-button-primary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isProcessing ? "Minting..." : "Approve & Mint"}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </DashboardCard>

            <div className="space-y-8">
              <DashboardCard title="Review Workspace">
                {selectedSubmission ? (
                  <div className="space-y-5">
                    <div>
                      <div className="text-xs uppercase tracking-[0.3em] text-[#ffd7c8]">
                        Active Review Focus
                      </div>
                      <h3 className="mt-2 text-xl font-semibold text-white">
                        {selectedSubmission.courseName}
                      </h3>
                      <p className="text-slate-400">
                        {selectedSubmission.instituteName}
                      </p>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          Student
                        </div>
                        <div className="mt-2 font-mono text-sm text-[#d5e7f1]">
                          {truncateValue(selectedSubmission.studentAddress, 12, 10)}
                        </div>
                      </div>
                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          Uploaded
                        </div>
                        <div className="mt-2 text-sm text-white">
                          {formatDateTime(selectedSubmission.uploadedAt)}
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-black/20 p-3">
                      {selectedSubmission.mimeType === "application/pdf" ? (
                        <iframe
                          src={selectedSubmission.ipfsUrl}
                          title={`${selectedSubmission.courseName} preview`}
                          className="h-[420px] w-full rounded-xl bg-slate-950"
                        />
                      ) : selectedSubmission.mimeType.startsWith("image/") ? (
                        <div className="relative h-[420px] overflow-hidden rounded-xl bg-slate-950">
                          <Image
                            src={selectedSubmission.ipfsUrl}
                            alt={selectedSubmission.courseName}
                            fill
                            unoptimized
                            className="object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex h-[420px] items-center justify-center rounded-xl bg-slate-950 text-center text-slate-400">
                          Preview is not available for this file type. Open the IPFS
                          file in a separate tab instead.
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                      <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                        Review Notes
                      </div>
                      <p>
                        Use the queue card on the left to assign the EDU reward, add
                        a reviewer note, and approve or reject while keeping the
                        certificate preview open here.
                      </p>
                    </div>

                    <div>
                      <div className="mb-3 text-xs uppercase tracking-[0.3em] text-[#ffd7c8]">
                        Audit Trail
                      </div>
                      <AuditTrailList
                        events={selectedSubmission.auditTrail}
                        emptyMessage="This submission will show lifecycle events after upload, review, and minting."
                        compact
                      />
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-6 text-center text-slate-400">
                    Select a pending submission to open the reviewer workspace.
                  </div>
                )}
              </DashboardCard>

              <DashboardCard title="Institute Management">
                <form onSubmit={handleCreateInstitute} className="space-y-4">
                  <div>
                    <label
                      htmlFor="newInstituteName"
                      className="mb-2 block text-sm font-medium text-slate-300"
                    >
                      Institute Name
                    </label>
                    <input
                      id="newInstituteName"
                      type="text"
                      value={newInstituteName}
                      onChange={(event) => setNewInstituteName(event.target.value)}
                      placeholder="International Institute of Technology"
                      className="w-full rounded-[18px] border border-[#eedfce]/12 bg-[rgba(255,255,255,0.04)] px-4 py-3 text-white focus:border-[#d25b36]/45 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="newInstituteShortCode"
                      className="mb-2 block text-sm font-medium text-slate-300"
                    >
                      Short Code
                    </label>
                    <input
                      id="newInstituteShortCode"
                      type="text"
                      value={newInstituteShortCode}
                      onChange={(event) => setNewInstituteShortCode(event.target.value)}
                      placeholder="IITX"
                      className="w-full rounded-[18px] border border-[#eedfce]/12 bg-[rgba(255,255,255,0.04)] px-4 py-3 text-white focus:border-[#d25b36]/45 focus:outline-none"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={isCreatingInstitute}
                    className="brand-button-primary w-full px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {isCreatingInstitute ? "Creating..." : "Add Institute"}
                  </button>
                </form>

                <div className="mt-6 space-y-3">
                  {institutes.map((institute) => {
                    const isToggling = togglingInstituteId === institute.id

                    return (
                      <div
                        key={institute.id}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="font-medium text-white">{institute.name}</div>
                            <div className="text-sm text-slate-400">
                              {institute.shortCode} · {institute.slug}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => void handleToggleInstitute(institute)}
                            disabled={isToggling}
                            className={`rounded-lg px-3 py-2 text-sm font-medium transition ${
                              institute.isActive
                                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200 hover:bg-emerald-500/20"
                                : "border border-white/10 bg-white/5 text-slate-200 hover:bg-white/10"
                            } disabled:cursor-not-allowed disabled:opacity-60`}
                          >
                            {isToggling
                              ? "Updating..."
                              : institute.isActive
                                ? "Deactivate"
                                : "Activate"}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </DashboardCard>

              <DashboardCard title="Recent Review Activity">
                {recentReviews.length === 0 ? (
                  <div className="text-slate-400">
                    Approved and rejected submissions will appear here after review.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {recentReviews.map((submission) => (
                      <div
                        key={submission.id}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-white">
                              {submission.courseName}
                            </div>
                            <div className="text-sm text-slate-400">
                              {submission.instituteName}
                            </div>
                          </div>
                          <div
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              submission.status === "minted"
                                ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                                : "border border-rose-500/30 bg-rose-500/10 text-rose-200"
                            }`}
                          >
                            {submission.status === "minted" ? "Minted" : "Rejected"}
                          </div>
                        </div>

                        <div className="mt-3 text-sm text-slate-300">
                          {submission.status === "minted" ? (
                            <>
                              Token #{submission.tokenId} minted on{" "}
                              {formatDateTime(submission.mintedAt)}
                            </>
                          ) : (
                            <>Rejected on {formatDateTime(submission.reviewedAt)}</>
                          )}
                        </div>

                        {submission.reviewNote ? (
                          <div className="mt-3 rounded-xl border border-white/10 bg-black/20 p-3 text-sm text-slate-300">
                            {submission.reviewNote}
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
