"use client"

import { ethers } from "ethers"
import Image from "next/image"
import { type FormEvent, useEffect, useMemo, useRef, useState } from "react"
import { toast } from "sonner"
import { AuditTrailList } from "@/components/AuditTrailList"
import { DashboardCard } from "@/components/DashboardCard"
import { DestructiveActionModal } from "@/components/DestructiveActionModal"
import { EmptyStatePanel } from "@/components/EmptyStatePanel"
import { MetricCard } from "@/components/MetricCard"
import { PageLayout } from "@/components/PageLayout"
import { RoleBadge } from "@/components/RoleBadge"
import { SkeletonBlock } from "@/components/SkeletonBlock"
import { StatusBanner } from "@/components/StatusBanner"
import { WalletBadge } from "@/components/WalletBadge"
import { useAuth } from "@/components/AuthProvider"
import {
  analyseEvidence,
  createInstitute,
  fetchAllSubmissions,
  fetchEvidenceBlob,
  fetchManageInstitutes,
  fetchPendingSubmissions,
  fetchPlatformHealth,
  finalizeCredentialRevocation,
  finalizeMintSubmission,
  isAbortError,
  prepareMintSubmission,
  rejectSubmission,
  resetStaleMints,
  updateInstitute,
} from "@/lib/api"
import { ensureInstituteVerifierAuthorization, submitCredentialRevocation, submitDualMint } from "@/lib/contracts/mint-controller"
import { openPrivateEvidence } from "@/lib/evidence"
import {
  formatCredentialTypeLabel,
  formatDateTime,
  truncateValue,
} from "@/lib/formatting"
import { areWalletAddressesEqual, connectWallet } from "@/lib/wallet"
import type { AiInsight, Institute, PlatformHealth, Submission } from "@/lib/types"

interface ReviewDraft {
  eduAmount: string
  reviewNote: string
  expiresAt: string
}

type AiState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "error"; message: string }
  | { status: "done"; insight: AiInsight }

interface InstituteFieldErrors {
  name?: string
  shortCode?: string
}

function getInstituteFieldErrors(
  name: string,
  shortCode: string
): InstituteFieldErrors {
  const errors: InstituteFieldErrors = {}

  if (!name.trim()) {
    errors.name = "Enter the institute name before creating it."
  }

  if (!shortCode.trim()) {
    errors.shortCode = "Enter a short code such as IITH or BITS."
  } else if (shortCode.trim().length < 2 || shortCode.trim().length > 10) {
    errors.shortCode = "Use a short code between 2 and 10 characters."
  }

  return errors
}

function getEduAmountError(value: string) {
  const parsedValue = Number(value)

  if (!value.trim()) {
    return "Enter the EDU reward that should be minted with this credential."
  }

  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    return "Use a positive EDU amount."
  }

  return undefined
}

function translateContractError(raw: string): string {
  if (/user rejected|user denied/i.test(raw)) {
    return "Transaction was rejected in MetaMask."
  }
  if (/insufficient funds/i.test(raw)) {
    return "Your wallet has insufficient ETH to cover the gas fee."
  }
  if (/not authorized for institute/i.test(raw)) {
    return "Your wallet is not registered as a verifier for this institute."
  }
  if (/EDU exceeds per-mint cap/i.test(raw)) {
    return "EDU amount exceeds the per-mint maximum. Lower the reward amount."
  }
  if (/supply cap exceeded/i.test(raw)) {
    return "EDU token supply cap has been reached. Minting is unavailable."
  }
  if (/expiresAt must be zero or in the future/i.test(raw)) {
    return "Expiry date must be set in the future, or left blank."
  }
  if (/nonce too low|replacement fee too low/i.test(raw)) {
    return "Transaction nonce conflict. Reset MetaMask activity and try again."
  }
  if (/network changed|chain changed/i.test(raw)) {
    return "Network changed during transaction. Switch back to the DACS network and retry."
  }
  return raw
}

function getMissingContractLabels(platformHealth: PlatformHealth | null) {
  if (!platformHealth) {
    return [] as string[]
  }

  return [
    !platformHealth.contracts.poctDeployed ? "PoCT" : null,
    !platformHealth.contracts.eduDeployed ? "EDU" : null,
    !platformHealth.contracts.mintControllerDeployed ? "Mint Controller" : null,
  ].filter((value): value is string => Boolean(value))
}

function isBlockchainWriteReady(platformHealth: PlatformHealth | null) {
  return Boolean(
    platformHealth &&
      platformHealth.services.blockchain.status === "connected" &&
      platformHealth.services.blockchain.contractsReady &&
      platformHealth.services.blockchain.chainId !== null
  )
}

function getBlockchainActionBlockedReason(platformHealth: PlatformHealth | null) {
  if (!platformHealth) {
    return "Platform health is temporarily unavailable. Retry after GET /api/health reports a connected blockchain."
  }

  const warning = platformHealth.services.blockchain.warnings[0]

  if (warning) {
    return `${warning} Retry after GET /api/health reports a connected blockchain.`
  }

  if (platformHealth.services.blockchain.chainId === null) {
    return "The backend cannot currently reach the configured RPC endpoint. Start the local devnet and retry."
  }

  if (!platformHealth.services.blockchain.chainIdMatchesConfig) {
    return `Observed chain ${platformHealth.services.blockchain.observedChainId ?? "unknown"} does not match expected chain ${platformHealth.services.blockchain.expectedChainId}. Restart the backend after resyncing the demo env files.`
  }

  const missingContracts = getMissingContractLabels(platformHealth)

  if (missingContracts.length > 0) {
    return `Configured contract code is missing for ${missingContracts.join(", ")} on chain ${platformHealth.services.blockchain.observedChainId ?? platformHealth.services.blockchain.chainId ?? "unknown"}.`
  }

  return "Blockchain write actions are temporarily unavailable."
}

function toDateTimeLocalValue(value: string | null) {
  if (!value) {
    return ""
  }

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) {
    return ""
  }

  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000)
    .toISOString()
    .slice(0, 16)
}

