import { Types } from "mongoose";

/**
 * Shared helpers for normalized audit-trail entries returned in submission payloads.
 */
export const AUDIT_TRAIL_EVENT_TYPES = [
  "submission_created",
  "mint_prepared",
  "submission_rejected",
  "submission_minted",
  "submission_revoked",
  "submission_reset",
] as const;

export type AuditTrailEventType = (typeof AUDIT_TRAIL_EVENT_TYPES)[number];
const AUDIT_TRAIL_EVENT_TYPE_SET = new Set<string>(AUDIT_TRAIL_EVENT_TYPES);

export interface AuditTrailEventInput {
  type: AuditTrailEventType;
  title: string;
  description?: string;
  actorAddress?: string;
  metadata?: Record<string, unknown>;
}

interface AuditTrailEventLike {
  _id?: unknown;
  type: string;
  title: string;
  description?: string;
  actorAddress?: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

function normalizeAuditTrailEventType(type: string): AuditTrailEventType {
  if (type === "chain_reset_recovery") {
    return "submission_reset";
  }

  if (AUDIT_TRAIL_EVENT_TYPE_SET.has(type)) {
    return type as AuditTrailEventType;
  }

  return "submission_reset";
}

/**
 * Creates a normalized audit-trail entry ready to persist in MongoDB.
 */
export function createAuditTrailEvent({
  type,
  title,
  description,
  actorAddress,
  metadata,
}: AuditTrailEventInput) {
  return {
    type,
    title,
    ...(description?.trim() ? { description: description.trim() } : {}),
    ...(actorAddress ? { actorAddress: actorAddress.toLowerCase() } : {}),
    createdAt: new Date(),
    ...(metadata ? { metadata } : {}),
  };
}

/**
 * Converts a stored audit entry into the API response shape used by the dashboard.
 */
export function toAuditTrailResponse(event: AuditTrailEventLike) {
  const normalizedType = normalizeAuditTrailEventType(event.type);

  return {
    id:
      typeof event._id === "object" && event._id instanceof Types.ObjectId
        ? event._id.toString()
        : String(event._id ?? `${normalizedType}-${event.createdAt.toISOString()}`),
    type: normalizedType,
    title: event.title,
    description: event.description ?? null,
    actorAddress: event.actorAddress ?? null,
    createdAt: event.createdAt.toISOString(),
    metadata: event.metadata ?? {},
  };
}
