"use client"

import { QRCodeSVG } from "qrcode.react"
import { formatDateTime, truncateValue } from "@/lib/formatting"
import type { VerificationRecord } from "@/lib/types"

interface CredentialShareCardProps {
  record: VerificationRecord
  shareUrl: string
}

export function CredentialShareCard({
  record,
  shareUrl,
}: CredentialShareCardProps) {
  return (
    <div className="overflow-hidden rounded-[28px] border border-[#b8892d]/20 bg-[linear-gradient(135deg,rgba(184,137,45,0.14),rgba(15,118,110,0.08),rgba(10,14,18,0.96))] p-6 shadow-[0_24px_60px_rgba(9,12,17,0.26)]">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-md">
          <div className="inline-flex rounded-full border border-[#b8892d]/25 bg-[#b8892d]/10 px-3 py-1 text-[11px] uppercase tracking-[0.28em] text-[#f3d9a2]">
            Shareable Credential Card
          </div>
          <div className="mt-4 text-xs uppercase tracking-[0.26em] text-[#d9c8a6]">
            DACS Verified Credential
          </div>
          <h3 className="mt-3 text-2xl font-semibold text-white">
            {record.courseName}
          </h3>
          <p className="mt-2 text-slate-300">{record.instituteName}</p>

          <div className="mt-5 space-y-3 text-sm text-slate-300">
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <span className="text-slate-500">Token</span>
              <span className="font-semibold text-white">#{record.tokenId}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <span className="text-slate-500">Issued</span>
              <span className="text-white">{formatDateTime(record.issuedAt)}</span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <span className="text-slate-500">Student</span>
              <span className="font-mono text-[#b9e7df]">
                {truncateValue(record.studentAddress, 10, 8)}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
              <span className="text-slate-500">Reward</span>
              <span className="text-[#f3d9a2]">
                {record.eduAmount !== null
                  ? `${record.eduAmount.toLocaleString()} EDU`
                  : "Not available"}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center gap-4">
          <div className="rounded-[24px] bg-white p-3 shadow-sm">
            <QRCodeSVG value={shareUrl} size={144} />
          </div>
          <div className="rounded-full border border-[#0f766e]/30 bg-[#0f766e]/10 px-3 py-1 text-xs uppercase tracking-[0.22em] text-[#c9f0e7]">
            Scan To Verify
          </div>
        </div>
      </div>
    </div>
  )
}