function AiInsightPanel({
  insight,
  onUseSuggestion,
}: {
  insight: AiInsight
  onUseSuggestion: (amount: number) => void
}) {
  const confidenceTone =
    insight.confidence === "high"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
      : insight.confidence === "medium"
        ? "border-white/[0.10] bg-white/[0.04] text-amber-200"
        : "border-rose-500/25 bg-rose-500/10 text-rose-300"

  const rows: { label: string; value: string | null }[] = [
    { label: "Institution", value: insight.institution },
    { label: "Course", value: insight.courseName },
    { label: "Type", value: insight.credentialType },
    { label: "Grade", value: insight.grade },
    { label: "Issued", value: insight.issueDate },
    { label: "Duration / Credits", value: insight.durationOrCredits },
  ]

  return (
    <div className="mt-4 rounded-xl border border-[#4f7ef5]/15 bg-[#161616] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-[#4f7ef5]" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
          </svg>
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-[#4f7ef5]">
            AI Analysis
          </span>
        </div>
        <div className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${confidenceTone}`}>
          {insight.confidence} confidence
        </div>
      </div>

      <div className="mb-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
        {rows.map(({ label, value }) =>
          value ? (
            <div key={label} className="flex gap-2 text-sm">
              <span className="w-28 shrink-0 text-slate-500">{label}</span>
              <span className="text-slate-200 [overflow-wrap:anywhere]">{value}</span>
            </div>
          ) : null
        )}
      </div>

      {insight.rawSummary ? (
        <p className="mb-3 text-xs italic text-slate-500 [overflow-wrap:anywhere]">
          &ldquo;{insight.rawSummary}&rdquo;
        </p>
      ) : null}

      <div className="border-t border-white/8 pt-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
              Suggested EDU
            </div>
            <div className="mt-1 text-xl font-bold text-white">
              {insight.suggestedEduAmount}{" "}
              <span className="text-sm font-normal text-slate-400">tokens</span>
            </div>
            {insight.suggestionReason ? (
              <p className="mt-1 text-xs text-slate-500">{insight.suggestionReason}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={() => onUseSuggestion(insight.suggestedEduAmount)}
            className="rounded-lg border border-[#4f7ef5]/25 bg-[#4f7ef5]/12 px-4 py-2.5 text-sm font-semibold text-[#a5c0f8] transition hover:bg-[#4f7ef5]/20"
          >
            Use suggestion ({insight.suggestedEduAmount} EDU)
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AdminPage() {
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

  const [pendingSubmissions, setPendingSubmissions] = useState<Submission[]>([])
  const [allSubmissions, setAllSubmissions] = useState<Submission[]>([])
  const [institutes, setInstitutes] = useState<Institute[]>([])
  const [reviewDrafts, setReviewDrafts] = useState<Record<string, ReviewDraft>>({})
  const [isLoading, setIsLoading] = useState(false)
  const [isCreatingInstitute, setIsCreatingInstitute] = useState(false)
  const [isResettingStaleMints, setIsResettingStaleMints] = useState(false)
  const [processingSubmissionId, setProcessingSubmissionId] = useState<string | null>(
    null
  )
  const [confirmModal, setConfirmModal] = useState<{
    action: "reject" | "revoke"
    submission: Submission
  } | null>(null)
  const [aiStates, setAiStates] = useState<Record<string, AiState>>({})
  const [togglingInstituteId, setTogglingInstituteId] = useState<string | null>(null)
  const [newInstituteName, setNewInstituteName] = useState("")
  const [newInstituteShortCode, setNewInstituteShortCode] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedSubmissionId, setSelectedSubmissionId] = useState<string | null>(null)
  const [selectedEvidencePreviewUrl, setSelectedEvidencePreviewUrl] = useState<string | null>(
    null
  )
  const [platformHealth, setPlatformHealth] = useState<PlatformHealth | null>(null)
  const [refreshNonce, setRefreshNonce] = useState(0)
  const [reviewFieldErrors, setReviewFieldErrors] = useState<
    Record<string, { eduAmount?: string }>
  >({})
  const [consoleStatus, setConsoleStatus] = useState<{
    tone: "info" | "success" | "error"
    title: string
    message: string
  } | null>(null)
  const [instituteSubmitAttempted, setInstituteSubmitAttempted] = useState(false)
  const [touchedInstituteFields, setTouchedInstituteFields] = useState({
    name: false,
    shortCode: false,
  })
  const queueHotkeyStateRef = useRef<{
    submissions: Submission[]
    selectedIndex: number
    isEnabled: boolean
  }>({
    submissions: [],
    selectedIndex: -1,
    isEnabled: false,
  })

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
            expiresAt: toDateTimeLocalValue(submission.expiresAt),
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
    if (!token || (user?.role !== "admin" && user?.role !== "verifier")) {
      setPendingSubmissions([])
      setAllSubmissions([])
      setInstitutes([])
      setPlatformHealth(null)
      return
    }

    const controller = new AbortController()
    const authToken = token

    async function loadAdminData() {
      try {
        setIsLoading(true)
        const [pendingResponse, submissionsResponse, institutesResponse, healthResponse] =
          await Promise.all([
            fetchPendingSubmissions(authToken, controller.signal),
            fetchAllSubmissions(authToken, controller.signal),
            user?.role === "admin"
              ? fetchManageInstitutes(authToken, controller.signal)
              : Promise.resolve({ institutes: [] }),
            user?.role === "admin" || user?.role === "verifier"
              ? fetchPlatformHealth(controller.signal).catch(() => null)
              : Promise.resolve(null),
          ])

        if (controller.signal.aborted) {
          return
        }

        setPendingSubmissions(pendingResponse.submissions)
        setAllSubmissions(submissionsResponse.submissions)
        setInstitutes(institutesResponse.institutes)
        setPlatformHealth(healthResponse)
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          return
        }

        setPlatformHealth(null)
        const message =
          error instanceof Error ? error.message : "Could not load admin data"
        setConsoleStatus({
          tone: "error",
          title: "Admin console unavailable",
          message,
        })
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadAdminData()

    return () => controller.abort()
  }, [refreshNonce, token, user?.role])

  async function handleResetStaleMints() {
    if (!token || user?.role !== "admin") {
      return
    }

    setIsResettingStaleMints(true)

    try {
      const result = await resetStaleMints(token)
      const message =
        result.resetCount > 0
          ? `Reset ${result.resetCount} stale minted submission${result.resetCount === 1 ? "" : "s"} so they can be minted again on the current chain.`
          : "No stale minted submissions were found on the active chain."

      setConsoleStatus({
        tone: result.resetCount > 0 ? "success" : "info",
        title: result.resetCount > 0 ? "Stale mints reset" : "No stale mints found",
        message,
      })

      if (result.resetCount > 0) {
        toast.success(message)
      } else {
        toast(message)
      }

      setRefreshNonce((value) => value + 1)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not reset stale minted submissions"

      setConsoleStatus({
        tone: "error",
        title: "Stale mint reset failed",
        message,
      })
      toast.error(message)
    } finally {
      setIsResettingStaleMints(false)
    }
  }

  async function handleApprove(submission: Submission) {
    if (!token || !user) {
      return
    }

    const authToken = token

    const draft = reviewDrafts[submission.id]
    const eduAmountError = getEduAmountError(draft?.eduAmount ?? "")

    setReviewFieldErrors((currentErrors) => ({
      ...currentErrors,
      [submission.id]: {
        ...currentErrors[submission.id],
        eduAmount: eduAmountError,
      },
    }))

    if (eduAmountError) {
      setSelectedSubmissionId(submission.id)
      return
    }

    const parsedEduAmount = Number(draft?.eduAmount ?? "")
    const normalizedExpiry = draft?.expiresAt?.trim() ? new Date(draft.expiresAt) : null

    if (normalizedExpiry && Number.isNaN(normalizedExpiry.getTime())) {
      setConsoleStatus({
        tone: "error",
        title: "Expiry date invalid",
        message: "Use a valid expiry date or leave the field blank.",
      })
      setSelectedSubmissionId(submission.id)
      return
    }

    const canPrepareMint = await confirmBlockchainActionReady("Prepare & Mint")

    if (!canPrepareMint) {
      setSelectedSubmissionId(submission.id)
      return
    }

    setProcessingSubmissionId(submission.id)
    setConsoleStatus({
      tone: "info",
      title: "Preparing wallet-signed mint",
      message:
        "DACS is preparing the public proof bundle and canonical mint payload for the reviewer wallet.",
    })

    try {
      const prepared = await prepareMintSubmission(authToken, {
        submissionId: submission.id,
        eduAmount: parsedEduAmount,
        reviewNote: draft?.reviewNote.trim() || undefined,
        expiresAt: normalizedExpiry?.toISOString() ?? null,
      })
      const wallet = await connectWallet()

      if (!areWalletAddressesEqual(wallet.address, user.address)) {
        throw new Error(
          "The connected wallet does not match the signed reviewer session. Reconnect with the same wallet you authenticated with."
        )
      }

      setConsoleStatus({
        tone: "info",
        title: "Awaiting wallet confirmation",
        message:
          "Review the transaction in MetaMask. DACS will finalize the mint only after the on-chain receipt is confirmed.",
      })

      await ensureInstituteVerifierAuthorization(
        wallet.signer,
        prepared.mintPayload.instituteHash
      )

      const mintTransaction = await submitDualMint(wallet.signer, prepared.mintPayload)
      const receipt = await mintTransaction.wait()

      if (!receipt) {
        throw new Error("Mint transaction confirmation could not be resolved.")
      }

      const finalized = await finalizeMintSubmission(
        authToken,
        submission.id,
        mintTransaction.hash
      )

      setConsoleStatus({
        tone: "success",
        title: "Credential minted",
        message: `Token #${finalized.tokenId} minted successfully. Public proof, VC, and Open Badge exports are now live without exposing the private evidence file.`,
      })
      setRefreshNonce((value) => value + 1)
    } catch (error) {
      const raw = error instanceof Error ? error.message : String(error)
      const message = translateContractError(raw)
      setConsoleStatus({
        tone: "error",
        title: "Mint failed",
        message,
      })
    } finally {
      setProcessingSubmissionId(null)
    }
  }

  async function handleOpenEvidence(submission: Submission) {
    if (!token) {
      return
    }

    try {
      await openPrivateEvidence(token, submission.id, submission.fileName)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not open the private evidence file"
      toast.error(message)
      setConsoleStatus({
        tone: "error",
        title: "Evidence unavailable",
        message,
      })
    }
  }

  async function handleAnalyse(submission: Submission) {
    if (!token) return
    setAiStates((s) => ({ ...s, [submission.id]: { status: "loading" } }))
    try {
      const insight = await analyseEvidence(token, submission.id)
      setAiStates((s) => ({ ...s, [submission.id]: { status: "done", insight } }))
    } catch (err) {
      const message = err instanceof Error ? err.message : "Analysis failed"
      setAiStates((s) => ({ ...s, [submission.id]: { status: "error", message } }))
    }
  }

  function handleReject(submission: Submission) {
    setConfirmModal({ action: "reject", submission })
  }

  async function executeReject(submission: Submission) {
    if (!token) {
      return
    }

    const authToken = token

    setConfirmModal(null)
    setProcessingSubmissionId(submission.id)
    setConsoleStatus({
      tone: "info",
      title: "Applying review decision",
      message:
        "DACS is recording the rejection note and updating the student lifecycle timeline.",
    })

    try {
      const draft = reviewDrafts[submission.id]
      await rejectSubmission(
        authToken,
        submission.id,
        draft?.reviewNote.trim() || undefined
      )
      setConsoleStatus({
        tone: "success",
        title: "Submission rejected",
        message:
          "The credential was removed from the pending queue and the student can now see the reviewer outcome.",
      })
      setRefreshNonce((value) => value + 1)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not reject submission"
      setConsoleStatus({
        tone: "error",
        title: "Rejection could not be saved",
        message,
      })
    } finally {
      setProcessingSubmissionId(null)
    }
  }

  function handleRevoke(submission: Submission) {
    if (!submission.tokenId) return
    setConfirmModal({ action: "revoke", submission })
  }

  async function executeRevoke(submission: Submission, reason?: string) {
    if (!token || !user || !submission.tokenId) {
      return
    }

    const normalizedReason = (reason ?? "").trim() || "Credential revoked"

    const canRevokeCredential = await confirmBlockchainActionReady("Revoke Credential")

    if (!canRevokeCredential) {
      return
    }

    setConfirmModal(null)
    setProcessingSubmissionId(submission.id)
    setConsoleStatus({
      tone: "info",
      title: "Awaiting revocation confirmation",
      message:
        "Confirm the revocation transaction in MetaMask. DACS will update the audit trail after the on-chain receipt is available.",
    })

    try {
      const wallet = await connectWallet()

      if (!areWalletAddressesEqual(wallet.address, user.address)) {
        throw new Error(
          "The connected wallet does not match the signed reviewer session. Reconnect with the same wallet you authenticated with."
        )
      }

      const revokeTransaction = await submitCredentialRevocation(
        wallet.signer,
        submission.tokenId,
        ethers.id(normalizedReason)
      )
      const receipt = await revokeTransaction.wait()

      if (!receipt) {
        throw new Error("Revocation transaction confirmation could not be resolved.")
      }

      await finalizeCredentialRevocation(token, submission.tokenId, {
        txHash: revokeTransaction.hash,
        reason: normalizedReason,
      })

      setConsoleStatus({
        tone: "success",
        title: "Credential revoked",
        message: `Token #${submission.tokenId} now resolves as revoked across the verification sheet and exports.`,
      })
      setRefreshNonce((value) => value + 1)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not revoke the credential"
      setConsoleStatus({
        tone: "error",
        title: "Revocation failed",
        message,
      })
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

    setInstituteSubmitAttempted(true)
    setTouchedInstituteFields({
      name: true,
      shortCode: true,
    })

    if (Object.keys(instituteFieldErrors).length > 0) {
      return
    }

    setIsCreatingInstitute(true)
    setConsoleStatus({
      tone: "info",
      title: "Creating institute",
      message:
        "The new institute is being added to the upload catalog and public index.",
    })

    try {
      await createInstitute(authToken, {
        name: newInstituteName.trim(),
        shortCode: newInstituteShortCode.trim().toUpperCase(),
      })
      setNewInstituteName("")
      setNewInstituteShortCode("")
      setConsoleStatus({
        tone: "success",
        title: "Institute added",
        message:
          "The institute is now available in upload forms and the public college index.",
      })
      setRefreshNonce((value) => value + 1)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not create institute"
      setConsoleStatus({
        tone: "error",
        title: "Institute could not be created",
        message,
      })
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
    setConsoleStatus({
      tone: "info",
      title: institute.isActive ? "Deactivating institute" : "Reactivating institute",
      message:
        "The institute availability is being updated across new submissions and catalog views.",
    })

    try {
      await updateInstitute(authToken, institute.id, {
        isActive: !institute.isActive,
      })
      setConsoleStatus({
        tone: "success",
        title: institute.isActive ? "Institute deactivated" : "Institute reactivated",
        message: institute.isActive
          ? "New submissions can no longer target this institute until it is re-enabled."
          : "The institute is once again available for new student submissions.",
      })
      setRefreshNonce((value) => value + 1)
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Could not update institute"
      setConsoleStatus({
        tone: "error",
        title: "Institute update failed",
        message,
      })
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
        submission.credentialType,
        submission.instituteName,
        submission.studentAddress,
        submission.fileName,
        submission.evidenceHash,
        submission.publicProofCid,
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
  const instituteFieldErrors = useMemo(
    () => getInstituteFieldErrors(newInstituteName, newInstituteShortCode),
    [newInstituteName, newInstituteShortCode]
  )
  const visibleInstituteFieldErrors = useMemo(
    () => ({
      name:
        instituteSubmitAttempted || touchedInstituteFields.name
          ? instituteFieldErrors.name
          : undefined,
      shortCode:
        instituteSubmitAttempted || touchedInstituteFields.shortCode
          ? instituteFieldErrors.shortCode
          : undefined,
    }),
    [instituteFieldErrors, instituteSubmitAttempted, touchedInstituteFields]
  )
  const instituteSummaryItems = useMemo(
    () =>
      [visibleInstituteFieldErrors.name, visibleInstituteFieldErrors.shortCode].filter(
        (message): message is string => Boolean(message)
      ),
    [visibleInstituteFieldErrors]
  )
  const selectedSubmissionIndex = selectedSubmission
    ? filteredPendingSubmissions.findIndex(
        (submission) => submission.id === selectedSubmission.id
      )
    : -1
  useEffect(() => {
    queueHotkeyStateRef.current = {
      submissions: filteredPendingSubmissions,
      selectedIndex: selectedSubmissionIndex,
      isEnabled: user?.role === "admin" || user?.role === "verifier",
    }
  }, [filteredPendingSubmissions, selectedSubmissionIndex, user?.role])

  const selectedDraft = selectedSubmission
    ? reviewDrafts[selectedSubmission.id] ?? {
        eduAmount: selectedSubmission.eduAmount?.toString() ?? "100",
        reviewNote: selectedSubmission.reviewNote ?? "",
        expiresAt: toDateTimeLocalValue(selectedSubmission.expiresAt),
      }
    : null

  useEffect(() => {
    if (!token || !selectedSubmission) {
      setSelectedEvidencePreviewUrl(null)
      return
    }

    const authToken = token
    const controller = new AbortController()
    let nextObjectUrl: string | null = null

    async function loadPreview() {
      try {
        const evidenceBlob = await fetchEvidenceBlob(authToken, selectedSubmission.id, {
          signal: controller.signal,
        })

        if (controller.signal.aborted) {
          return
        }

        nextObjectUrl = URL.createObjectURL(evidenceBlob)
        setSelectedEvidencePreviewUrl(nextObjectUrl)
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          return
        }

        setSelectedEvidencePreviewUrl(null)
      }
    }

    void loadPreview()

    return () => {
      controller.abort()

      if (nextObjectUrl) {
        URL.revokeObjectURL(nextObjectUrl)
      }
    }
  }, [selectedSubmission, token])
  const missingContracts = useMemo(() => {
    return getMissingContractLabels(platformHealth)
  }, [platformHealth])
  const blockchainActionDisabledReason = useMemo(
    () => getBlockchainActionBlockedReason(platformHealth),
    [platformHealth]
  )
  const blockchainActionsBlocked =
    (user?.role === "admin" || user?.role === "verifier") &&
    Boolean(blockchainActionDisabledReason)
  const chainRecoveryNeeded =
    user?.role === "admin" && blockchainActionsBlocked
  const recoveryBannerTone: "neutral" | "warning" = chainRecoveryNeeded
    ? "warning"
    : "neutral"
  const recoveryBannerTitle = !platformHealth
    ? "Platform health unavailable"
    : chainRecoveryNeeded
      ? "Chain recovery needed"
      : "Chain health confirmed"
  const recoveryBannerMessage = !platformHealth
    ? "Platform health details are temporarily unavailable. Start the local devnet if it is down. If the devnet was intentionally reset or a fresh chain is now active, rerun deploy:sync, restart the backend, clear MetaMask activity for the demo wallets, then use Reset Stale Mints before reminting."
    : chainRecoveryNeeded
      ? [
          platformHealth.services.blockchain.chainId !== null
            ? `Chain ${platformHealth.services.blockchain.chainId} is reachable`
            : "The backend cannot currently reach the configured RPC endpoint",
          missingContracts.length > 0
            ? `but the configured contract code is missing for ${missingContracts.join(", ")}.`
            : "but the configured deployment is not healthy yet.",
          "Start the persistent devnet if it is down. If this is a fresh-chain reset, rerun deploy:sync, restart the backend, clear MetaMask activity for the demo wallets, then run Reset Stale Mints before reminting.",
        ].join(" ")
      : `Chain ${platformHealth.services.blockchain.chainId ?? "unknown"} is responding and the configured contracts are deployed. Normal devnet restarts should preserve previously minted credentials. Only rerun deploy:sync and use Reset Stale Mints after an intentional devnet reset or when starting a fresh chain.`
  const configuredContracts = platformHealth
    ? [
        {
          label: "PoCT",
          address: platformHealth.contracts.poctAddress,
          deployed: platformHealth.contracts.poctDeployed,
        },
        {
          label: "EDU",
          address: platformHealth.contracts.eduAddress,
          deployed: platformHealth.contracts.eduDeployed,
        },
        {
          label: "Mint Controller",
          address: platformHealth.contracts.mintControllerAddress,
          deployed: platformHealth.contracts.mintControllerDeployed,
        },
      ]
    : []
  const configuredContractsHint = chainRecoveryNeeded
    ? "If these addresses do not match the latest deploy:sync output after a fresh-chain reset, restart the backend before using Reset Stale Mints."
    : "These are the contract addresses currently loaded by the backend for the active demo session."
  const canSelectPrevious = selectedSubmissionIndex > 0
  const canSelectNext =
    selectedSubmissionIndex >= 0 &&
    selectedSubmissionIndex < filteredPendingSubmissions.length - 1
  const selectedSubmissionQueueLabel =
    selectedSubmissionIndex >= 0
      ? `Focused item ${selectedSubmissionIndex + 1} of ${filteredPendingSubmissions.length}`
      : "No queue item selected"

  function selectSubmissionByOffset(offset: number) {
    if (selectedSubmissionIndex < 0) {
      return
    }

    const nextSubmission = filteredPendingSubmissions[selectedSubmissionIndex + offset]

    if (!nextSubmission) {
      return
    }

    setSelectedSubmissionId(nextSubmission.id)
  }

  async function confirmBlockchainActionReady(actionLabel: string) {
    try {
      const health = await fetchPlatformHealth()
      setPlatformHealth(health)

      const blockedReason = getBlockchainActionBlockedReason(health)

      if (!blockedReason || isBlockchainWriteReady(health)) {
        return true
      }

      setConsoleStatus({
        tone: "error",
        title: `${actionLabel} unavailable`,
        message: blockedReason,
      })
      return false
    } catch (error) {
      if (isAbortError(error)) {
        return false
      }

      setPlatformHealth(null)
      const message =
        error instanceof Error
          ? error.message
          : `Could not confirm blockchain health before ${actionLabel.toLowerCase()}.`

      setConsoleStatus({
        tone: "error",
        title: `${actionLabel} unavailable`,
        message,
      })
      return false
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const { submissions, selectedIndex, isEnabled } = queueHotkeyStateRef.current

      if (!isEnabled || selectedIndex < 0) {
        return
      }

      const target = event.target

      if (
        target instanceof HTMLElement &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return
      }

      if (event.key === "[") {
        event.preventDefault()
        const previousSubmission =
          selectedIndex > 0
            ? submissions[selectedIndex - 1]
            : null

        if (previousSubmission) {
          setSelectedSubmissionId(previousSubmission.id)
        }
      }

      if (event.key === "]") {
        event.preventDefault()
        const nextSubmission =
          selectedIndex < submissions.length - 1
            ? submissions[selectedIndex + 1]
            : null

        if (nextSubmission) {
          setSelectedSubmissionId(nextSubmission.id)
        }
      }
    }

    window.addEventListener("keydown", handleKeyDown)

    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])

  return (
    <PageLayout>
      <section className="mb-8 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="brand-chip mb-4">
            Reviewer Console
          </div>
          <h1 className="mb-3 text-4xl font-semibold text-white sm:text-5xl">
            Review submissions, mint credentials, and protect institute trust.
          </h1>
          <p className="text-[#a0a0a0]">
            This console is backed by MongoDB for workflow state, prepares public
            proof payloads, and relies on reviewer wallets to submit mint and
            revoke transactions on-chain.
          </p>
        </div>

        {user ? (
          <div className="flex flex-wrap items-center gap-3">
            <RoleBadge role={user.role} />
            <WalletBadge
              address={user.address}
              label={user.role === "admin" ? "Admin Session" : "Verifier Session"}
            />
          </div>
        ) : null}
      </section>

      {!isReady ? (
        <DashboardCard>
          <div className="py-12 text-center text-slate-300">
            Restoring your reviewer session...
          </div>
        </DashboardCard>
      ) : null}

      {isReady && !isAuthenticated ? (
        <DashboardCard>
          <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h2 className="mb-2 text-[2rem] font-semibold text-white">
                Reviewer wallet sign-in required
              </h2>
              <p className="max-w-2xl text-[#a0a0a0]">
                The reviewer console is protected by JWT session auth and wallet
                role checks. Connect an authorized admin or verifier wallet to continue.
              </p>
            </div>
            <button
              onClick={() => void connectAndSignIn()}
              disabled={isAuthenticating}
              className="brand-button-primary px-6 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
            >
              {authFlowState === "awaiting_signature"
                ? "Awaiting Signature..."
                : authFlowState === "connecting_wallet"
                  ? "Connecting Wallet..."
                  : authFlowState === "wallet_connected" ||
                      Boolean(connectedWalletAddress)
                    ? "Complete Reviewer Sign-In"
                    : "Connect Reviewer Wallet"}
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

      {isReady &&
      isAuthenticated &&
      user?.role !== "admin" &&
      user?.role !== "verifier" ? (
        <DashboardCard>
          <div className="py-12 text-center">
            <h2 className="mb-3 text-2xl font-semibold text-white">
              Access restricted
            </h2>
            <p className="mx-auto max-w-2xl text-slate-300">
              Your current wallet is signed in as a student account. Switch to the
              configured reviewer wallet to review pending credentials.
            </p>
          </div>
        </DashboardCard>
      ) : null}

      {isReady &&
      isAuthenticated &&
      (user?.role === "admin" || user?.role === "verifier") ? (
        <>
          <div className="mb-8 rounded-xl border border-emerald-500/20 bg-emerald-500/08 px-5 py-4 text-sm text-emerald-300">
            The reviewer flow stays simple: inspect private evidence, set the EDU
            reward, optionally add expiry, and submit the mint from your wallet.
            Public proof artifacts publish automatically after approval.
          </div>

          {user.role === "verifier" && blockchainActionsBlocked ? (
            <div className="mb-8">
              <StatusBanner
                tone="warning"
                title="Blockchain actions paused"
                message={blockchainActionDisabledReason ?? "Blockchain write actions are temporarily unavailable."}
              />
            </div>
          ) : null}

          {user.role === "admin" ? (
            <div className="mb-8 space-y-4">
              <StatusBanner
                tone={recoveryBannerTone}
                title={recoveryBannerTitle}
                message={recoveryBannerMessage}
                action={
                  <button
                    type="button"
                    onClick={() => void handleResetStaleMints()}
                    disabled={isResettingStaleMints}
                    className={`rounded-full px-4 py-2 text-xs font-semibold uppercase tracking-[0.16em] transition disabled:cursor-not-allowed disabled:opacity-60 ${
                      chainRecoveryNeeded
                        ? "border border-amber-400/30 bg-amber-400/10 text-amber-100 hover:bg-amber-400/15"
                        : "border border-white/15 bg-white/[0.06] text-white hover:bg-white/[0.1]"
                    }`}
                  >
                    {isResettingStaleMints ? "Resetting..." : "Reset Stale Mints"}
                  </button>
                }
              />

              {platformHealth ? (
                <div
                  className={`rounded-xl border px-5 py-4 ${
                    chainRecoveryNeeded
                      ? "border-amber-500/25 bg-amber-500/10"
                      : "border-white/[0.10] bg-white/[0.04]"
                  }`}
                >
                  <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#cbd5f5]">
                        Configured Contracts
                      </div>
                      <p className="mt-1 text-sm leading-6 text-[#c5cad7]">
                        {configuredContractsHint}
                      </p>
                    </div>
                    <div
                      className={`rounded-full border px-3 py-1 text-[11px] font-medium uppercase tracking-[0.12em] ${
                        chainRecoveryNeeded
                          ? "border-amber-400/30 bg-amber-400/10 text-amber-100"
                          : "border-white/10 bg-white/[0.05] text-[#d7dceb]"
                      }`}
                    >
                      Chain {platformHealth.services.blockchain.chainId ?? "unknown"}
                    </div>
                  </div>

                  <div className="space-y-3">
                    {configuredContracts.map((contract) => (
                      <div
                        key={contract.label}
                        className="rounded-lg border border-white/8 bg-black/10 px-4 py-3"
                      >
                        <div className="mb-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                          <div className="text-sm font-semibold text-white">{contract.label}</div>
                          <div
                            className={`rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                              contract.deployed
                                ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
                                : "border-amber-400/30 bg-amber-400/10 text-amber-100"
                            }`}
                          >
                            {contract.deployed ? "Code Found" : "Code Missing"}
                          </div>
                        </div>
                        <div className="break-all rounded-md bg-black/20 px-3 py-2 font-mono text-xs leading-6 text-[#dbe4ff]">
                          {contract.address}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </div>
          ) : null}

          {consoleStatus ? (
            <StatusBanner
              className="mb-8"
              tone={consoleStatus.tone}
              title={consoleStatus.title}
              message={consoleStatus.message}
            />
          ) : null}

          <div className="mb-10 grid grid-cols-1 gap-6 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              title="Pending Reviews"
              value={<span className="text-[#f0f0f0]">{pendingSubmissions.length}</span>}
              accentColor="yellow"
            />
            <MetricCard
              title="Minted Credentials"
              value={<span className="text-emerald-300">{mintedSubmissions.length}</span>}
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
                <span className="text-[#a5c0f8]">
                  {totalEduDistributed.toLocaleString()} EDU
                </span>
              }
              accentColor="blue"
            />
          </div>

          <div className="grid grid-cols-1 gap-8 xl:grid-cols-[1.3fr_0.7fr] xl:items-start">
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
                    placeholder="Search by credential title, type, institute, student wallet, file name, evidence hash, or proof CID"
                    className="w-full rounded-[18px] border border-white/[0.08] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-white placeholder:text-[#a0a0a0] focus:border-[#4f7ef5]/45 focus:outline-none"
                  />
                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                    <p className="text-xs text-slate-500">
                      Search updates live across title, institute, wallet, hashes, and file name.
                    </p>
                    {searchQuery.trim() ? (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs font-medium uppercase tracking-[0.16em] text-slate-200 transition hover:bg-white/10"
                      >
                        Clear Search
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="flex flex-col justify-end">
                  <div className="rounded-xl border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
                    Showing {filteredPendingSubmissions.length} of {pendingSubmissions.length} pending submissions
                  </div>
                </div>
              </div>

              <div className="mb-6 rounded-2xl border border-[#4f7ef5]/15 bg-[#4f7ef5]/08 p-4 text-sm text-[#a5c0f8]">
                Reviewer shortcuts stay active while the workspace is open. Use{" "}
                <span className="font-semibold text-white">[</span> and{" "}
                <span className="font-semibold text-white">]</span> to move between
                pending credentials without losing the preview context.
              </div>

              {isLoading ? (
                <div className="space-y-4">
                  <SkeletonBlock variant="card" lines={3} />
                  <SkeletonBlock variant="card" lines={3} />
                  <SkeletonBlock variant="card" lines={3} />
                </div>
              ) : pendingSubmissions.length === 0 ? (
                <EmptyStatePanel
                  eyebrow="Queue clear"
                  title="No pending credentials to review"
                  description="New student submissions will appear here automatically as soon as they enter the review queue."
                  icon={
                    <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25Z" />
                    </svg>
                  }
                />
              ) : filteredPendingSubmissions.length === 0 ? (
                <EmptyStatePanel
                  eyebrow="Search filter"
                  title="No queue matches that search"
                  description="Try a broader term or reset the filter to bring the active review queue back into view."
                  action={
                    <button
                      type="button"
                      onClick={() => setSearchQuery("")}
                      className="brand-button-secondary px-5 py-3 text-sm"
                    >
                      Clear Search
                    </button>
                  }
                />
              ) : (
                <div className="space-y-5">
                  {filteredPendingSubmissions.map((submission) => {
                    const draft = reviewDrafts[submission.id] ?? {
                      eduAmount: "100",
                      reviewNote: "",
                      expiresAt: toDateTimeLocalValue(submission.expiresAt),
                    }
                    const isProcessing = processingSubmissionId === submission.id
                    const isSelected = selectedSubmissionId === submission.id

                    return (
                      <div
                        key={submission.id}
                        className={`rounded-2xl border p-5 transition ${
                          isSelected
                            ? "border-[#4f7ef5]/35 bg-[#4f7ef5]/10 shadow-lg shadow-[#4f7ef5]/10"
                            : "border-white/10 bg-white/[0.03]"
                        }`}
                      >
                        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
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
                          <div className="rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-200">
                            Pending Review
                          </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 text-sm text-slate-300 md:grid-cols-2">
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                              Student
                            </div>
                            <div className="mt-2 font-mono text-[#a5c0f8]">
                              {truncateValue(submission.studentAddress, 12, 10)}
                            </div>
                          </div>
                          <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                            <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                              Evidence Hash
                            </div>
                            <div className="mt-2 font-mono text-[#a5c0f8]">
                              {truncateValue(submission.evidenceHash, 16, 12)}
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

                        <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[0.28fr_0.28fr_0.44fr]">
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
                                {
                                  const nextValue = event.target.value
                                  setReviewDrafts((currentDrafts) => ({
                                    ...currentDrafts,
                                    [submission.id]: {
                                      ...draft,
                                      eduAmount: nextValue,
                                    },
                                  }))
                                  setReviewFieldErrors((currentErrors) => ({
                                    ...currentErrors,
                                    [submission.id]: {
                                      ...currentErrors[submission.id],
                                      eduAmount: currentErrors[submission.id]?.eduAmount
                                        ? getEduAmountError(nextValue)
                                        : undefined,
                                    },
                                  }))
                                }
                              }
                              onBlur={() =>
                                setReviewFieldErrors((currentErrors) => ({
                                  ...currentErrors,
                                  [submission.id]: {
                                    ...currentErrors[submission.id],
                                    eduAmount: getEduAmountError(draft.eduAmount),
                                  },
                                }))
                              }
                              aria-invalid={Boolean(reviewFieldErrors[submission.id]?.eduAmount)}
                              aria-describedby={`eduAmountHint-${submission.id} eduAmountError-${submission.id}`}
                              className={`w-full rounded-[18px] border px-4 py-3 text-white focus:border-[#4f7ef5]/45 focus:outline-none ${
                                reviewFieldErrors[submission.id]?.eduAmount
                                  ? "border-rose-500/35 bg-rose-500/10"
                                  : "border-white/[0.08] bg-[rgba(255,255,255,0.04)]"
                              }`}
                            />
                            <p
                              id={`eduAmountHint-${submission.id}`}
                              className="mt-2 text-sm text-slate-400"
                            >
                              Set the EDU reward that should be minted together with
                              this approved credential.
                            </p>
                            {reviewFieldErrors[submission.id]?.eduAmount ? (
                              <p
                                id={`eduAmountError-${submission.id}`}
                                className="mt-2 text-sm text-rose-300"
                                role="alert"
                              >
                                {reviewFieldErrors[submission.id]?.eduAmount}
                              </p>
                            ) : null}
                          </div>

                          <div>
                            <label
                              htmlFor={`expiresAt-${submission.id}`}
                              className="mb-2 block text-sm font-medium text-slate-300"
                            >
                              Optional Expiry
                            </label>
                            <input
                              id={`expiresAt-${submission.id}`}
                              type="datetime-local"
                              value={draft.expiresAt}
                              onChange={(event) =>
                                setReviewDrafts((currentDrafts) => ({
                                  ...currentDrafts,
                                  [submission.id]: {
                                    ...draft,
                                    expiresAt: event.target.value,
                                  },
                                }))
                              }
                              className="w-full rounded-[18px] border border-white/[0.08] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-white focus:border-[#4f7ef5]/45 focus:outline-none"
                            />
                            <p className="mt-2 text-sm text-slate-400">
                              Leave blank for non-expiring credentials.
                            </p>
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
                              className="w-full rounded-[18px] border border-white/[0.08] bg-[rgba(255,255,255,0.04)] px-4 py-3 text-white placeholder:text-[#a0a0a0] focus:border-[#4f7ef5]/45 focus:outline-none"
                            />
                            <p className="mt-2 text-sm text-slate-400">
                              Optional for approvals. Recommended for rejections so
                              the student knows how to improve the submission.
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-3">
                          <button
                            type="button"
                            onClick={() => setSelectedSubmissionId(submission.id)}
                            className="rounded-full border border-[#4f7ef5]/20 bg-[#4f7ef5]/08 px-4 py-2 text-sm font-medium text-[#a0a0a0] transition hover:bg-[#4f7ef5]/16"
                          >
                            {isSelected ? "Previewing" : "Review Workspace"}
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleOpenEvidence(submission)}
                            className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                          >
                            Open Private Evidence
                          </button>
                          <button
                            type="button"
                            onClick={() => void handleAnalyse(submission)}
                            disabled={aiStates[submission.id]?.status === "loading"}
                            className="flex items-center gap-2 rounded-lg border border-[#4f7ef5]/25 bg-[#4f7ef5]/08 px-4 py-2 text-sm font-medium text-[#a5c0f8] transition hover:bg-[#4f7ef5]/14 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {aiStates[submission.id]?.status === "loading" ? (
                              <>
                                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                Analysing...
                              </>
                            ) : (
                              <>
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09ZM18.259 8.715 18 9.75l-.259-1.035a3.375 3.375 0 0 0-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 0 0 2.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 0 0 2.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 0 0-2.456 2.456Z" />
                                </svg>
                                Analyse with AI
                              </>
                            )}
                          </button>
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
                            disabled={isProcessing || blockchainActionsBlocked}
                            title={blockchainActionDisabledReason ?? undefined}
                            className="brand-button-primary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {isProcessing ? "Processing..." : "Prepare & Mint"}
                          </button>
                        </div>

                        {/* AI Insight Panel */}
                        {aiStates[submission.id]?.status === "error" ? (
                          <div className="mt-4">
                            <StatusBanner
                              compact
                              tone="warning"
                              title="AI Analysis Failed"
                              message={(aiStates[submission.id] as { status: "error"; message: string }).message}
                            />
                          </div>
                        ) : aiStates[submission.id]?.status === "done" ? (
                          <AiInsightPanel
                            insight={(aiStates[submission.id] as { status: "done"; insight: AiInsight }).insight}
                            onUseSuggestion={(amount) =>
                              setReviewDrafts((d) => ({
                                ...d,
                                [submission.id]: {
                                  ...(d[submission.id] ?? { eduAmount: "100", reviewNote: "", expiresAt: "" }),
                                  eduAmount: String(amount),
                                },
                              }))
                            }
                          />
                        ) : null}
                      </div>
                    )
                  })}
                </div>
              )}
            </DashboardCard>

            <div className="space-y-8 xl:sticky xl:top-28 xl:self-start">
              <DashboardCard title="Review Workspace">
                {selectedSubmission ? (
                  <div className="space-y-5">
                    <div className="rounded-2xl border border-white/[0.08] bg-[#4f7ef5]/08 p-4">
                      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="text-xs uppercase tracking-[0.3em] text-[#a0a0a0]">
                            Active Review Focus
                          </div>
                          <h3 className="mt-2 text-xl font-semibold text-white [overflow-wrap:anywhere]">
                            {selectedSubmission.courseName}
                          </h3>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <p className="text-slate-300">
                              {selectedSubmission.instituteName}
                            </p>
                            <div className="rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-200">
                              {formatCredentialTypeLabel(selectedSubmission.credentialType)}
                            </div>
                          </div>
                        </div>

                        <div className="rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs uppercase tracking-[0.2em] text-slate-200">
                          {selectedSubmissionQueueLabel}
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => selectSubmissionByOffset(-1)}
                          disabled={!canSelectPrevious}
                          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Previous [
                        </button>
                        <button
                          type="button"
                          onClick={() => selectSubmissionByOffset(1)}
                          disabled={!canSelectNext}
                          className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Next ]
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleOpenEvidence(selectedSubmission)}
                          className="rounded-full border border-[#4f7ef5]/20 bg-[#4f7ef5]/08 px-4 py-2 text-sm font-medium text-[#a5c0f8] transition hover:bg-[#4f7ef5]/14"
                        >
                          Open Private Evidence
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-white/10 bg-black/20 p-4">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                          Student
                        </div>
                        <div className="mt-2 font-mono text-sm text-[#a5c0f8]">
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
                      {selectedEvidencePreviewUrl &&
                      selectedSubmission.mimeType === "application/pdf" ? (
                        <iframe
                          src={selectedEvidencePreviewUrl}
                          title={`${selectedSubmission.courseName} preview`}
                          className="h-[420px] w-full rounded-xl bg-slate-950"
                        />
                      ) : selectedEvidencePreviewUrl &&
                        selectedSubmission.mimeType.startsWith("image/") ? (
                        <div className="relative h-[420px] overflow-hidden rounded-xl bg-slate-950">
                          <Image
                            src={selectedEvidencePreviewUrl}
                            alt={selectedSubmission.courseName}
                            fill
                            unoptimized
                            className="object-contain"
                          />
                        </div>
                      ) : (
                        <div className="flex h-[420px] items-center justify-center rounded-xl bg-slate-950 text-center text-slate-400">
                          Preview is not available for this file type right now. Use
                          the private evidence button above to inspect or download the
                          encrypted evidence file.
                        </div>
                      )}
                    </div>

                    <div className="rounded-2xl border border-[#4f7ef5]/15 bg-[#4f7ef5]/06 p-4">
                      <div className="mb-3 text-xs uppercase tracking-[0.24em] text-[#a5c0f8]">
                        Decision Snapshot
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            EDU Reward Draft
                          </div>
                          <div className="mt-2 text-white">
                            {selectedDraft?.eduAmount?.trim()
                              ? `${selectedDraft.eduAmount} EDU`
                              : "Not set"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            Reviewer Note
                          </div>
                          <div className="mt-2 text-white">
                            {selectedDraft?.reviewNote.trim()
                              ? "Ready to attach with the decision"
                              : "Optional for approval, recommended for rejection"}
                          </div>
                        </div>
                        <div className="rounded-xl border border-white/10 bg-black/20 p-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            Expiry
                          </div>
                          <div className="mt-2 text-white">
                            {selectedDraft?.expiresAt
                              ? formatDateTime(
                                  new Date(selectedDraft.expiresAt).toISOString()
                                )
                              : "No expiry set"}
                          </div>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap gap-3">
                        <button
                          type="button"
                          onClick={() => void handleReject(selectedSubmission)}
                          disabled={processingSubmissionId === selectedSubmission.id}
                          className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2 text-sm font-medium text-rose-200 transition hover:bg-rose-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {processingSubmissionId === selectedSubmission.id
                            ? "Processing..."
                            : "Reject From Workspace"}
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleApprove(selectedSubmission)}
                          disabled={
                            processingSubmissionId === selectedSubmission.id ||
                            blockchainActionsBlocked
                          }
                          title={blockchainActionDisabledReason ?? undefined}
                          className="brand-button-primary px-4 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {processingSubmissionId === selectedSubmission.id
                            ? "Processing..."
                            : "Prepare & Mint From Workspace"}
                        </button>
                      </div>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-sm text-slate-300">
                      <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                        Review Notes
                      </div>
                      <p>
                        Use the queue card on the left to assign the EDU reward, set
                        optional expiry, add a reviewer note, and approve or reject
                        while keeping the private evidence preview open here.
                      </p>
                    </div>

                    <div>
                      <div className="mb-3 text-xs uppercase tracking-[0.3em] text-[#a0a0a0]">
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
                  <EmptyStatePanel
                    eyebrow="Workspace idle"
                    title="Select a pending credential"
                    description="Choose a queue item to open the reviewer workspace, inspect the evidence preview, and take the mint or reject action."
                    action={
                      filteredPendingSubmissions.length > 0 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setSelectedSubmissionId(filteredPendingSubmissions[0]?.id ?? null)
                          }
                          className="brand-button-secondary px-5 py-3 text-sm"
                        >
                          Open First Queue Item
                        </button>
                      ) : undefined
                    }
                  />
                )}
              </DashboardCard>

              {user?.role === "admin" ? (
              <DashboardCard title="Institute Management">
                <form onSubmit={handleCreateInstitute} className="space-y-4">
                  {instituteSubmitAttempted && instituteSummaryItems.length > 0 ? (
                    <div className="brand-form-summary" role="alert">
                      <div className="brand-form-summary-title">Check The Form</div>
                      <ul className="brand-form-summary-list">
                        {instituteSummaryItems.map((message) => (
                          <li key={message}>{message}</li>
                        ))}
                      </ul>
                    </div>
                  ) : null}

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
                      onBlur={() =>
                        setTouchedInstituteFields((current) => ({
                          ...current,
                          name: true,
                        }))
                      }
                      placeholder="International Institute of Technology"
                      className={`w-full rounded-[18px] border px-4 py-3 text-white focus:border-[#4f7ef5]/45 focus:outline-none ${
                        visibleInstituteFieldErrors.name
                          ? "border-rose-500/35 bg-rose-500/10"
                          : "border-white/[0.08] bg-[rgba(255,255,255,0.04)]"
                      }`}
                      aria-invalid={Boolean(visibleInstituteFieldErrors.name)}
                      aria-describedby="newInstituteNameHint newInstituteNameError"
                    />
                    <p id="newInstituteNameHint" className="mt-2 text-sm text-slate-400">
                      Use the full public name that should appear in uploads,
                      dashboards, and institute profile pages.
                    </p>
                    {visibleInstituteFieldErrors.name ? (
                      <p
                        id="newInstituteNameError"
                        className="mt-2 text-sm text-rose-300"
                        role="alert"
                      >
                        {visibleInstituteFieldErrors.name}
                      </p>
                    ) : null}
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
                      onBlur={() =>
                        setTouchedInstituteFields((current) => ({
                          ...current,
                          shortCode: true,
                        }))
                      }
                      placeholder="IITX"
                      className={`w-full rounded-[18px] border px-4 py-3 text-white focus:border-[#4f7ef5]/45 focus:outline-none ${
                        visibleInstituteFieldErrors.shortCode
                          ? "border-rose-500/35 bg-rose-500/10"
                          : "border-white/[0.08] bg-[rgba(255,255,255,0.04)]"
                      }`}
                      aria-invalid={Boolean(visibleInstituteFieldErrors.shortCode)}
                      aria-describedby="newInstituteShortCodeHint newInstituteShortCodeError"
                    />
                    <p
                      id="newInstituteShortCodeHint"
                      className="mt-2 text-sm text-slate-400"
                    >
                      Keep it short and memorable. It is used in chips, search, and
                      the institute index.
                    </p>
                    {visibleInstituteFieldErrors.shortCode ? (
                      <p
                        id="newInstituteShortCodeError"
                        className="mt-2 text-sm text-rose-300"
                        role="alert"
                      >
                        {visibleInstituteFieldErrors.shortCode}
                      </p>
                    ) : null}
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
              ) : null}

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
                            <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-slate-400">
                              <span>{submission.instituteName}</span>
                              <span className="rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-amber-200">
                                {formatCredentialTypeLabel(submission.credentialType)}
                              </span>
                            </div>
                          </div>
                          <div
                            className={`rounded-full px-3 py-1 text-xs font-medium ${
                              submission.status === "minted"
                                ? submission.verificationStatus === "revoked"
                                  ? "border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200"
                                  : "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                                : "border border-rose-500/30 bg-rose-500/10 text-rose-200"
                            }`}
                          >
                            {submission.status === "minted"
                              ? submission.verificationStatus === "revoked"
                                ? "Revoked"
                                : "Minted"
                              : "Rejected"}
                          </div>
                        </div>

                        <div className="mt-3 text-sm text-slate-300">
                          {submission.status === "minted" ? (
                            <>
                              Token #{submission.tokenId} {submission.verificationStatus === "revoked"
                                ? "was revoked"
                                : "minted"} on{" "}
                              {formatDateTime(submission.revokedAt ?? submission.mintedAt)}
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

                        <div className="mt-3 flex flex-wrap gap-3">
                          {submission.tokenId ? (
                            <a
                              href={`/verify?tokenId=${submission.tokenId}`}
                              className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white transition hover:bg-white/10"
                            >
                              Open Proof Sheet
                            </a>
                          ) : null}
                          {submission.status === "minted" &&
                          submission.verificationStatus !== "revoked" ? (
                            <button
                              type="button"
                              onClick={() => void handleRevoke(submission)}
                              disabled={
                                processingSubmissionId === submission.id ||
                                blockchainActionsBlocked
                              }
                              title={blockchainActionDisabledReason ?? undefined}
                              className="rounded-lg border border-fuchsia-500/30 bg-fuchsia-500/10 px-4 py-2 text-sm font-medium text-fuchsia-200 transition hover:bg-fuchsia-500/20 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {processingSubmissionId === submission.id
                                ? "Processing..."
                                : "Revoke Credential"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </DashboardCard>
            </div>
          </div>
        </>
      ) : null}
      <DestructiveActionModal
        open={confirmModal !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmModal(null)
        }}
        action={confirmModal?.action ?? "reject"}
        submission={confirmModal?.submission ?? null}
        isProcessing={
          confirmModal !== null &&
          processingSubmissionId === confirmModal.submission.id
        }
        onConfirm={(reason) => {
          if (!confirmModal) return
          if (confirmModal.action === "reject") {
            void executeReject(confirmModal.submission)
          } else {
            void executeRevoke(confirmModal.submission, reason)
          }
        }}
      />
    </PageLayout>
  )
}
