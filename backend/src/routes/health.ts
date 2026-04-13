import { Router } from "express";
import mongoose from "mongoose";
import { sendSuccess } from "../lib/api";
import { runtimeConfig } from "../config/runtime";
import { getBlockchainReadiness } from "../lib/blockchainReadiness";

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
  const blockchainReadiness = await getBlockchainReadiness();

  const overallStatus =
    databaseState === "connected" && blockchainReadiness.status === "connected"
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
        status: blockchainReadiness.status,
        chainId: blockchainReadiness.chainId,
        blockNumber: blockchainReadiness.blockNumber,
        contractsReady: blockchainReadiness.contractsReady,
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
    contracts: blockchainReadiness.contracts,
  });
});

export default router;
