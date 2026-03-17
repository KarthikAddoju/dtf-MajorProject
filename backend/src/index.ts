import "./config/env";
import express from "express";
import cors from "cors";
import mongoose from "mongoose";

import mintRoute from "./routes/mint";
import authRoutes from "./routes/auth";
import uploadRoutes from "./routes/upload";
import instituteRoutes from "./routes/institutes";
import submissionRoutes from "./routes/submissions";
import analyticsRoutes from "./routes/analytics";
import verifyRoutes from "./routes/verify";
import healthRoutes from "./routes/health";
import { sendError } from "./lib/api";
import { seedDefaultInstitutes } from "./services/seed";

const app = express();
const PORT = Number(process.env.PORT ?? 4000);
const MONGODB_URI = process.env.MONGODB_URI ?? "mongodb://127.0.0.1:27017/dtf";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? "http://localhost:3000";

app.use(cors({ origin: FRONTEND_ORIGIN }));
app.use(express.json());

app.get("/", (_req, res) => {
  res.send("Backend is running");
});

app.use("/api/auth", authRoutes);
app.use("/api/mint", mintRoute);
app.use("/api/upload", uploadRoutes);
app.use("/api/institutes", instituteRoutes);
app.use("/api/submissions", submissionRoutes);
app.use("/api/analytics", analyticsRoutes);
app.use("/api/verify", verifyRoutes);
app.use("/api/health", healthRoutes);

app.use((_req, res) => {
  return sendError(res, 404, "NOT_FOUND", "Route not found");
});

mongoose.connect(MONGODB_URI)
.then(async () => {
  await seedDefaultInstitutes();
  console.log("MongoDB Connected");

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });

})
.catch((err) => {
  console.error("MongoDB connection failed", err);
  process.exitCode = 1;
});
