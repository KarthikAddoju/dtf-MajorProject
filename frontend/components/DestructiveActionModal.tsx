"use client"

import { useRef } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Submission } from "@/lib/types"

interface DestructiveActionModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  action: "reject" | "revoke"
  submission: Submission | null
  onConfirm: (reason?: string) => void
  isProcessing?: boolean
}

export function DestructiveActionModal({
  open,
  onOpenChange,
  action,
  submission,
  onConfirm,
  isProcessing = false,
}: DestructiveActionModalProps) {
  const reasonRef = useRef<HTMLTextAreaElement | null>(null)

  if (!submission) return null

  const isRevoke = action === "revoke"

  function handleConfirm() {
    const reason = reasonRef.current?.value.trim() ?? ""
    onConfirm(isRevoke ? reason : undefined)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="border border-white/[0.10] bg-[#1a1a1a] text-white shadow-[0_32px_80px_rgba(0,0,0,0.6)]"
      >
        <DialogHeader>
          <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-xl border border-rose-500/30 bg-rose-500/10">
            <svg
              className="h-5 w-5 text-rose-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={2}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
          <DialogTitle className="text-white">
            {isRevoke
              ? `Revoke credential token #${submission.tokenId}?`
              : "Reject this submission?"}
          </DialogTitle>
          <DialogDescription className="text-[#a0a0a0]">
            {isRevoke
              ? "This submits an on-chain revocation transaction. The credential will permanently show as revoked on the public verification sheet. This action cannot be reversed."
              : "This will reject the submission and remove it from the review queue. The student will see the rejection note and can resubmit with corrected evidence."}
          </DialogDescription>
        </DialogHeader>

        {/* Submission info */}
        <div className="rounded-xl border border-white/[0.10] bg-[#242424] p-4">
          <div className="text-xs text-[#a0a0a0]">
            {isRevoke ? "Credential being revoked" : "Submission being rejected"}
          </div>
          <div className="mt-2 font-semibold text-white">{submission.courseName}</div>
          <div className="mt-1 text-sm text-slate-400">
            {submission.instituteName}
            {isRevoke && submission.tokenId ? (
              <span className="ml-2 rounded-full border border-white/[0.10] bg-white/[0.04] px-2 py-0.5 text-[10px] text-[#a0a0a0]">
                Token #{submission.tokenId}
              </span>
            ) : null}
          </div>
        </div>

        {/* Reason input for revoke */}
        {isRevoke ? (
          <div>
            <label className="brand-field-label">
              Revocation reason <span className="text-[#666666]">(optional)</span>
            </label>
            <textarea
              key={`${submission.id}:${action}:${open ? "open" : "closed"}`}
              ref={reasonRef}
              defaultValue=""
              placeholder="e.g. Academic misconduct, credential data error, duplicate submission..."
              rows={3}
              className="brand-input w-full resize-none"
            />
          </div>
        ) : null}

        <DialogFooter>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isProcessing}
            className="brand-button-secondary px-5 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isProcessing}
            className="flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-700 px-5 py-3 text-sm font-semibold text-rose-100 transition hover:bg-rose-600 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isProcessing ? (
              <>
                <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Processing...
              </>
            ) : isRevoke ? (
              "Sign & Revoke"
            ) : (
              "Confirm Rejection"
            )}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
