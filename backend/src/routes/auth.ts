import { Router } from "express";
import { isAddress } from "ethers";
import jwt from "jsonwebtoken";
import { generateNonce, SiweMessage } from "siwe";
import { runtimeConfig, isAdminWallet, isBootstrapVerifierWallet } from "../config/runtime";
import { authenticate, type AuthRequest } from "../middleware/authMiddleware";
import { sendError, sendSuccess } from "../lib/api";
import { LoginChallengeModel } from "../models/LoginChallenge";
import { InstituteModel } from "../models/Institute";
import { normalizeWalletAddress } from "../lib/institutes";

const router = Router();
const CHALLENGE_TTL_MS = 5 * 60 * 1000;
const expectedFrontendUrl = new URL(runtimeConfig.frontendOrigin);
const expectedSiweDomain = expectedFrontendUrl.host;
const expectedSiweOrigin = expectedFrontendUrl.origin;

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
  const nonce = generateNonce();
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS);

  await LoginChallengeModel.deleteMany({
    address: normalizedAddress,
    consumedAt: null,
  });

  await LoginChallengeModel.create({
    address: normalizedAddress,
    nonce,
    ipAddress: req.ip,
    userAgent:
      typeof req.headers["user-agent"] === "string"
        ? req.headers["user-agent"]
        : undefined,
    expiresAt,
  });

  return sendSuccess(res, { nonce, expiresAt: expiresAt.getTime() });
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

  let siweMessage;
  try {
    siweMessage = new SiweMessage(message);
  } catch (error) {
    return sendError(res, 400, "INVALID_MESSAGE", "Invalid SIWE message format");
  }

  try {
    const { data: fields } = await siweMessage.verify({ signature });

    if (normalizeWalletAddress(fields.address) !== normalizedAddress) {
      return sendError(res, 401, "INVALID_SIGNATURE", "Message address does not match requested address");
    }

    if (fields.domain !== expectedSiweDomain) {
      return sendError(
        res,
        401,
        "INVALID_MESSAGE",
        "SIWE domain did not match the configured frontend host"
      );
    }

    let normalizedUriOrigin: string;
    try {
      normalizedUriOrigin = new URL(fields.uri).origin;
    } catch {
      return sendError(res, 401, "INVALID_MESSAGE", "SIWE URI was not a valid origin");
    }

    if (normalizedUriOrigin !== expectedSiweOrigin) {
      return sendError(
        res,
        401,
        "INVALID_MESSAGE",
        "SIWE URI did not match the configured frontend origin"
      );
    }

    const pendingChallenge = await LoginChallengeModel.findOneAndUpdate(
      { address: normalizedAddress, nonce: fields.nonce, consumedAt: null },
      { $set: { consumedAt: new Date() } },
      { sort: { createdAt: -1 } }
    );

    if (!pendingChallenge) {
      return sendError(res, 401, "INVALID_CHALLENGE", "Challenge not found or already used");
    }

    if (pendingChallenge.expiresAt.getTime() < Date.now()) {
      return sendError(res, 401, "CHALLENGE_EXPIRED", "Challenge expired");
    }

    const role = await resolveUserRole(normalizedAddress);
    const token = jwt.sign(
      { address: normalizedAddress, role },
      runtimeConfig.jwtSecret,
      { algorithm: "HS256", expiresIn: "1h" }
    );

    return sendSuccess(res, {
      token,
      address: normalizedAddress,
      role,
    });
  } catch (error) {
    return sendError(res, 401, "INVALID_SIGNATURE", "Invalid SIWE signature or message verification failed");
  }
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
