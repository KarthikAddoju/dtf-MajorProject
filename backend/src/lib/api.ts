import { Response } from "express";
import { formatRequestLogPrefix } from "./requestId";

export type FieldErrors = Record<string, string>;

export function sendSuccess<T extends Record<string, unknown>>(
  res: Response,
  data: T,
  status = 200
) {
  return res.status(status).json({
    success: true,
    ...data,
  });
}

export function sendError(
  res: Response,
  status: number,
  code: string,
  message: string,
  fieldErrors?: FieldErrors
) {
  return res.status(status).json({
    success: false,
    error: {
      code,
      message,
      ...(fieldErrors ? { fieldErrors } : {}),
    },
  });
}

export function handleServerError(
  res: Response,
  error: unknown,
  message = "An unexpected error occurred"
) {
  console.error(formatRequestLogPrefix(res.locals?.requestId), error);
  return sendError(res, 500, "INTERNAL_SERVER_ERROR", message);
}
