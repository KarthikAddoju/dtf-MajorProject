"use client"

import { useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createDisclosurePackage } from "@/lib/api"
import type { DisclosurePackage } from "@/lib/types"

export const CLAIM_LABELS: Record<string, string> = {
  courseName: "Course / Credential Name",
  credentialType: "Credential Type",
  instituteName: "Institution Name",
  instituteShortCode: "Institution Code",
  studentAddress: "Student Wallet Address",
  evidenceHash: "Evidence Document Hash",
  eduAmount: "EDU Token Reward",
  expiresAt: "Credential Expiry",
}

const ALL_CLAIM_KEYS = Object.keys(CLAIM_LABELS)

interface DisclosureBuilderModalProps {
  tokenId: string
  isOpen: boolean
  onClose: () => void
  token: string
}

export function DisclosureBuilderModal({
  tokenId,
  isOpen,
  onClose,
  token,
}: DisclosureBuilderModalProps) {
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(
    new Set(ALL_CLAIM_KEYS)
  )
  const [audience, setAudience] = useState("")
  const [expiresAt, setExpiresAt] = useState("")
  const [showOptional, setShowOptional] = useState(false)
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [pkg, setPkg] = useState<DisclosurePackage | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  function toggleKey(key: string) {
    setSelectedKeys((prev) => {
      const next = new Set(prev)
      if (next.has(key)) {
        next.delete(key)
      } else {
        next.add(key)
      }
      return next
    })
  }

  function handleSelectAll() {
    if (selectedKeys.size === ALL_CLAIM_KEYS.length) {
      setSelectedKeys(new Set())
    } else {
      setSelectedKeys(new Set(ALL_CLAIM_KEYS))
    }
  }

  async function handleGenerate() {
    if (selectedKeys.size === 0) return

    try {
      setStatus("loading")
      setErrorMessage(null)
      setPkg(null)

      const result = await createDisclosurePackage(token, tokenId, {
        claimKeys: [...selectedKeys],
        audience: audience.trim() || undefined,
        expiresAt: expiresAt || undefined,
      })

      setPkg(result)
      setStatus("done")
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not generate disclosure package"
      )
      setStatus("error")
    }
  }

  async function handleCopy() {
    if (!pkg) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(pkg, null, 2))
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // clipboard unavailable
    }
  }

  function handleDownload() {
    if (!pkg) return
    const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `dacs-disclosure-token-${tokenId}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  function handleOpenChange(open: boolean) {
    if (!open) {
      onClose()
      // Reset state when closed
      setStatus("idle")
      setPkg(null)
      setErrorMessage(null)
      setCopied(false)
      setAudience("")
      setExpiresAt("")
      setShowOptional(false)
      setSelectedKeys(new Set(ALL_CLAIM_KEYS))
    }
  }

  const allSelected = selectedKeys.size === ALL_CLAIM_KEYS.length
  const noneSelected = selectedKeys.size === 0

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto border border-white/[0.10] bg-[#1a1a1a] text-[#f0f0f0]">
        <DialogHeader>
          <DialogTitle className="text-[#f0f0f0]">Create Selective Disclosure</DialogTitle>
          <p className="mt-1 text-sm text-[#a0a0a0]">
            Token #{tokenId} — choose which claims to reveal. A Merkle proof will be
            generated so the recipient can verify each claim against the on-chain root
            without seeing the rest.
          </p>
        </DialogHeader>

        {status !== "done" && (
          <>
            {/* Step 1: Claim selector */}
            <div className="mt-4">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-[#c0c0c0]">
                  Claims to disclose
                </span>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  className="text-xs text-[#4f7ef5] transition hover:text-[#a5c0f8]"
                >
                  {allSelected ? "Deselect All" : "Select All"}
                </button>
              </div>

              <div className="space-y-2 rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                {ALL_CLAIM_KEYS.map((key) => (
                  <label
                    key={key}
                    className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-1.5 transition hover:bg-white/[0.04]"
                  >
                    <input
                      type="checkbox"
                      checked={selectedKeys.has(key)}
                      onChange={() => toggleKey(key)}
                      className="h-4 w-4 cursor-pointer rounded border-white/20 accent-[#4f7ef5]"
                    />
                    <div className="min-w-0 flex-1">
                      <span className="text-sm text-[#f0f0f0]">
                        {CLAIM_LABELS[key]}
                      </span>
                      <span className="ml-2 font-mono text-[11px] text-[#666666]">
                        {key}
                      </span>
                    </div>
                  </label>
                ))}
              </div>

              {noneSelected && (
                <p className="mt-2 text-xs text-rose-400">
                  Select at least one claim to generate a proof.
                </p>
              )}
            </div>

            {/* Step 2: Optional fields */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowOptional((v) => !v)}
                className="flex items-center gap-1.5 text-xs text-[#666666] transition hover:text-[#a0a0a0]"
              >
                <svg
                  className={`h-3.5 w-3.5 transition-transform ${showOptional ? "rotate-90" : ""}`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                Optional: audience &amp; expiry
              </button>

              {showOptional && (
                <div className="mt-3 space-y-3">
                  <div>
                    <label className="brand-field-label text-xs">
                      Audience <span className="text-[#666666]">(who this is for)</span>
                    </label>
                    <input
                      type="text"
                      value={audience}
                      onChange={(e) => setAudience(e.target.value)}
                      placeholder="e.g. LinkedIn – Recruiter at Infosys"
                      className="brand-input mt-1 text-sm"
                    />
                  </div>
                  <div>
                    <label className="brand-field-label text-xs">
                      Expires at <span className="text-[#666666]">(optional)</span>
                    </label>
                    <input
                      type="date"
                      value={expiresAt}
                      onChange={(e) => setExpiresAt(e.target.value)}
                      className="brand-input mt-1 text-sm"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Error */}
            {status === "error" && errorMessage && (
              <p className="mt-3 text-sm text-rose-400">{errorMessage}</p>
            )}

            {/* Generate button */}
            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => void handleGenerate()}
                disabled={noneSelected || status === "loading"}
                className="brand-button-primary px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
              >
                {status === "loading" ? "Generating…" : "Generate Proof Package"}
              </button>
            </div>
          </>
        )}

        {/* Result */}
        {status === "done" && pkg && (
          <div className="mt-4 space-y-4">
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/06 px-4 py-3 text-sm text-emerald-300">
              Proof package generated — {Object.keys(pkg.disclosedClaims).length} claim
              {Object.keys(pkg.disclosedClaims).length !== 1 ? "s" : ""} with Merkle proofs.
              Share this JSON with anyone who needs to verify your credential.
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#111] p-3">
              <pre className="max-h-48 overflow-y-auto text-[11px] leading-5 text-[#a5c0f8]">
                {JSON.stringify(pkg, null, 2)}
              </pre>
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="brand-button-secondary px-4 py-2 text-sm"
              >
                {copied ? "Copied!" : "Copy JSON"}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                className="brand-button-secondary px-4 py-2 text-sm"
              >
                Download JSON
              </button>
              <button
                type="button"
                onClick={() => {
                  setStatus("idle")
                  setPkg(null)
                }}
                className="ml-auto text-sm text-[#666666] transition hover:text-[#a0a0a0]"
              >
                Generate another
              </button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
