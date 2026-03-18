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
    <div className="brand-card-hover overflow-hidden rounded-[30px] border border-[#b8892d]/18 bg-[linear-gradient(145deg,rgba(14,18,22,0.98),rgba(11,17,28,0.98))] p-6 shadow-[0_24px_60px_rgba(9,12,17,0.26)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="inline-flex rounded-full border border-[#b8892d]/25 bg-[#b8892d]/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-[#f3d9a2]">
          Share Card Preview
        </div>
        <div className="rounded-full border border-[#0f766e]/30 bg-[#0f766e]/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-[#c9f0e7]">
          SVG Export Ready
        </div>
      </div>

      <div className="mt-5 min-w-0">
        <div className="text-xs uppercase tracking-[0.26em] text-[#d9c8a6]">
          DACS Verified Credential
        </div>
        <div className="mt-3 inline-flex rounded-full border border-[#b8892d]/25 bg-[#b8892d]/10 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-[#f3d9a2]">
          {formatCredentialTypeLabel(record.credentialType)}
        </div>
        <h3 className="display-serif mt-4 max-w-[18ch] text-[2.1rem] leading-[0.98] font-semibold text-white [overflow-wrap:anywhere]">
          {record.courseName}
        </h3>
        <p className="mt-3 max-w-[28ch] text-sm leading-6 text-slate-300 [overflow-wrap:anywhere]">
          {record.instituteName}
        </p>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
            Token
          </div>
          <div className="mt-2 text-lg font-semibold text-white">#{record.tokenId}</div>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
            Issued
          </div>
          <div className="mt-2 text-white">{formatDateTime(record.issuedAt)}</div>
        </div>
        <div className="rounded-[22px] border border-white/10 bg-black/20 px-4 py-3 text-sm text-slate-300">
          <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
            Reward
          </div>
          <div className="mt-2 text-[#f3d9a2]">
            {record.eduAmount !== null
              ? `${record.eduAmount.toLocaleString()} EDU`
              : "Not available"}
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <div className="rounded-full border border-[#0f766e]/30 bg-[#0f766e]/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[#c9f0e7]">
          Soulbound
        </div>
        <div className="rounded-full border border-[#b8892d]/25 bg-[#b8892d]/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-[#f3d9a2]">
          On-chain Proof
        </div>
        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-slate-300">
          Student {truncateValue(record.studentAddress, 8, 6)}
        </div>
      </div>

      <div className="mt-5 rounded-[22px] border border-white/10 bg-black/20 p-4 text-sm leading-6 text-slate-300">
        The downloadable SVG uses a wider 1200×630 layout with structured typography,
        shortened proof labels, and export-safe spacing for reports and reviewer handoffs.
      </div>
    </div>
  )
}
