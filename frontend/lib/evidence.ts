"use client"

import { fetchEvidenceBlob } from "@/lib/api"

let activeEvidenceObjectUrl: string | null = null
let activeEvidenceCleanupTimer: ReturnType<typeof globalThis.setTimeout> | null = null

function writePopupStatus(popup: Window, title: string, message: string) {
  try {
    popup.document.open()
    popup.document.write(`<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      body {
        margin: 0;
        min-height: 100vh;
        display: grid;
        place-items: center;
        background: #101010;
        color: #f5f5f5;
        font-family: ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      }
      main {
        max-width: 30rem;
        padding: 2rem;
        text-align: center;
      }
      h1 {
        margin: 0 0 0.75rem;
        font-size: 1rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        color: #a5c0f8;
      }
      p {
        margin: 0;
        line-height: 1.6;
        color: #d1d5db;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${title}</h1>
      <p>${message}</p>
    </main>
  </body>
</html>`)
    popup.document.close()
  } catch {
    // Ignore popup rendering failures and rely on the later navigation fallback.
  }
}

function openBlobWithAnchor(blob: Blob, objectUrl: string, filename?: string | null) {
  const link = document.createElement("a")
  link.href = objectUrl
  link.target = "_blank"
  link.rel = "noopener noreferrer"

  if (
    filename &&
    !blob.type.startsWith("application/pdf") &&
    !blob.type.startsWith("image/")
  ) {
    link.download = filename
  }

  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

function releaseEvidenceObjectUrl() {
  if (activeEvidenceCleanupTimer) {
    globalThis.clearTimeout(activeEvidenceCleanupTimer)
    activeEvidenceCleanupTimer = null
  }

  if (activeEvidenceObjectUrl) {
    URL.revokeObjectURL(activeEvidenceObjectUrl)
    activeEvidenceObjectUrl = null
  }
}

function trackEvidenceObjectUrl(objectUrl: string) {
  releaseEvidenceObjectUrl()
  activeEvidenceObjectUrl = objectUrl
  activeEvidenceCleanupTimer = globalThis.setTimeout(() => {
    if (activeEvidenceObjectUrl === objectUrl) {
      URL.revokeObjectURL(objectUrl)
      activeEvidenceObjectUrl = null
    } else {
      URL.revokeObjectURL(objectUrl)
    }

    activeEvidenceCleanupTimer = null
  }, 60_000)
}

export async function openPrivateEvidence(
  token: string,
  submissionId: string,
  filename?: string | null
) {
  const popup = window.open("", "_blank")

  if (popup) {
    try {
      popup.opener = null
    } catch {
      // Ignore popup opener assignment failures.
    }

    writePopupStatus(
      popup,
      "Opening Private Evidence",
      "DACS is loading the encrypted evidence file and preparing it for secure viewing."
    )
  }

  try {
    const blob = await fetchEvidenceBlob(token, submissionId)
    const objectUrl = URL.createObjectURL(blob)

    if (popup && !popup.closed) {
      popup.location.replace(objectUrl)
    } else {
      openBlobWithAnchor(blob, objectUrl, filename)
    }

    trackEvidenceObjectUrl(objectUrl)
  } catch (error) {
    if (popup && !popup.closed) {
      writePopupStatus(
        popup,
        "Evidence Unavailable",
        "DACS could not open the private evidence file. Return to the dashboard or admin console and try again."
      )
    }

    throw error
  }
}
