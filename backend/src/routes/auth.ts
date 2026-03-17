import { randomBytes } from "node:crypto";
import { Router } from "express";
import { isAddress, verifyMessage } from "ethers";
import jwt from "jsonwebtoken";
import { authenticate, type AuthRequest } from "../middleware/authMiddleware";
import { sendError, sendSuccess } from "../lib/api";

const router = Router();

const JWT_SECRET = process.env.JWT_SECRET ?? "supersecret";
const ADMIN_ADDRESS =
  process.env.ADMIN_WALLET_ADDRESS?.toLowerCase() ??
  "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266";
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const loginChallenges = new Map<string, { message: string; expiresAt: number }>();

function normalizeAddress(address: string) {
  return address.toLowerCase();
}

// Step 1: Generate login challenge
router.post("/challenge", (req, res) => {
  const { address } = req.body;

  if (typeof address !== "string" || !isAddress(address)) {
    return sendError(
      res,
      400,
      "VALIDATION_ERROR",
      "A valid wallet address is required"
    );
  }

  const normalizedAddress = normalizeAddress(address);
  const message = [
    `Login to DACS with wallet: ${normalizedAddress}`,
    `Nonce: ${randomBytes(16).toString("hex")}`,
  ].join("\n");
  const expiresAt = Date.now() + CHALLENGE_TTL_MS;

  loginChallenges.set(normalizedAddress, { message, expiresAt });

  return sendSuccess(res, { message, expiresAt });
});

// Step 2: Verify signature
router.post("/verify", (req, res) => {
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

  const normalizedAddress = normalizeAddress(address);
  const pendingChallenge = loginChallenges.get(normalizedAddress);

  if (!pendingChallenge || pendingChallenge.message !== message) {
    return sendError(
      res,
      401,
      "INVALID_CHALLENGE",
      "Challenge not found or already used"
    );
  }

  if (pendingChallenge.expiresAt < Date.now()) {
    loginChallenges.delete(normalizedAddress);
    return sendError(res, 401, "CHALLENGE_EXPIRED", "Challenge expired");
  }

  let recoveredAddress: string;

  try {
    recoveredAddress = normalizeAddress(verifyMessage(message, signature));
  } catch {
    return sendError(res, 401, "INVALID_SIGNATURE", "Invalid signature");
  }

  if (recoveredAddress !== normalizedAddress) {
    return sendError(res, 401, "INVALID_SIGNATURE", "Invalid signature");
  }

  loginChallenges.delete(normalizedAddress);

  const role = normalizedAddress === ADMIN_ADDRESS ? "admin" : "student";
  const token = jwt.sign(
    { address: normalizedAddress, role },
    JWT_SECRET,
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
