import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { sendError } from "../lib/api";

const JWT_SECRET = process.env.JWT_SECRET ?? "supersecret";

export interface AuthTokenPayload extends jwt.JwtPayload {
  address: string;
  role: string;
}

export interface AuthRequest extends Request {
  user?: AuthTokenPayload;
}

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
    const decoded = jwt.verify(token, JWT_SECRET);

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

export const authorize = (role: string) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (req.user?.role !== role) {
      return sendError(res, 403, "FORBIDDEN", "Forbidden");
    }
    next();
  };
};
