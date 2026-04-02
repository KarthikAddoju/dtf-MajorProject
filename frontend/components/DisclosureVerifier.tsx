"use client"

import { type DragEvent, useCallback, useRef, useState } from "react"
import { fetchVerificationRecord, isAbortError } from "@/lib/api"
import { verifyMerkleProof } from "@/lib/merkle"
import type { DisclosurePackage } from "@/lib/types"
import { CLAIM_LABELS } from "@/components/DisclosureBuilderModal"

interface ClaimResult {
  key: string
  value: unknown
  valid: boolean
}

function formatClaimValue(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string") return value
  if (typeof value === "number") return value.toLocaleString()
  if (typeof value === "boolean") return value ? "Yes" : "No"
  return JSON.stringify(value)
}

function formatExpiryDate(value: string): string {
  const d = new Date(value)
  if (isNaN(d.getTime())) return value
  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(d)
}

function isDisclosurePackage(value: unknown): value is DisclosurePackage {
  if (!value || typeof value !== "object") return false
  const obj = value as Record<string, unknown>
  return (
    typeof obj.tokenId === "string" &&
    typeof obj.claimsRoot === "string" &&
    obj.disclosedClaims !== null &&
    typeof obj.disclosedClaims === "object" &&
    obj.merkleProofs !== null &&
    typeof obj.merkleProofs === "object"
  )
}

