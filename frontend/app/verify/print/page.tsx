"use client"

import Link from "next/link"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useSearchParams } from "next/navigation"
import { QRCodeSVG } from "qrcode.react"
import { buildAppUrl } from "@/lib/config"
import {
  fetchVerificationRecord,
  isAbortError,
} from "@/lib/api"
import {
  formatCredentialTypeLabel,
  formatDateTime,
} from "@/lib/formatting"
import type { VerificationRecord } from "@/lib/types"

function formatVerificationStatusLabel(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

function VerifyPrintPageContent() {
  const searchParams = useSearchParams()
  const tokenId = searchParams.get("tokenId") ?? ""
  const [record, setRecord] = useState<VerificationRecord | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const hasPrintedRef = useRef(false)

  useEffect(() => {
    if (!tokenId) {
      setRecord(null)
      setErrorMessage("A token ID is required to open the print export view.")
      return
    }

    const controller = new AbortController()

    async function loadRecord() {
      try {
        setIsLoading(true)
        setErrorMessage(null)
        const response = await fetchVerificationRecord(tokenId, controller.signal)

        if (controller.signal.aborted) {
          return
        }

        setRecord(response.record)
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) {
          return
        }

        const message =
          error instanceof Error ? error.message : "Could not load the print proof sheet."
        setRecord(null)
        setErrorMessage(message)
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false)
        }
      }
    }

    loadRecord()

    return () => controller.abort()
  }, [tokenId])

  const shareUrl = useMemo(() => {
    if (!record) {
      return null
    }

    return buildAppUrl(`/verify?tokenId=${record.tokenId}`)
  }, [record])

  useEffect(() => {
    if (!record || hasPrintedRef.current) {
      return
    }

    hasPrintedRef.current = true
    const timer = window.setTimeout(() => window.print(), 250)

    return () => window.clearTimeout(timer)
  }, [record])

  return (
    <main className="min-h-screen bg-white px-5 py-8 text-slate-900 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <div className="text-xs uppercase tracking-[0.28em] text-slate-500">
              Proof Sheet PDF
            </div>
            <h1 className="display-serif mt-2 text-[2rem] font-semibold text-slate-950">
              DACS verification export
            </h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={() => window.print()}
              className="rounded-xl border border-slate-300 bg-slate-950 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
            >
              Print / Save PDF
            </button>
            <Link
              href={tokenId ? `/verify?tokenId=${encodeURIComponent(tokenId)}` : "/verify"}
              className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-100"
            >
              Back to Verify Page
            </Link>
          </div>
        </div>

        {isLoading ? (
          <div className="rounded-[30px] border border-slate-200 bg-slate-50 px-6 py-16 text-center text-slate-600">
            Preparing the print-ready credential sheet...
          </div>
        ) : errorMessage ? (
          <div className="rounded-[30px] border border-rose-200 bg-rose-50 px-6 py-10 text-rose-800">
            <div className="text-xs uppercase tracking-[0.24em] text-rose-700">
              Export unavailable
            </div>
            <p className="mt-3 text-base">{errorMessage}</p>
          </div>
        ) : record ? (
          <article className="overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_24px_80px_rgba(15,23,42,0.08)] print:rounded-none print:border-none print:shadow-none">
            <section className="border-b border-slate-200 bg-[linear-gradient(145deg,rgba(245,248,250,0.96),rgba(252,248,241,0.98))] px-8 py-8">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                <div className="max-w-3xl">
                  <div className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-medium uppercase tracking-[0.26em] text-emerald-700">
                    Verified Academic Credential
                  </div>
                  <div className="mt-3 inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs uppercase tracking-[0.22em] text-amber-800">
                    {formatCredentialTypeLabel(record.credentialType)}
                  </div>
                  <h2 className="display-serif mt-5 text-[2.9rem] leading-[0.95] font-semibold text-slate-950 [overflow-wrap:anywhere]">
                    {record.courseName}
                  </h2>
                  <p className="mt-3 text-lg text-slate-700 [overflow-wrap:anywhere]">
                    Issued under {record.instituteName}
                  </p>
                  <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600">
                    This proof sheet resolves the public DACS verification record into a
                    printable review artifact with credential details, proof anchors,
                    lifecycle status, and re-openable verification access.
                  </p>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-5">
                  <div className="text-xs uppercase tracking-[0.24em] text-slate-500">
                    Token Reference
                  </div>
                  <div className="mt-2 text-3xl font-semibold text-slate-950">
                    #{record.tokenId}
                  </div>
                  <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-3">
                    <QRCodeSVG value={shareUrl ?? buildAppUrl("/verify")} size={136} />
                  </div>
                  <p className="mt-4 max-w-[13rem] text-sm leading-6 text-slate-600">
                    Scan to reopen the public verification sheet for this credential.
                  </p>
                </div>
              </div>
            </section>

            <section className="grid gap-4 px-8 py-8 md:grid-cols-2">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Student Wallet
                </div>
                <div className="mt-2 break-all font-mono text-sm text-slate-900">
                  {record.studentAddress}
                </div>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Verifier Wallet
                </div>
                <div className="mt-2 break-all font-mono text-sm text-slate-900">
                  {record.verifierAddress}
                </div>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Issued At
                </div>
                <div className="mt-2 text-slate-900">{formatDateTime(record.issuedAt)}</div>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Expires At
                </div>
                <div className="mt-2 text-slate-900">{formatDateTime(record.expiresAt)}</div>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  EDU Reward
                </div>
                <div className="mt-2 text-slate-900">
                  {record.eduAmount !== null
                    ? `${record.eduAmount.toLocaleString()} EDU`
                    : "Not available"}
                </div>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Verification Status
                </div>
                <div className="mt-2 text-slate-900">
                  {formatVerificationStatusLabel(record.verificationStatus)}
                </div>
              </div>
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Evidence Hash
                </div>
                <div className="mt-2 break-all font-mono text-slate-900">
                  {record.evidenceHash ?? "Not available"}
                </div>
              </div>
            </section>

            <section className="grid gap-4 border-t border-slate-200 px-8 py-8 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Proof Anchors
                </div>
                <div className="mt-4 space-y-4 text-sm text-slate-700">
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Public Proof CID
                    </div>
                    <div className="mt-2 break-all font-mono text-slate-900">
                      {record.publicProofCid}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Claims Root
                    </div>
                    <div className="mt-2 break-all font-mono text-slate-900">
                      {record.claimsRoot}
                    </div>
                  </div>
                  {record.txHash ? (
                    <div>
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        Mint Transaction
                      </div>
                      <div className="mt-2 break-all font-mono text-slate-900">
                        {record.txHash}
                      </div>
                    </div>
                  ) : null}
                  <div>
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Verification URL
                    </div>
                    <div className="mt-2 break-all font-mono text-slate-900">{shareUrl}</div>
                  </div>
                </div>
              </div>

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                  Trust Summary
                </div>
                <p className="mt-4 text-sm leading-7 text-slate-700">
                  The credential details above were resolved from the live PoCT
                  contract and joined with immutable public proof metadata captured
                  at mint time.
                </p>
                <div className="mt-4 rounded-[20px] border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900">
                  Chain {record.proof.chainId} • {formatVerificationStatusLabel(record.verificationStatus)} •{" "}
                  {record.proof.soulbound ? "Non-transferable" : "Transferable"}
                </div>
              </div>
            </section>

            {record.reviewNote ? (
              <section className="border-t border-slate-200 px-8 py-8">
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
                  <div className="text-xs uppercase tracking-[0.22em] text-slate-500">
                    Reviewer Note
                  </div>
                  <p className="mt-3 text-sm leading-7 text-slate-700">
                    {record.reviewNote}
                  </p>
                </div>
              </section>
            ) : null}

            <section className="border-t border-slate-200 px-8 py-8">
              <div className="text-xs uppercase tracking-[0.26em] text-emerald-700">
                Lifecycle Evidence
              </div>
              {record.auditTrail.length === 0 ? (
                <div className="mt-4 rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
                  No stored lifecycle events are available for this credential.
                </div>
              ) : (
                <div className="mt-4 space-y-4">
                  {record.auditTrail.map((event) => (
                    <div
                      key={event.id}
                      className="rounded-[24px] border border-slate-200 bg-slate-50 p-5"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <div className="text-base font-semibold text-slate-950">
                            {event.title}
                          </div>
                          {event.description ? (
                            <p className="mt-1 text-sm leading-6 text-slate-600">
                              {event.description}
                            </p>
                          ) : null}
                        </div>
                        <div className="rounded-full border border-slate-300 bg-white px-3 py-1 text-[11px] uppercase tracking-[0.18em] text-slate-600">
                          {event.type.replaceAll("_", " ")}
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                          <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                            Timestamp
                          </div>
                          <div className="mt-2 text-sm text-slate-900">
                            {formatDateTime(event.createdAt)}
                          </div>
                        </div>
                        {event.actorAddress ? (
                          <div className="rounded-[18px] border border-slate-200 bg-white px-4 py-3">
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                              Actor
                            </div>
                            <div className="mt-2 break-all font-mono text-sm text-slate-900">
                              {event.actorAddress}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </article>
        ) : null}
      </div>
    </main>
  )
}

export default function VerifyPrintPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-white px-5 py-8 text-slate-900 sm:px-8">
          <div className="mx-auto max-w-4xl rounded-[30px] border border-slate-200 bg-slate-50 px-6 py-16 text-center text-slate-600">
            Preparing the print-ready credential sheet...
          </div>
        </main>
      }
    >
      <VerifyPrintPageContent />
    </Suspense>
  )
}
