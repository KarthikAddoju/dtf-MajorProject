import type {
  AuditTrailEvent,
  AuditTrailEventType,
  CredentialType,
} from "@/lib/types"

export function formatDateTime(value: string | null) {
  if (!value) {
    return "Not available"
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function truncateValue(
  value: string | null | undefined,
  start = 10,
  end = 8
) {
  if (!value) {
    return "Not available"
  }

  if (value.length <= start + end) {
    return value
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`
}

export function formatCredentialTypeLabel(value: CredentialType | string) {
  return value
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ")
}

export function getCredentialTypeAccent(type: CredentialType | string): string {
  switch (type) {
    case "internship":
      return "border-l-emerald-500"
    case "hackathon":
    case "competition":
      return "border-l-amber-500"
    case "certification":
      return "border-l-[#4f7ef5]"
    case "bootcamp":
      return "border-l-violet-500"
    case "course":
      return "border-l-cyan-500"
    case "workshop":
    case "seminar":
      return "border-l-teal-500"
    case "quiz":
      return "border-l-rose-400"
    default:
      return "border-l-[#666666]"
  }
}

const DEFAULT_AUDIT_TRAIL_EVENT_ACCENT = {
  badge:
    "border border-white/15 bg-white/[0.05] text-slate-300",
  icon:
    "border border-white/15 bg-white/[0.05] text-slate-300",
} as const

export function getAuditTrailEventAccent(
  type: AuditTrailEventType | string | null | undefined
) {
  switch (type) {
    case "submission_created":
      return {
        badge:
          "border border-blue-500/30 bg-blue-500/10 text-blue-200",
        icon:
          "border border-blue-500/30 bg-blue-500/10 text-blue-200",
      }
    case "mint_prepared":
      return {
        badge:
          "border border-amber-500/30 bg-amber-500/10 text-amber-200",
        icon:
          "border border-amber-500/30 bg-amber-500/10 text-amber-200",
      }
    case "submission_rejected":
      return {
        badge:
          "border border-rose-500/30 bg-rose-500/10 text-rose-200",
        icon:
          "border border-rose-500/30 bg-rose-500/10 text-rose-200",
      }
    case "submission_minted":
      return {
        badge:
          "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
        icon:
          "border border-emerald-500/30 bg-emerald-500/10 text-emerald-200",
      }
    case "submission_revoked":
      return {
        badge:
          "border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200",
        icon:
          "border border-fuchsia-500/30 bg-fuchsia-500/10 text-fuchsia-200",
      }
    case "submission_reset":
      return {
        badge:
          "border border-orange-500/30 bg-orange-500/10 text-orange-200",
        icon:
          "border border-orange-500/30 bg-orange-500/10 text-orange-200",
      }
    default:
      return DEFAULT_AUDIT_TRAIL_EVENT_ACCENT
  }
}

export function getAuditTrailEventIcon(
  type: AuditTrailEventType | string | null | undefined
) {
  switch (type) {
    case "submission_created":
      return "UP"
    case "mint_prepared":
      return "PR"
    case "submission_rejected":
      return "RJ"
    case "submission_minted":
      return "MT"
    case "submission_revoked":
      return "RV"
    case "submission_reset":
      return "RS"
    default:
      return "EV"
  }
}

export function getLatestAuditEvent(events: AuditTrailEvent[]) {
  return [...events].sort((left, right) =>
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  )[0] ?? null
}