export function DisclosureVerifier() {
  const [rawInput, setRawInput] = useState("")
  const [verifyStatus, setVerifyStatus] = useState<"idle" | "loading" | "done" | "error">("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [results, setResults] = useState<ClaimResult[]>([])
  const [allValid, setAllValid] = useState(false)
  const [onChainRoot, setOnChainRoot] = useState<string | null>(null)
  const [rootMismatch, setRootMismatch] = useState(false)
  const [isExpired, setIsExpired] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const [pkgMeta, setPkgMeta] = useState<{
    tokenId: string
    audience: string | null
    expiresAt: string | null
  } | null>(null)

  const loadFileContents = useCallback((file: File) => {
    if (!file.name.endsWith(".json") && file.type !== "application/json") {
      setErrorMessage("Only JSON files are accepted. Paste JSON text or drop a .json file.")
      setVerifyStatus("error")
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setRawInput(reader.result)
        setVerifyStatus("idle")
        setResults([])
        setErrorMessage(null)
        setIsExpired(false)
      }
    }
    reader.onerror = () => {
      setErrorMessage("Could not read the file. Please paste the JSON manually.")
      setVerifyStatus("error")
    }
    reader.readAsText(file)
  }, [])

  function handleFileDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault()
    setIsDragging(false)
    const file = event.dataTransfer.files?.[0]
    if (file) loadFileContents(file)
  }

  function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]
    if (file) loadFileContents(file)
    event.target.value = ""
  }

  async function handleVerify() {
    setVerifyStatus("loading")
    setErrorMessage(null)
    setResults([])
    setOnChainRoot(null)
    setRootMismatch(false)
    setIsExpired(false)
    setPkgMeta(null)

    try {
      // Step 1: parse JSON (size guard prevents DoS from huge payloads)
      if (rawInput.length > 500_000) {
        throw new Error("Disclosure package is too large to process.")
      }

      let parsed: unknown
      try {
        parsed = JSON.parse(rawInput.trim())
      } catch {
        throw new Error("Invalid JSON — paste the full disclosure package.")
      }

      if (!isDisclosurePackage(parsed)) {
        throw new Error(
          "JSON does not look like a DACS disclosure package. " +
          "Expected: tokenId, claimsRoot, disclosedClaims, merkleProofs."
        )
      }

      const pkg = parsed

      // Step 2: fetch on-chain claimsRoot via the public verify endpoint
      let onChainClaimsRoot: string
      try {
        const record = await fetchVerificationRecord(pkg.tokenId)
        onChainClaimsRoot = record.record.claimsRoot
        setOnChainRoot(onChainClaimsRoot)
      } catch (error) {
        if (isAbortError(error)) return
        throw new Error(
          `Could not fetch on-chain record for token #${pkg.tokenId}. ` +
          "Make sure the token exists on the current network."
        )
      }

      // Step 3: sanity-check that the package's root matches on-chain
      if (pkg.claimsRoot.toLowerCase() !== onChainClaimsRoot.toLowerCase()) {
        setRootMismatch(true)
      }

      // Step 4: verify each disclosed claim's Merkle proof against the on-chain root
      const proofs = pkg.merkleProofs as Record<string, string[]>
      const claimResults: ClaimResult[] = Object.entries(pkg.disclosedClaims).map(
        ([key, value]) => {
          const proof = proofs[key]
          const valid =
            Array.isArray(proof) &&
            verifyMerkleProof(onChainClaimsRoot, key, value, proof)
          return { key, value, valid }
        }
      )

      // Step 5: check if the package has expired — expired disclosures are invalid
      let packageExpired = false
      if (pkg.expiresAt) {
        const d = new Date(pkg.expiresAt)
        packageExpired = !isNaN(d.getTime()) && d < new Date()
      }
      setIsExpired(packageExpired)

      if (packageExpired) {
        setResults(claimResults.map((r) => ({ ...r, valid: false })))
        setAllValid(false)
      } else {
        setResults(claimResults)
        setAllValid(claimResults.length > 0 && claimResults.every((r) => r.valid))
      }

      setPkgMeta({
        tokenId: pkg.tokenId,
        audience: pkg.audience,
        expiresAt: pkg.expiresAt,
      })

      setVerifyStatus("done")
    } catch (error) {
      if (isAbortError(error)) return
      setErrorMessage(
        error instanceof Error ? error.message : "Verification failed"
      )
      setVerifyStatus("error")
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      {/* Input area */}
      <div
        className={`rounded-xl border bg-[#1a1a1a] p-5 transition ${
          isDragging
            ? "border-[#4f7ef5]/55 bg-[#4f7ef5]/[0.04]"
            : "border-white/[0.08]"
        }`}
        onDrop={handleFileDrop}
        onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
        onDragLeave={(e) => { e.preventDefault(); setIsDragging(false) }}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <label
            htmlFor="disclosure-input"
            className="block text-sm font-medium text-[#c0c0c0]"
          >
            {isDragging ? "Drop JSON file here" : "Paste Disclosure Package JSON"}
          </label>
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              className="hidden"
            />
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 text-xs text-[#a0a0a0] transition hover:bg-white/[0.08] cursor-pointer"
            >
              Browse File
            </button>
          </div>
        </div>
        <textarea
          id="disclosure-input"
          value={rawInput}
          onChange={(e) => {
            setRawInput(e.target.value)
            if (verifyStatus !== "idle") {
              setVerifyStatus("idle")
              setResults([])
              setErrorMessage(null)
              setIsExpired(false)
            }
          }}
          placeholder={'{\n  "tokenId": "1",\n  "claimsRoot": "0x...",\n  "disclosedClaims": { ... },\n  "merkleProofs": { ... }\n}'}
          rows={8}
          className="w-full rounded-xl border border-white/[0.10] bg-[#111] px-4 py-3 font-mono text-xs leading-5 text-[#a5c0f8] placeholder:text-[#444] focus:border-[#4f7ef5]/50 focus:outline-none focus:ring-2 focus:ring-[#4f7ef5]/10"
        />
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="text-xs text-[#666666]">
            Verified entirely client-side against the on-chain Merkle root.
            Drop a .json file or paste text — no data is sent anywhere.
          </p>
          <button
            type="button"
            onClick={() => void handleVerify()}
            disabled={!rawInput.trim() || verifyStatus === "loading"}
            className="brand-button-primary shrink-0 px-5 py-2.5 text-sm disabled:cursor-not-allowed disabled:opacity-50"
          >
            {verifyStatus === "loading" ? "Verifying…" : "Verify Claims"}
          </button>
        </div>
      </div>

      {/* Error */}
      {verifyStatus === "error" && errorMessage && (
        <div className="rounded-xl border border-rose-500/25 bg-rose-500/08 px-4 py-3 text-sm text-rose-300">
          {errorMessage}
        </div>
      )}

      {/* Results */}
      {verifyStatus === "done" && pkgMeta && (
        <div className="space-y-4">
          {/* Package metadata */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1 text-xs text-[#a0a0a0]">
              Token #{pkgMeta.tokenId}
            </div>
            {pkgMeta.audience && (
              <div className="rounded-full border border-[#4f7ef5]/20 bg-[#4f7ef5]/08 px-3 py-1 text-xs text-[#a5c0f8]">
                Audience: {pkgMeta.audience}
              </div>
            )}
            {pkgMeta.expiresAt && (
              <div className={`rounded-full border px-3 py-1 text-xs ${
                isExpired
                  ? "border-rose-500/20 bg-rose-500/08 text-rose-300"
                  : "border-amber-500/20 bg-amber-500/08 text-amber-200"
              }`}>
                {isExpired ? "Expired" : "Expires"}: {formatExpiryDate(pkgMeta.expiresAt)}
              </div>
            )}
            {onChainRoot && (
              <div className="rounded-full border border-white/[0.08] bg-white/[0.03] px-3 py-1 font-mono text-[11px] text-[#666666]">
                Root: {onChainRoot.slice(0, 10)}…{onChainRoot.slice(-8)}
              </div>
            )}
          </div>

          {/* Root mismatch warning */}
          {rootMismatch && (
            <div className="rounded-xl border border-amber-500/25 bg-amber-500/08 px-4 py-3 text-sm text-amber-200">
              Warning: the package&apos;s claimsRoot does not match the on-chain root.
              The package may have been tampered with or issued against a different chain.
            </div>
          )}

          {/* Expiry warning */}
          {isExpired && pkgMeta?.expiresAt && (
            <div className="rounded-xl border border-rose-500/25 bg-rose-500/08 px-4 py-3 text-sm text-rose-300">
              <span className="font-medium">Disclosure package expired — all claims marked invalid.</span>{" "}
              This package was valid only until{" "}
              <span className="font-mono">{formatExpiryDate(pkgMeta.expiresAt)}</span>. Request a fresh disclosure from the credential holder.
            </div>
          )}

          {/* Claims table */}
          <div className="overflow-hidden rounded-xl border border-white/[0.08]">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/[0.08] bg-white/[0.03]">
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-[#666666]">
                    Claim
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-[0.08em] text-[#666666]">
                    Disclosed Value
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium uppercase tracking-[0.08em] text-[#666666]">
                    Proof
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.06]">
                {results.map((result) => (
                  <tr key={result.key} className="bg-[#1a1a1a]">
                    <td className="px-4 py-3">
                      <div className="text-[#f0f0f0]">
                        {CLAIM_LABELS[result.key] ?? result.key}
                      </div>
                      <div className="mt-0.5 font-mono text-[11px] text-[#666666]">
                        {result.key}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-[#a0a0a0] [overflow-wrap:anywhere]">
                      {formatClaimValue(result.value)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {result.valid ? (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-medium text-emerald-300">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                          </svg>
                          Valid
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-500/25 bg-rose-500/10 px-2.5 py-1 text-xs font-medium text-rose-300">
                          <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2.5} stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
                          </svg>
                          Invalid
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Overall verdict */}
          <div
            className={`rounded-xl border px-5 py-4 ${
              allValid
                ? "border-emerald-500/25 bg-emerald-500/08"
                : "border-rose-500/25 bg-rose-500/08"
            }`}
          >
            <div className={`font-semibold ${allValid ? "text-emerald-300" : "text-rose-300"}`}>
              {allValid
                ? `All ${results.length} claim${results.length !== 1 ? "s" : ""} verified against on-chain root`
                : `${results.filter((r) => !r.valid).length} claim${results.filter((r) => !r.valid).length !== 1 ? "s" : ""} failed proof verification`}
            </div>
            <p className="mt-1 text-sm text-[#a0a0a0]">
              {allValid
                ? "Each disclosed value matches the cryptographic proof anchored to the on-chain Merkle root. This credential disclosure is authentic."
                : "One or more disclosed values do not match their Merkle proofs. The package may have been modified."}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
