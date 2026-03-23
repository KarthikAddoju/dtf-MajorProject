"use client"

import {
  formatCredentialTypeLabel,
  formatDateTime,
  truncateValue,
} from "@/lib/formatting"
import type { VerificationRecord } from "@/lib/types"

interface CredentialShareCardProps {
  record: VerificationRecord
}

export function CredentialShareCard({
  record,
}: CredentialShareCardProps) {
  return (
    <div className="brand-card-hover overflow-hidden rounded-xl border border-white/[0.10] bg-[#1a1a1a] p-6 shadow-[0_8px_24px_rgba(0,0,0,0.4)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="inline-flex rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1 text-[11px] text-[#a0a0a0]">
          Share Card Preview
        </div>
        <div className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-xs text-emerald-300">
          SVG Export Ready
        </div>
      </div>

      <div className="mt-5 min-w-0">
        <div className="text-xs text-[#666666]">
          DACS Verified Credential
        </div>
        <div className="mt-3 inline-flex rounded-full border border-[#4f7ef5]/20 bg-[#4f7ef5]/08 px-3 py-1 text-[11px] text-[#a5c0f8]">
          {formatCredentialTypeLabel(record.credentialType)}
        </div>
        <h3 className="mt-4 max-w-[18ch] text-[2rem] leading-[0.98] font-semibold text-[#f0f0f0] [overflow-wrap:anywhere]">
          {record.courseName}
        </h3>
        <p className="mt-3 max-w-[28ch] text-sm leading-6 text-[#a0a0a0] [overflow-wrap:anywhere]">
          {record.instituteName}
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-[#a0a0a0]">
          <div className="text-[11px] text-[#666666]">
            Token
          </div>
          <div className="mt-2 text-lg font-semibold text-[#f0f0f0]">#{record.tokenId}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-[#a0a0a0]">
          <div className="text-[11px] text-[#666666]">
            Issued
          </div>
          <div className="mt-2 text-[#f0f0f0]">{formatDateTime(record.issuedAt)}</div>
        </div>
        <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-4 py-3 text-sm text-[#a0a0a0]">
          <div className="text-[11px] text-[#666666]">
            Reward
          </div>
          <div className="mt-2 text-[#4f7ef5]">
            {record.eduAmount !== null
              ? `${record.eduAmount.toLocaleString()} EDU`
              : "Not available"}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <div className="rounded-full border border-emerald-500/25 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-300">
          Soulbound
        </div>
        <div className="rounded-full border border-[#4f7ef5]/20 bg-[#4f7ef5]/08 px-3 py-1 text-[11px] text-[#a5c0f8]">
          On-chain Proof
        </div>
        <div className="rounded-full border border-white/[0.10] bg-white/[0.04] px-3 py-1 text-[11px] text-[#a0a0a0]">
          Student {truncateValue(record.studentAddress, 8, 6)}
        </div>
      </div>

      <div className="mt-5 rounded-xl border border-white/[0.08] bg-white/[0.03] p-4 text-sm leading-6 text-[#a0a0a0]">
        The downloadable SVG uses a wider 1200×630 layout with structured typography,
        shortened proof labels, and export-safe spacing for reports and reviewer handoffs.
      </div>
    </div>
  )
}
