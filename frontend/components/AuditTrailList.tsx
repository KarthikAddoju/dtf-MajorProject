"use client"

import {
  formatDateTime,
  getAuditTrailEventAccent,
  getAuditTrailEventIcon,
  truncateValue,
} from "@/lib/formatting"
import type { AuditTrailEvent } from "@/lib/types"

interface AuditTrailListProps {
  events: AuditTrailEvent[]
  emptyMessage?: string
  compact?: boolean
}

function formatMetadataValue(value: unknown) {
  if (typeof value === "string") {
    return value
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value)
  }

  return null
}

export function AuditTrailList({
  events,
  emptyMessage = "No lifecycle events recorded yet.",
  compact = false,
}: AuditTrailListProps) {
  if (events.length === 0) {
    return (
      <div className="print-panel rounded-2xl border border-white/10 bg-black/20 p-4 text-sm text-slate-400">
        {emptyMessage}
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {events.map((event) => {
        const accent = getAuditTrailEventAccent(event.type)
        const metadataEntries = Object.entries(event.metadata ?? {}).filter(([, value]) =>
          formatMetadataValue(value)
        )

        return (
          <div
            key={event.id}
            className={`print-panel rounded-2xl border border-white/10 bg-white/[0.03] ${
              compact ? "p-4" : "p-5"
            }`}
          >
            <div className="flex items-start gap-4">
              <div
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-xs font-semibold tracking-[0.2em] ${accent.icon}`}
              >
                {getAuditTrailEventIcon(event.type)}
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="text-base font-semibold text-white">
                      {event.title}
                    </div>
                    {event.description ? (
                      <p className="mt-1 text-sm text-slate-300">
                        {event.description}
                      </p>
                    ) : null}
                  </div>

                  <div
                    className={`rounded-full px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] ${accent.badge}`}
                  >
                    {event.type.replaceAll("_", " ")}
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 text-sm text-slate-300 sm:grid-cols-2">
                  <div className="print-panel rounded-xl border border-white/10 bg-black/20 p-3">
                    <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                      Timestamp
                    </div>
                    <div className="mt-2 text-white">
                      {formatDateTime(event.createdAt)}
                    </div>
                  </div>

                  {event.actorAddress ? (
                    <div className="print-panel rounded-xl border border-white/10 bg-black/20 p-3">
                      <div className="text-xs uppercase tracking-[0.18em] text-slate-500">
                        Actor
                      </div>
                      <div className="mt-2 font-mono text-cyan-200">
                        {truncateValue(event.actorAddress, 12, 10)}
                      </div>
                    </div>
                  ) : null}
                </div>

                {metadataEntries.length > 0 ? (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {metadataEntries.slice(0, compact ? 2 : 4).map(([key, rawValue]) => (
                      <div
                        key={key}
                        className="print-panel rounded-full border border-white/10 bg-black/20 px-3 py-1 text-xs text-slate-300"
                      >
                        <span className="uppercase tracking-[0.14em] text-slate-500">
                          {key}
                        </span>{" "}
                        {formatMetadataValue(rawValue)}
                      </div>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
