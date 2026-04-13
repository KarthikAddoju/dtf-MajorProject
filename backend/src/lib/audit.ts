import { Types } from "mongoose";

export const AUDIT_TRAIL_EVENT_TYPES = [
  "submission_created",
  "mint_prepared",
  "submission_rejected",
  "submission_minted",
  "submission_revoked",
  "submission_reset",
] as const;

export type AuditTrailEventType = (typeof AUDIT_TRAIL_EVENT_TYPES)[number];

export interface AuditTrailEventInput {
  type: AuditTrailEventType;
  title: string;
  description?: string;
  actorAddress?: string;
  metadata?: Record<string, unknown>;
}

interface AuditTrailEventLike {
  _id?: unknown;
  type: AuditTrailEventType;
  title: string;
  description?: string;
  actorAddress?: string;
  createdAt: Date;
  metadata?: Record<string, unknown>;
}

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

export function toAuditTrailResponse(event: AuditTrailEventLike) {
  return {
    id:
      typeof event._id === "object" && event._id instanceof Types.ObjectId
        ? event._id.toString()
        : String(event._id ?? `${event.type}-${event.createdAt.toISOString()}`),
    type: event.type,
    title: event.title,
    description: event.description ?? null,
    actorAddress: event.actorAddress ?? null,
    createdAt: event.createdAt.toISOString(),
    metadata: event.metadata ?? {},
  };
}
