import {
  formatCredentialTypeLabel,
  formatDateTime,
  truncateValue,
} from "@/lib/formatting"
import type { VerificationRecord } from "@/lib/types"

function escapeXml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;")
}

function sanitizeFilename(value: string) {
  const normalized = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")

  return normalized || "credential"
}

function normalizeWhitespace(value: string) {
  return value.replace(/\s+/g, " ").trim()
}

function ellipsize(value: string, maxChars: number) {
  if (value.length <= maxChars) {
    return value
  }

  return `${value.slice(0, Math.max(1, maxChars - 1)).trimEnd()}…`
}

function clampTextToLines(value: string, maxCharsPerLine: number, maxLines: number) {
  const clean = normalizeWhitespace(value)

  if (!clean) {
    return [""]
  }

  const words = clean.split(" ")
  const lines: string[] = []
  let currentLine = ""

  function pushCurrentLine() {
    if (currentLine) {
      lines.push(currentLine)
      currentLine = ""
    }
  }

  for (const word of words) {
    if (word.length > maxCharsPerLine) {
      pushCurrentLine()

      let index = 0
      while (index < word.length) {
        const chunk = word.slice(index, index + maxCharsPerLine)
        lines.push(chunk)
        index += maxCharsPerLine
      }

      continue
    }

    const nextLine = currentLine ? `${currentLine} ${word}` : word

    if (nextLine.length <= maxCharsPerLine) {
      currentLine = nextLine
      continue
    }

    pushCurrentLine()
    currentLine = word
  }

  pushCurrentLine()

  if (lines.length <= maxLines) {
    return lines
  }

  const visibleLines = lines.slice(0, maxLines)
  const overflowLine = `${visibleLines[maxLines - 1]} ${lines.slice(maxLines).join(" ")}`
  visibleLines[maxLines - 1] = ellipsize(overflowLine, maxCharsPerLine)
  return visibleLines
}

function renderSvgTextBlock(options: {
  lines: string[]
  x: number
  y: number
  lineHeight: number
  fill: string
  fontSize: number
  fontFamily: string
  fontWeight?: string | number
  letterSpacing?: number
}) {
  const {
    lines,
    x,
    y,
    lineHeight,
    fill,
    fontSize,
    fontFamily,
    fontWeight,
    letterSpacing,
  } = options

  return `
  <text x="${x}" y="${y}" fill="${fill}" font-size="${fontSize}" font-family="${fontFamily}"${
    fontWeight ? ` font-weight="${fontWeight}"` : ""
  }${letterSpacing !== undefined ? ` letter-spacing="${letterSpacing}"` : ""}>${lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : lineHeight
      return `<tspan x="${x}" dy="${dy}">${escapeXml(line)}</tspan>`
    })
    .join("")}</text>`.trim()
}

function formatShareUrlLabel(shareUrl: string, tokenId: string) {
  try {
    const url = new URL(shareUrl)
    return `${url.hostname}${url.pathname}?tokenId=${tokenId}`
  } catch {
    return `verify?tokenId=${tokenId}`
  }
}

export function buildCredentialShareCaption(
  record: VerificationRecord,
  shareUrl: string
) {
  return [
    `Verified academic credential on DACS`,
    `${record.courseName} • ${formatCredentialTypeLabel(record.credentialType)} • ${record.instituteName}`,
    `Token #${record.tokenId}`,
    record.eduAmount !== null
      ? `${record.eduAmount.toLocaleString()} EDU rewarded`
      : "EDU reward unavailable",
    shareUrl,
  ].join("\n")
}

