import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

const REQUEST_ID_HEADER = "x-request-id";

/**
 * Adds a per-request correlation id to `res.locals` and the response headers.
 */
export function requestIdMiddleware(
  _req: Request,
  res: Response,
  next: NextFunction
) {
  const requestId = randomUUID();

  res.locals.requestId = requestId;
  res.setHeader(REQUEST_ID_HEADER, requestId);

  next();
}

/**
 * Formats a request-id prefix for console logs.
 */
export function formatRequestLogPrefix(requestId: unknown) {
  return typeof requestId === "string" && requestId.length > 0
    ? `[req:${requestId}]`
    : "[req:unknown]";
}

/**
 * Returns the response header name used for correlation ids.
 */
export function getRequestIdHeaderName() {
  return REQUEST_ID_HEADER;
}
