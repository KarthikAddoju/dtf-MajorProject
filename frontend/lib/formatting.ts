import type { AuditTrailEvent, AuditTrailEventType } from "@/lib/types"

export function formatDateTime(value: string | null) {
  if (!value) {
    return "Not available"
  }

  return new Intl.DateTimeFormat("en-IN", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(value))
}

export function truncateValue(value: string, start = 10, end = 8) {
  if (value.length <= start + end) {
    return value
  }

  return `${value.slice(0, start)}...${value.slice(-end)}`
}

export function getAuditTrailEventAccent(type: AuditTrailEventType) {
  switch (type) {
    case "submission_created":
      return {
        badge:
          "border border-blue-500/30 bg-blue-500/10 text-blue-200",
        icon:
          "border border-blue-500/30 bg-blue-500/10 text-blue-200",
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
  }
}

export function getAuditTrailEventIcon(type: AuditTrailEventType) {
  switch (type) {
    case "submission_created":
      return "UP"
    case "submission_rejected":
      return "RJ"
    case "submission_minted":
      return "MT"
  }
}

export function getLatestAuditEvent(events: AuditTrailEvent[]) {
  return [...events].sort((left, right) =>
    new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime()
  )[0] ?? null
}
