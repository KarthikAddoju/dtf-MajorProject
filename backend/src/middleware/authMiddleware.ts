import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { runtimeConfig } from "../config/runtime";
import { sendError } from "../lib/api";

/**
 * JWT authentication and role-based authorization middleware for DACS API routes.
 *
 * Tokens are expected to contain the normalized wallet address and resolved user role.
 */
export interface AuthTokenPayload extends jwt.JwtPayload {
  address: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthTokenPayload;
}

/**
 * Validates the bearer token and attaches the decoded wallet/session payload to `req.user`.
 */
export const authenticate = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers.authorization;

  if (!authHeader?.startsWith("Bearer ")) {
    return sendError(res, 401, "UNAUTHORIZED", "No token provided");
  }

  const token = authHeader.slice("Bearer ".length).trim();

  if (!token) {
    return sendError(res, 401, "UNAUTHORIZED", "No token provided");
  }

  try {
    const decoded = jwt.verify(token, runtimeConfig.jwtSecret, {
      algorithms: ["HS256"],
    });

    if (
      typeof decoded === "string" ||
      typeof decoded.address !== "string" ||
      typeof decoded.role !== "string"
    ) {
      return sendError(res, 401, "INVALID_TOKEN", "Invalid token");
    }

    req.user = decoded as AuthTokenPayload;
    next();
  } catch {
    return sendError(res, 401, "INVALID_TOKEN", "Invalid token");
  }
};

/**
 * Restricts a route to the supplied roles after `authenticate` has populated `req.user`.
 */
export const authorize = (...roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return sendError(res, 403, "FORBIDDEN", "Forbidden");
    }
    next();
  };
};
