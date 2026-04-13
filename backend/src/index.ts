import "./config/env";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";

import { sendError } from "./lib/api";
import { getBlockchainReadiness } from "./lib/blockchainReadiness";
import {
  formatRequestLogPrefix,
  requestIdMiddleware,
} from "./lib/requestId";
import { seedDefaultInstitutes } from "./services/seed";
import { runtimeConfig } from "./config/runtime";
import introspectionRoutes from "./routes/introspection";
import { apiRouteModules } from "./routes/manifest";

const app = express();
const MINUTE_MS = 60 * 1000;
const TEN_MINUTES_MS = 10 * MINUTE_MS;
const FIFTEEN_MINUTES_MS = 15 * MINUTE_MS;
const AUTH_CHALLENGE_LIMIT = 15;
const AUTH_VERIFY_LIMIT = 20;
const UPLOAD_LIMIT = 10;
const VERIFY_LIMIT = 60;
const ANALYTICS_LIMIT = 90;
const REVIEWS_LIMIT = 40;
const CREDENTIALS_LIMIT = 40;

function createRateLimiter(windowMs: number, limit: number) {
  return rateLimit({
    windowMs,
    limit,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, res) =>
      sendError(
        res,
        429,
        "RATE_LIMITED",
        "Too many requests, please slow down and try again shortly"
      ),
  });
}

app.disable("x-powered-by");
app.use(
  helmet({
    contentSecurityPolicy: false,
    frameguard: { action: "deny" },
  })
);
app.use(
  cors({
    origin: runtimeConfig.frontendOrigin,
  })
);
app.use(express.json({ limit: runtimeConfig.requestBodyLimit }));
app.use(requestIdMiddleware);

// Request logger
app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    console.info(
      `${formatRequestLogPrefix(res.locals.requestId)} ${req.method} ${req.originalUrl} ${res.statusCode} ${duration}ms`
    );
  });
  next();
});

app.use("/api/auth/challenge", createRateLimiter(TEN_MINUTES_MS, AUTH_CHALLENGE_LIMIT));
app.use("/api/auth/verify", createRateLimiter(TEN_MINUTES_MS, AUTH_VERIFY_LIMIT));
app.use("/api/upload", createRateLimiter(FIFTEEN_MINUTES_MS, UPLOAD_LIMIT));
app.use("/api/verify", createRateLimiter(MINUTE_MS, VERIFY_LIMIT));
app.use("/api/analytics", createRateLimiter(MINUTE_MS, ANALYTICS_LIMIT));
app.use("/api/reviews", createRateLimiter(TEN_MINUTES_MS, REVIEWS_LIMIT));
app.use("/api/credentials", createRateLimiter(TEN_MINUTES_MS, CREDENTIALS_LIMIT));

app.get("/", (_req, res) => {
  res.send("Backend is running");
});

for (const routeModule of apiRouteModules) {
  app.use(routeModule.basePath, routeModule.router);
}

if (process.env.NODE_ENV !== "production") {
  app.use("/api/routes", introspectionRoutes);
}

app.use((_req, res) => {
  return sendError(res, 404, "NOT_FOUND", "Route not found");
});

// Global error handler — catches unhandled errors from route handlers
app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction
  ) => {
    console.error(
      `${formatRequestLogPrefix(res.locals.requestId)} [Unhandled Error]`,
      err
    );
    if (!res.headersSent) {
      return sendError(
        res,
        500,
        "INTERNAL_SERVER_ERROR",
        "An unexpected error occurred"
      );
    }
  }
);

function gracefulShutdown(signal: string) {
  console.log(`\n${signal} received — shutting down gracefully`);
  mongoose
    .disconnect()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("SIGINT", () => gracefulShutdown("SIGINT"));

mongoose.connect(runtimeConfig.mongodbUri)
.then(async () => {
  await seedDefaultInstitutes();
  const blockchainReadiness = await getBlockchainReadiness();
  console.log("MongoDB Connected");
  console.log(
    [
      "[Startup]",
      `chain=${blockchainReadiness.observedChainId ?? "unavailable"}`,
      `expectedChain=${blockchainReadiness.expectedChainId}`,
      `poct=${runtimeConfig.poctAddress}`,
      `edu=${runtimeConfig.eduAddress}`,
      `controller=${runtimeConfig.mintControllerAddress}`,
    ].join(" ")
  );

  if (blockchainReadiness.status === "connected") {
    console.log(
      [
        "[Startup Ready]",
        `chain=${blockchainReadiness.observedChainId}`,
        `block=${blockchainReadiness.blockNumber}`,
      ].join(" ")
    );
  } else {
    console.warn(
      `[Startup Warning] Blockchain readiness is degraded. ${blockchainReadiness.warnings.join(" ")}`
    );
    console.warn("=".repeat(88));
    console.warn("🚨 DACS blockchain is not demo-ready yet.");
    console.warn("Fix it with:");
    console.warn("  1. cd contracts && npm run devnet:start");
    console.warn("  2. If this is a fresh-chain reset, run npm run deploy:sync");
    console.warn("  3. Restart the backend server");
    console.warn('  4. Recheck GET /api/health until services.blockchain.status is "connected"');
    console.warn("=".repeat(88));
  }

  app.listen(runtimeConfig.port, () => {
    console.log(`Server running on port ${runtimeConfig.port}`);
  });

})
.catch((err) => {
  console.error("MongoDB connection failed", err);
  process.exitCode = 1;
});
