"use client"

import { fetchEvidenceBlob } from "@/lib/api"

export async function openPrivateEvidence(
  token: string,
  submissionId: string,
  filename?: string | null
) {
  const blob = await fetchEvidenceBlob(token, submissionId)
  const objectUrl = URL.createObjectURL(blob)
  const popup = window.open(objectUrl, "_blank", "noopener,noreferrer")

  if (!popup) {
    const link = document.createElement("a")
    link.href = objectUrl
    link.download = filename ?? `evidence-${submissionId}`
    link.click()
  }

  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 60_000)
}
