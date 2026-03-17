"use client"

import { Suspense, type FormEvent, useEffect, useMemo, useState } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { toast } from "sonner"
import { AuditTrailList } from "@/components/AuditTrailList"
import { CredentialShareCard } from "@/components/CredentialShareCard"
import { DashboardCard } from "@/components/DashboardCard"
import { PageLayout } from "@/components/PageLayout"
import { fetchVerificationRecord, isAbortError } from "@/lib/api"
import { buildAppUrl } from "@/lib/config"
import { formatDateTime, truncateValue } from "@/lib/formatting"
import {
  buildCredentialShareCaption,
  buildCredentialShareCardSvg,
  downloadSvgFile,
} from "@/lib/share-card"
import type { VerificationRecord } from "@/lib/types"

function sanitizeDownloadName(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized || "credential"
}

function downloadTextFile(filename: string, contents: string, type: string) {
  const blob = new Blob([contents], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

function VerifyPageContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const tokenIdFromQuery = searchParams.get("tokenId") ?? ""

  const [searchTokenId, setSearchTokenId] = useState(tokenIdFromQuery)
  const [record, setRecord] = useState<VerificationRecord | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [hasAttemptedLookup, setHasAttemptedLookup] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    setSearchTokenId(tokenIdFromQuery)

    if (!tokenIdFromQuery) {
      setRecord(null)
      setHasAttemptedLookup(false)
      setErrorMessage(null)
      return
    }

    const controller = new AbortController()

    async function loadVerificationRecord() {
      try {
        setIsLoading(true)
        setErrorMessage(null)
        setHasAttemptedLookup(true)
        const response = await fetchVerificationRecord(tokenIdFromQuery, controller.signal)

        if (controller.signal.aborted) {
          return
        }

        setRecord(response.record)
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          return
        }

        const message =
          error instanceof Error ? error.message : "Could not verify certificate"
        setRecord(null)
        setErrorMessage(message)
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadVerificationRecord()

    return () => controller.abort()
  }, [tokenIdFromQuery])

  useEffect(() => {
    const previousTitle = document.title

    document.title = record
      ? `DACS Verify #${record.tokenId}`
      : "DACS Verification"

    return () => {
      document.title = previousTitle
    }
  }, [record])

  async function handleCopyShareUrl(shareUrl: string) {
    try {
      await navigator.clipboard.writeText(shareUrl)
      toast.success("Verification link copied to clipboard.")
    } catch {
      toast.error("Could not copy the verification link.")
    }
  }

  async function handleCopyShareCaption() {
    if (!record || !shareUrl) {
      return
    }

    try {
      await navigator.clipboard.writeText(buildCredentialShareCaption(record, shareUrl))
      toast.success("Credential share caption copied.")
    } catch {
      toast.error("Could not copy the share caption.")
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const trimmedTokenId = searchTokenId.trim()

    if (!trimmedTokenId) {
      setErrorMessage("Enter a token ID to verify a credential.")
      return
    }

    router.replace(`/verify?tokenId=${encodeURIComponent(trimmedTokenId)}`)
  }

  function handlePrintCredential() {
    window.print()
  }

  const shareUrl = useMemo(() => {
    if (!record) {
      return null
    }

    return buildAppUrl(`/verify?tokenId=${record.tokenId}`)
  }, [record])
  const fileSlug = useMemo(() => {
    if (!record) {
      return "credential"
    }

    return sanitizeDownloadName(`${record.courseName}-${record.instituteName}`)
  }, [record])
  const proofBundle = useMemo(() => {
    if (!record) {
      return null
    }

    return {
      generatedAt: new Date().toISOString(),
      source: "DACS Verification Portal",
      shareUrl: shareUrl ?? buildAppUrl(`/verify?tokenId=${record.tokenId}`),
      record: {
        tokenId: record.tokenId,
        courseName: record.courseName,
        instituteName: record.instituteName,
        studentAddress: record.studentAddress,
        verifierAddress: record.verifierAddress,
        issuedAt: record.issuedAt,
        eduAmount: record.eduAmount,
        cid: record.cid,
        txHash: record.txHash,
        ipfsUrl: record.ipfsUrl,
        fileName: record.fileName,
        mimeType: record.mimeType,
        reviewNote: record.reviewNote,
      },
      proof: record.proof,
      auditTrail: record.auditTrail,
      standards: record.standards,
    }
  }, [record, shareUrl])
  const verificationMemo = useMemo(() => {
    if (!record) {
      return null
    }

    const lines = [
      "DACS Verification Memo",
      `Generated: ${new Date().toISOString()}`,
      `Share URL: ${shareUrl ?? buildAppUrl(`/verify?tokenId=${record.tokenId}`)}`,
      "",
      `Course: ${record.courseName}`,
      `Institute: ${record.instituteName}`,
      `Token ID: ${record.tokenId}`,
      `Issued At: ${formatDateTime(record.issuedAt)}`,
      `Student Wallet: ${record.studentAddress}`,
      `Verifier Wallet: ${record.verifierAddress}`,
      `EDU Reward: ${
        record.eduAmount !== null ? `${record.eduAmount.toLocaleString()} EDU` : "Not available"
      }`,
      `Evidence File: ${record.fileName ?? "Not available"}`,
      `Evidence Format: ${record.mimeType ?? "Not available"}`,
      `IPFS CID: ${record.cid}`,
      `IPFS URL: ${record.ipfsUrl}`,
      `Mint Transaction: ${record.txHash ?? "Not available"}`,
      "",
      `Chain ID: ${record.proof.chainId}`,
      `PoCT Contract: ${record.proof.poctAddress}`,
      `Mint Controller: ${record.proof.mintControllerAddress}`,
      `EDU Contract: ${record.proof.eduAddress}`,
      `Soulbound Enforcement: ${record.proof.soulbound ? "Active" : "Inactive"}`,
      "",
      "Audit Trail:",
      ...record.auditTrail.map((event) =>
        `- ${formatDateTime(event.createdAt)} | ${event.title}${
          event.description ? ` | ${event.description}` : ""
        }${event.actorAddress ? ` | actor=${event.actorAddress}` : ""}`
      ),
    ]

    return lines.join("\n")
  }, [record, shareUrl])

  function handleDownloadProofBundle() {
    if (!proofBundle || !record) {
      return
    }

    downloadTextFile(
      `dacs-proof-bundle-token-${record.tokenId}-${fileSlug}.json`,
      JSON.stringify(proofBundle, null, 2),
      "application/json"
    )
    toast.success("Downloaded the DACS proof bundle.")
  }

  function handleDownloadVerificationMemo() {
    if (!verificationMemo || !record) {
      return
    }

    downloadTextFile(
      `dacs-verification-memo-token-${record.tokenId}-${fileSlug}.txt`,
      verificationMemo,
      "text/plain"
    )
    toast.success("Downloaded the verification memo.")
  }

  function handleDownloadVerifiableCredential() {
    if (!record) {
      return
    }

    downloadTextFile(
      `dacs-vc-token-${record.tokenId}-${fileSlug}.json`,
      JSON.stringify(record.standards.verifiableCredential, null, 2),
      "application/ld+json"
    )
    toast.success("Downloaded the VC export.")
  }

  function handleDownloadOpenBadgeCredential() {
    if (!record) {
      return
    }

    downloadTextFile(
      `dacs-open-badge-token-${record.tokenId}-${fileSlug}.json`,
      JSON.stringify(record.standards.openBadgeCredential, null, 2),
      "application/ld+json"
    )
    toast.success("Downloaded the Open Badge export.")
  }

  function handleDownloadShareCard() {
    if (!record || !shareUrl) {
      return
    }

    downloadSvgFile(
      `dacs-share-card-token-${record.tokenId}-${fileSlug}`,
      buildCredentialShareCardSvg(record, shareUrl)
    )
    toast.success("Downloaded the credential share card.")
  }

  return (
    <PageLayout>
      <section className="print-hidden mx-auto mb-10 max-w-4xl text-center">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-200">
          Public Credential Verification
        </div>
        <h1 className="mb-3 text-3xl font-bold text-white sm:text-4xl">
          Verify any minted credential by token ID.
        </h1>
        <p className="text-slate-300">
          DACS reads the ownership and certificate record from the blockchain, then
          joins the on-chain token with its off-chain course and institute metadata.
        </p>
      </section>

      <div className="print-hidden mx-auto mb-10 max-w-3xl">
        <DashboardCard>
          <form onSubmit={handleSubmit} className="space-y-4">
            <label
              htmlFor="tokenId"
              className="block text-left text-sm font-medium text-slate-300"
            >
              Token ID
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
              <input
                id="tokenId"
                type="text"
                value={searchTokenId}
                onChange={(event) => setSearchTokenId(event.target.value)}
                placeholder="Enter token ID, for example 1"
                className="flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-4 font-mono text-white placeholder:text-slate-500 focus:border-emerald-400/50 focus:outline-none"
              />
              <button
                type="submit"
                disabled={isLoading || !searchTokenId.trim()}
                className="rounded-xl bg-linear-to-r from-emerald-500 to-cyan-600 px-6 py-4 font-semibold text-white transition hover:from-emerald-400 hover:to-cyan-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isLoading ? "Verifying..." : "Verify Record"}
              </button>
            </div>
          </form>
        </DashboardCard>
      </div>

      {isLoading ? (
        <div className="print-hidden mx-auto max-w-4xl">
          <DashboardCard>
            <div className="py-12 text-center text-slate-300">
              Reading blockchain credential data...
            </div>
          </DashboardCard>
        </div>
      ) : null}

      {!isLoading && record ? (
        <div className="mx-auto grid max-w-6xl grid-cols-1 gap-8 xl:grid-cols-[1.35fr_0.65fr] print:block">
          <DashboardCard className="print-credential-sheet overflow-hidden print:rounded-none">
            <div className="print-panel relative overflow-hidden rounded-[28px] border border-emerald-500/20 bg-linear-to-br from-emerald-500/10 via-cyan-500/10 to-transparent p-8 print:rounded-none">
              <div className="print-hidden absolute -right-12 top-6 h-40 w-40 rounded-full bg-emerald-400/10 blur-3xl" />
              <div className="print-hidden absolute bottom-0 left-1/3 h-32 w-32 rounded-full bg-cyan-400/10 blur-3xl" />

              <div className="relative flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.25em] text-emerald-200 print-accent-text">
                    Verified Academic Credential
                  </div>
                  <div className="text-xs uppercase tracking-[0.32em] text-slate-500 print-accent-text">
                    DACS Proof Of Completion
                  </div>
                  <h2 className="mt-4 text-3xl font-semibold text-white print-on-light sm:text-4xl">
                    {record.courseName}
                  </h2>
                  <p className="mt-3 text-lg text-slate-300 print-subtle-text">
                    Issued under {record.instituteName}
                  </p>
                  <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-300 print-subtle-text sm:text-base">
                    This credential confirms that the holder of the mapped wallet owns
                    a verified academic completion record anchored on-chain through the
                    DACS platform, with evidence preserved on IPFS and issuance
                    validated by the configured verifier authority.
                  </p>

                  <div className="mt-6 flex flex-wrap gap-2">
                    {[
                      "On-chain verified",
                      record.proof.soulbound ? "Soulbound credential" : "Transferable credential",
                      "IPFS evidence attached",
                    ].map((label) => (
                      <div
                        key={label}
                        className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs uppercase tracking-[0.18em] text-slate-200 print-panel print-subtle-text"
                      >
                        {label}
                      </div>
                    ))}
                  </div>
                </div>

                <div className="print-panel rounded-3xl border border-white/10 bg-black/20 p-5 lg:max-w-[250px]">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Token Reference
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-white print-on-light">
                    #{record.tokenId}
                  </div>
                  <div className="mt-5 rounded-2xl bg-white p-3">
                    <QRCodeSVG value={shareUrl ?? buildAppUrl("/verify")} size={138} />
                  </div>
                  <p className="mt-4 text-sm text-slate-300 print-subtle-text">
                    Scan this QR code to reopen the same public verification sheet.
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="print-panel rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Student Wallet
                </div>
                <div className="mt-2 font-mono text-cyan-200 print-mono-text">
                  {record.studentAddress}
                </div>
              </div>
              <div className="print-panel rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Verifier Wallet
                </div>
                <div className="mt-2 font-mono text-fuchsia-200 print-mono-text">
                  {record.verifierAddress}
                </div>
              </div>
              <div className="print-panel rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Issued At
                </div>
                <div className="mt-2 text-white print-on-light">
                  {formatDateTime(record.issuedAt)}
                </div>
              </div>
              <div className="print-panel rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  EDU Reward
                </div>
                <div className="mt-2 text-white print-on-light">
                  {record.eduAmount !== null
                    ? `${record.eduAmount.toLocaleString()} EDU`
                    : "Not available"}
                </div>
              </div>
              <div className="print-panel rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Evidence File
                </div>
                <div className="mt-2 text-white print-on-light">
                  {record.fileName ?? "Not available"}
                </div>
              </div>
              <div className="print-panel rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                  Evidence Format
                </div>
                <div className="mt-2 text-white print-on-light">
                  {record.mimeType ?? "Not available"}
                </div>
              </div>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="print-panel rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="mb-3 text-xs uppercase tracking-[0.24em] text-slate-500">
                  Evidence Anchors
                </div>
                <div className="space-y-4 text-sm text-slate-300">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      IPFS CID
                    </div>
                    <div className="mt-2 break-all font-mono text-cyan-200 print-mono-text">
                      {record.cid}
                    </div>
                  </div>
                  {record.txHash ? (
                    <div>
                      <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                        Mint Transaction Hash
                      </div>
                      <div className="mt-2 break-all font-mono text-slate-200 print-mono-text">
                        {record.txHash}
                      </div>
                    </div>
                  ) : null}
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Verification URL
                    </div>
                    <div className="mt-2 break-all font-mono text-slate-200 print-mono-text">
                      {shareUrl}
                    </div>
                  </div>
                </div>
              </div>

              <div className="print-panel rounded-2xl border border-white/10 bg-black/20 p-5">
                <div className="mb-3 text-xs uppercase tracking-[0.24em] text-slate-500">
                  Trust Summary
                </div>
                <div className="space-y-3 text-sm text-slate-300">
                  <p className="print-subtle-text">
                    The credential details above were resolved from the live PoCT
                    contract and joined with workflow metadata captured during the
                    institutional review lifecycle.
                  </p>
                  <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-emerald-100 print-panel">
                    Chain {record.proof.chainId} • Mint authority confirmed •{" "}
                    {record.proof.soulbound ? "Non-transferable" : "Transferable"}
                  </div>
                </div>
              </div>
            </div>

            {record.reviewNote ? (
              <div className="print-panel mt-6 rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-300">
                <div className="mb-2 text-xs uppercase tracking-[0.2em] text-slate-500">
                  Reviewer Note
                </div>
                <p>{record.reviewNote}</p>
              </div>
            ) : null}

            <div className="mt-6 print-page-break-avoid">
              <div className="mb-3 text-xs uppercase tracking-[0.3em] text-emerald-300 print-accent-text">
                Lifecycle Evidence
              </div>
              <AuditTrailList
                events={record.auditTrail}
                emptyMessage="No stored lifecycle events are available for this credential."
              />
            </div>

            <div className="print-hidden mt-6 flex flex-wrap gap-3">
              <a
                href={record.ipfsUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Open IPFS Evidence
              </a>
              <button
                type="button"
                onClick={handlePrintCredential}
                className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-medium text-emerald-200 transition hover:bg-emerald-500/20"
              >
                Print Credential Sheet
              </button>
              <button
                type="button"
                onClick={handleDownloadProofBundle}
                className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20"
              >
                Download Proof JSON
              </button>
              <button
                type="button"
                onClick={handleDownloadVerifiableCredential}
                className="rounded-xl border border-[#b8892d]/25 bg-[#b8892d]/10 px-4 py-3 text-sm font-medium text-[#f3d9a2] transition hover:bg-[#b8892d]/18"
              >
                Download VC JSON-LD
              </button>
              <button
                type="button"
                onClick={handleDownloadOpenBadgeCredential}
                className="rounded-xl border border-[#0f766e]/30 bg-[#0f766e]/10 px-4 py-3 text-sm font-medium text-[#c9f0e7] transition hover:bg-[#0f766e]/18"
              >
                Download Open Badge JSON-LD
              </button>
              <button
                type="button"
                onClick={handleDownloadVerificationMemo}
                className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
              >
                Download Verification Memo
              </button>
            </div>
          </DashboardCard>

          <div className="print-hidden space-y-6">
            <DashboardCard title="Export & Share">
              <div className="space-y-5">
                {shareUrl ? (
                  <CredentialShareCard record={record} shareUrl={shareUrl} />
                ) : (
                  <div className="rounded-3xl bg-white p-4">
                    <QRCodeSVG value={buildAppUrl("/verify")} size={220} />
                  </div>
                )}
                <p className="text-sm text-slate-300">
                  Share this card in demos, reports, or reviewer handoffs to show the
                  credential as a polished public artifact.
                </p>
                <div className="rounded-2xl border border-[#b8892d]/20 bg-[#b8892d]/10 p-4 text-sm text-[#f3d9a2]">
                  These VC and Open Badge exports are generated automatically from
                  the minted credential record. Admin reviewers do not need to
                  create or manage them separately.
                </div>
                <div className="w-full rounded-2xl border border-white/10 bg-black/20 p-4 text-left">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Share URL
                  </div>
                  <div className="mt-2 break-all font-mono text-sm text-cyan-200">
                    {shareUrl}
                  </div>
                </div>
                <div className="grid w-full grid-cols-1 gap-3">
                  <button
                    type="button"
                    onClick={() => void handleCopyShareUrl(shareUrl ?? buildAppUrl("/verify"))}
                    className="rounded-xl border border-white/10 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    Copy Verification Link
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleCopyShareCaption()}
                    className="rounded-xl border border-[#b8892d]/25 bg-[#b8892d]/10 px-4 py-3 text-sm font-medium text-[#f3d9a2] transition hover:bg-[#b8892d]/18"
                  >
                    Copy Share Caption
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadShareCard}
                    className="rounded-xl border border-[#0f766e]/30 bg-[#0f766e]/10 px-4 py-3 text-sm font-medium text-[#c9f0e7] transition hover:bg-[#0f766e]/18"
                  >
                    Download SVG Share Card
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadProofBundle}
                    className="rounded-xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-medium text-cyan-200 transition hover:bg-cyan-500/20"
                  >
                    Download Proof Bundle
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadVerifiableCredential}
                    className="rounded-xl border border-[#b8892d]/25 bg-[#b8892d]/10 px-4 py-3 text-sm font-medium text-[#f3d9a2] transition hover:bg-[#b8892d]/18"
                  >
                    Download VC JSON-LD
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadOpenBadgeCredential}
                    className="rounded-xl border border-[#0f766e]/30 bg-[#0f766e]/10 px-4 py-3 text-sm font-medium text-[#c9f0e7] transition hover:bg-[#0f766e]/18"
                  >
                    Download Open Badge JSON-LD
                  </button>
                  <button
                    type="button"
                    onClick={handleDownloadVerificationMemo}
                    className="rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white transition hover:bg-white/10"
                  >
                    Download Reviewer Memo
                  </button>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4 text-left text-sm text-slate-300">
                  <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                    Standards Note
                  </div>
                  <p className="mt-2">{record.standards.note}</p>
                </div>
              </div>
            </DashboardCard>

            <DashboardCard title="Trust Signals">
              <div className="space-y-4">
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                  <div className="text-xs uppercase tracking-[0.2em] text-emerald-200">
                    Verification Status
                  </div>
                  <div className="mt-2 text-lg font-semibold text-white">
                    Immutable credential confirmed
                  </div>
                  <p className="mt-2 text-sm text-emerald-100/80">
                    This record matches a live on-chain PoCT certificate and is
                    configured as soulbound evidence for academic ownership.
                  </p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Chain ID
                    </div>
                    <div className="mt-2 text-white">{record.proof.chainId}</div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      PoCT Contract
                    </div>
                    <div className="mt-2 font-mono text-sm text-cyan-200">
                      {truncateValue(record.proof.poctAddress, 12, 10)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Mint Controller
                    </div>
                    <div className="mt-2 font-mono text-sm text-fuchsia-200">
                      {truncateValue(record.proof.mintControllerAddress, 12, 10)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      EDU Contract
                    </div>
                    <div className="mt-2 font-mono text-sm text-yellow-200">
                      {truncateValue(record.proof.eduAddress, 12, 10)}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">
                      Transferability
                    </div>
                    <div className="mt-2 text-white">
                      {record.proof.soulbound ? "Soulbound-like enforcement active" : "Transferable"}
                    </div>
                  </div>
                </div>
              </div>
            </DashboardCard>
          </div>
        </div>
      ) : null}

      {!isLoading && hasAttemptedLookup && !record ? (
        <div className="print-hidden mx-auto max-w-3xl">
          <DashboardCard>
            <div className="py-10 text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-rose-500/30 bg-rose-500/10 text-rose-300">
                <svg
                  className="h-8 w-8"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </div>
              <h2 className="mb-2 text-2xl font-semibold text-white">
                Verification failed
              </h2>
              <p className="mx-auto max-w-xl text-slate-300">
                {errorMessage ??
                  "No blockchain credential record was found for that token ID."}
              </p>
            </div>
          </DashboardCard>
        </div>
      ) : null}

      {!hasAttemptedLookup && !record ? (
        <div className="print-hidden mx-auto mt-6 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
          {[
            {
              title: "1. Enter Token ID",
              description:
                "Use the minted PoCT token number from the admin flow or student dashboard.",
            },
            {
              title: "2. Read Chain Data",
              description:
                "DACS checks the NFT owner and certificate record directly from the contract.",
            },
            {
              title: "3. Confirm Metadata",
              description:
                "The page combines on-chain proof with course, institute, and reward data.",
            },
          ].map((step) => (
            <DashboardCard key={step.title}>
              <h3 className="mb-2 text-lg font-semibold text-white">{step.title}</h3>
              <p className="text-slate-400">{step.description}</p>
            </DashboardCard>
          ))}
        </div>
      ) : null}
    </PageLayout>
  )
}

export default function VerifyPage() {
  return (
    <Suspense
      fallback={
        <PageLayout>
          <div className="mx-auto max-w-3xl">
            <DashboardCard>
              <div className="py-12 text-center text-slate-300">
                Preparing the public verification page...
              </div>
            </DashboardCard>
          </div>
        </PageLayout>
      }
    >
      <VerifyPageContent />
    </Suspense>
  )
}
