import { Router } from "express";
import mongoose from "mongoose";
import { sendSuccess } from "../lib/api";
import { runtimeConfig } from "../config/runtime";
import { getBlockchainReadiness } from "../lib/blockchainReadiness";
import packageJson from "../../package.json";

/**
 * Operational readiness route covering API, database, blockchain, auth, and IPFS configuration.
 */
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

/**
 * Returns the current backend readiness snapshot for local demo diagnostics.
 *
 * Auth: public
 * Input: none
 * Errors: none; degraded states are returned in-band.
 */
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
    version: packageJson.version,
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
        observedChainId: blockchainReadiness.observedChainId,
        expectedChainId: blockchainReadiness.expectedChainId,
        chainIdMatchesConfig: blockchainReadiness.chainIdMatchesConfig,
        persistentDevnet: blockchainReadiness.persistentDevnet,
        blockNumber: blockchainReadiness.blockNumber,
        contractsReady: blockchainReadiness.contractsReady,
        warnings: blockchainReadiness.warnings,
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
