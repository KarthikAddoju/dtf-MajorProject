import { randomBytes } from "node:crypto";
import { Router } from "express";
import { isAddress, verifyMessage } from "ethers";
import jwt from "jsonwebtoken";
import { runtimeConfig, isAdminWallet, isBootstrapVerifierWallet } from "../config/runtime";
import { authenticate, type AuthRequest } from "../middleware/authMiddleware";
import { sendError, sendSuccess } from "../lib/api";
import { LoginChallengeModel } from "../models/LoginChallenge";
import { InstituteModel } from "../models/Institute";
import { normalizeWalletAddress } from "../lib/institutes";

const router = Router();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

async function resolveUserRole(address: string) {
  const normalizedAddress = normalizeWalletAddress(address);

  if (isAdminWallet(normalizedAddress)) {
    return "admin" as const;
  }

  if (isBootstrapVerifierWallet(normalizedAddress)) {
    return "verifier" as const;
  }

  const institute = await InstituteModel.findOne({
    verifierAddresses: normalizedAddress,
  })
    .select("_id")
    .lean();

  return institute ? ("verifier" as const) : ("student" as const);
}

router.post("/challenge", async (req, res) => {
  const { address } = req.body;

  if (typeof address !== "string" || !isAddress(address)) {
    return sendError(
      res,
      400,
      "VALIDATION_ERROR",
      "A valid wallet address is required"
    );
  }

  const normalizedAddress = normalizeWalletAddress(address);
  const message = [
    `Login to DACS with wallet: ${normalizedAddress}`,
    `Nonce: ${randomBytes(16).toString("hex")}`,
  ].join("\n");
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

  await LoginChallengeModel.deleteMany({
    address: normalizedAddress,
    consumedAt: null,
  });

  await LoginChallengeModel.create({
    address: normalizedAddress,
    message,
    ipAddress: req.ip,
    userAgent:
      typeof req.headers["user-agent"] === "string"
        ? req.headers["user-agent"]
        : undefined,
    expiresAt,
  });

  return sendSuccess(res, { message, expiresAt: expiresAt.getTime() });
});

router.post("/verify", async (req, res) => {
  const { address, signature, message } = req.body;

  if (
    typeof address !== "string" ||
    typeof signature !== "string" ||
    typeof message !== "string" ||
    !isAddress(address)
  ) {
    return sendError(
      res,
      400,
      "VALIDATION_ERROR",
      "Address, signature, and message are required"
    );
  }

  const normalizedAddress = normalizeWalletAddress(address);

  let recoveredAddress: string;

  try {
    recoveredAddress = normalizeWalletAddress(verifyMessage(message, signature));
  } catch {
    return sendError(res, 401, "INVALID_SIGNATURE", "Invalid signature");
  }

  if (recoveredAddress !== normalizedAddress) {
    return sendError(res, 401, "INVALID_SIGNATURE", "Invalid signature");
  }

  // Atomic: find the unconsumed challenge and mark it consumed in one operation
  const pendingChallenge = await LoginChallengeModel.findOneAndUpdate(
    { address: normalizedAddress, message, consumedAt: null },
    { $set: { consumedAt: new Date() } },
    { sort: { createdAt: -1 } }
  );

  if (!pendingChallenge) {
    return sendError(
      res,
      401,
      "INVALID_CHALLENGE",
      "Challenge not found or already used"
    );
  }

  if (pendingChallenge.expiresAt.getTime() < Date.now()) {
    return sendError(res, 401, "CHALLENGE_EXPIRED", "Challenge expired");
  }

  const role = await resolveUserRole(normalizedAddress);
  const token = jwt.sign(
    { address: normalizedAddress, role },
    runtimeConfig.jwtSecret,
    { expiresIn: "1h" }
  );

  return sendSuccess(res, {
    token,
    address: normalizedAddress,
    role,
  });
});

router.get("/me", authenticate, (req: AuthRequest, res) => {
  if (!req.user) {
    return sendError(res, 401, "UNAUTHORIZED", "You must be signed in");
  }

  return sendSuccess(res, {
    user: {
      address: req.user.address,
      role: req.user.role,
    },
  });
});

export default router;
