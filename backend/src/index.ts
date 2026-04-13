import "./config/env";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import mongoose from "mongoose";

import authRoutes from "./routes/auth";
import uploadRoutes from "./routes/upload";
import instituteRoutes from "./routes/institutes";
import submissionRoutes from "./routes/submissions";
import analyticsRoutes from "./routes/analytics";
import verifyRoutes from "./routes/verify";
import healthRoutes from "./routes/health";
import reviewRoutes from "./routes/reviews";
import credentialRoutes from "./routes/credentials";
import evidenceRoutes from "./routes/evidence";
import { sendError } from "./lib/api";
import { getBlockchainReadiness } from "./lib/blockchainReadiness";
import { seedDefaultInstitutes } from "./services/seed";
import { runtimeConfig } from "./config/runtime";

const app = express();

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

// Request logger
app.use((req, _res, next) => {
  const start = Date.now();
  const originalEnd = _res.end.bind(_res);
  _res.on("finish", () => {
    const duration = Date.now() - start;
    console.log(
      `${req.method} ${req.originalUrl} ${_res.statusCode} ${duration}ms`
    );
  });
  next();
});

app.use("/api/auth/challenge", createRateLimiter(10 * 60 * 1000, 15));
app.use("/api/auth/verify", createRateLimiter(10 * 60 * 1000, 20));
app.use("/api/upload", createRateLimiter(15 * 60 * 1000, 10));
app.use("/api/verify", createRateLimiter(60 * 1000, 60));
app.use("/api/analytics", createRateLimiter(60 * 1000, 90));
app.use("/api/reviews", createRateLimiter(10 * 60 * 1000, 40));
app.use("/api/credentials", createRateLimiter(10 * 60 * 1000, 40));

app.get("/", (_req, res) => {
  res.send("Backend is running");
});

app.use("/api/auth", authRoutes);
app.use("/api/upload", uploadRoutes);
app.use("/api/evidence", evidenceRoutes);
app.use("/api/institutes", instituteRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/credentials", credentialRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/verify", verifyRoutes);
app.use("/api/health", healthRoutes);

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
    console.error("[Unhandled Error]", err);
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

  if (blockchainReadiness.status === "connected") {
    console.log(
      `[Startup] Blockchain ready on chain ${blockchainReadiness.chainId} at block ${blockchainReadiness.blockNumber}.`
    );
  } else {
    console.warn(
      `[Startup Warning] Blockchain readiness is degraded. ${blockchainReadiness.warnings.join(" ")}`
    );
    console.warn("=".repeat(88));
    console.warn("🚨 DACS blockchain is not demo-ready yet.");
    console.warn("Fix it with:");
    console.warn("  1. cd contracts && npm run deploy:sync");
    console.warn("  2. Restart the backend server");
    console.warn('  3. Recheck GET /api/health until services.blockchain.status is "connected"');
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
