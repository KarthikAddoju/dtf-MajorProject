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
app.use(helmet());
app.use(
  cors({
    origin: runtimeConfig.frontendOrigin,
  })
);
app.use(express.json({ limit: runtimeConfig.requestBodyLimit }));

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

mongoose.connect(runtimeConfig.mongodbUri)
.then(async () => {
  await seedDefaultInstitutes();
  console.log("MongoDB Connected");

  app.listen(runtimeConfig.port, () => {
    console.log(`Server running on port ${runtimeConfig.port}`);
  });

})
.catch((err) => {
  console.error("MongoDB connection failed", err);
  process.exitCode = 1;
});