export function buildCredentialShareCardSvg(
  record: VerificationRecord,
  shareUrl: string
) {
  const titleLines = clampTextToLines(record.courseName, 20, 3)
  const instituteLines = clampTextToLines(
    `${formatCredentialTypeLabel(record.credentialType)} • ${record.instituteName}`,
    34,
    2
  )
  const statusLines = clampTextToLines(
    "Immutable and Publicly Verifiable",
    23,
    2
  )
  const shareUrlLabel = clampTextToLines(
    formatShareUrlLabel(shareUrl, record.tokenId),
    28,
    2
  )
  const studentLabel = truncateValue(record.studentAddress, 12, 10)
  const verifierLabel = truncateValue(record.verifierAddress, 12, 10)
  const rewardLabel =
    record.eduAmount !== null
      ? `${record.eduAmount.toLocaleString()} EDU`
      : "Reward unavailable"
  const issueDate = formatDateTime(record.issuedAt)
  const titleLineCount = titleLines.length
  const titleY = 176
  const instituteY = titleY + titleLineCount * 50
  const metaCardY = instituteY + instituteLines.length * 30 + 34

  return `
<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <rect width="1200" height="630" rx="36" fill="#0C1015"/>
  <rect x="18" y="18" width="1164" height="594" rx="30" fill="url(#surface)" stroke="#3A3020" stroke-width="1.2"/>
  <circle cx="1016" cy="112" r="152" fill="#0F766E" fill-opacity="0.12"/>
  <circle cx="204" cy="548" r="168" fill="#B8892D" fill-opacity="0.1"/>
  <rect x="72" y="70" width="302" height="44" rx="22" fill="#171914" stroke="#3A3020"/>
  <text x="102" y="98" fill="#F3D9A2" font-size="17" font-family="Arial, sans-serif" letter-spacing="4.2">DACS VERIFIED CREDENTIAL</text>
  ${renderSvgTextBlock({
    lines: titleLines,
    x: 72,
    y: titleY,
    lineHeight: 50,
    fill: "#F7F4EE",
    fontSize: 52,
    fontFamily: "Georgia, serif",
    fontWeight: 700,
  })}
  ${renderSvgTextBlock({
    lines: instituteLines,
    x: 72,
    y: instituteY,
    lineHeight: 30,
    fill: "#CFC6B6",
    fontSize: 22,
    fontFamily: "Arial, sans-serif",
  })}
  <rect x="72" y="${metaCardY}" width="560" height="154" rx="28" fill="#12140F" stroke="#2D2A24"/>
  <text x="110" y="${metaCardY + 40}" fill="#7F857B" font-size="15" font-family="Arial, sans-serif" letter-spacing="3.2">ISSUED</text>
  <text x="110" y="${metaCardY + 72}" fill="#F7F4EE" font-size="26" font-family="Arial, sans-serif" font-weight="600">${escapeXml(
    issueDate
  )}</text>
  <text x="110" y="${metaCardY + 112}" fill="#7F857B" font-size="15" font-family="Arial, sans-serif" letter-spacing="3.2">STUDENT</text>
  <text x="110" y="${metaCardY + 142}" fill="#A8E2D7" font-size="20" font-family="Arial, sans-serif">${escapeXml(
    studentLabel
  )}</text>
  <text x="360" y="${metaCardY + 112}" fill="#7F857B" font-size="15" font-family="Arial, sans-serif" letter-spacing="3.2">VERIFIER</text>
  <text x="360" y="${metaCardY + 142}" fill="#F0C6D0" font-size="20" font-family="Arial, sans-serif">${escapeXml(
    verifierLabel
  )}</text>
  <rect x="684" y="70" width="444" height="490" rx="30" fill="#10120F" stroke="#2E3733"/>
  <text x="726" y="126" fill="#7F857B" font-size="16" font-family="Arial, sans-serif" letter-spacing="3.2">CREDENTIAL STATUS</text>
  ${renderSvgTextBlock({
    lines: statusLines,
    x: 726,
    y: 182,
    lineHeight: 42,
    fill: "#F7F4EE",
    fontSize: 34,
    fontFamily: "Georgia, serif",
    fontWeight: 700,
  })}
  <text x="726" y="270" fill="#A8D6CF" font-size="30" font-family="Arial, sans-serif" font-weight="600">${escapeXml(
    rewardLabel
  )}</text>
  <rect x="726" y="304" width="360" height="98" rx="24" fill="#151915" stroke="#29322E"/>
  <text x="758" y="340" fill="#7F857B" font-size="14" font-family="Arial, sans-serif" letter-spacing="3">SHARE URL</text>
  ${renderSvgTextBlock({
    lines: shareUrlLabel,
    x: 758,
    y: 378,
    lineHeight: 26,
    fill: "#F3D9A2",
    fontSize: 22,
    fontFamily: "Arial, sans-serif",
    fontWeight: 600,
  })}
  <rect x="726" y="430" width="168" height="56" rx="20" fill="#0F766E" fill-opacity="0.14" stroke="#2C6A62"/>
  <text x="752" y="465" fill="#DDF4EE" font-size="17" font-family="Arial, sans-serif">Soulbound</text>
  <rect x="914" y="430" width="172" height="56" rx="20" fill="#B8892D" fill-opacity="0.14" stroke="#6F5A2B"/>
  <text x="940" y="465" fill="#F7E5BC" font-size="17" font-family="Arial, sans-serif">On-chain proof</text>
  <rect x="726" y="510" width="360" height="50" rx="18" fill="#11151D" stroke="#273241"/>
  <text x="756" y="542" fill="#D9E7F5" font-size="18" font-family="Arial, sans-serif">Token #${escapeXml(
    record.tokenId
  )} • ${escapeXml(formatCredentialTypeLabel(record.credentialType))}</text>
  <text x="72" y="590" fill="#7F857B" font-size="16" font-family="Arial, sans-serif">Generated by the DACS public verification portal</text>
  <defs>
    <linearGradient id="surface" x1="72" y1="56" x2="1128" y2="588" gradientUnits="userSpaceOnUse">
      <stop stop-color="#171914"/>
      <stop offset="1" stop-color="#0E1219"/>
    </linearGradient>
  </defs>
</svg>`.trim()
}

export function downloadSvgFile(filenameBase: string, svg: string) {
  const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${sanitizeFilename(filenameBase)}.svg`
  link.click()
  URL.revokeObjectURL(url)
}
