import { Router } from "express";
import mongoose from "mongoose";
import { sendSuccess } from "../lib/api";
import { runtimeConfig } from "../config/runtime";
import {
  eduAddress,
  mintControllerAddress,
  poctAddress,
  provider,
} from "../services/blockchain";

const router = Router();

function getDatabaseStateLabel(readyState: number) {
  switch (readyState) {
    case 1:
      return "connected";
    case 2:
      return "connecting";
    case 3:
      return "disconnecting";
    default:
      return "disconnected";
  }
}

router.get("/", async (_req, res) => {
  const checkedAt = new Date().toISOString();
  const databaseState = getDatabaseStateLabel(mongoose.connection.readyState);
  const ipfsConfigured = runtimeConfig.pinataJwt !== null;
  const authConfigured = runtimeConfig.jwtSecret.trim().length > 0;

  let blockchainStatus: "connected" | "degraded" = "degraded";
  let chainId: number | null = null;
  let blockNumber: number | null = null;

  try {
    const [network, latestBlock] = await Promise.all([
      provider.getNetwork(),
      provider.getBlockNumber(),
    ]);

    blockchainStatus = "connected";
    chainId = Number(network.chainId);
    blockNumber = latestBlock;
  } catch {
    blockchainStatus = "degraded";
  }

  const overallStatus =
    databaseState === "connected" && blockchainStatus === "connected"
      ? "ok"
      : "degraded";

  return sendSuccess(res, {
    status: overallStatus,
    checkedAt,
    services: {
      api: {
        status: "ok",
      },
      database: {
        status: databaseState === "connected" ? "ok" : "degraded",
        state: databaseState,
      },
      blockchain: {
        status: blockchainStatus,
        chainId,
        blockNumber,
      },
      ipfs: {
        status: ipfsConfigured ? "configured" : "missing",
      },
      auth: {
        status: authConfigured ? "configured" : "warning",
      },
      evidenceVault: {
        status:
          runtimeConfig.evidenceEncryptionKey.length === 32
            ? "configured"
            : "warning",
      },
    },
    contracts: {
      poctAddress,
      eduAddress,
      mintControllerAddress,
    },
  });
});

export default router;
