import {
  eduAddress,
  mintControllerAddress,
  poctAddress,
  provider,
} from "../services/blockchain";
import { runtimeConfig } from "../config/runtime";

/**
 * Read-only blockchain readiness probe used by startup logs and the health endpoint.
 */
export interface BlockchainReadiness {
  status: "connected" | "degraded";
  chainId: number | null;
  observedChainId: number | null;
  expectedChainId: number;
  chainIdMatchesConfig: boolean;
  persistentDevnet: boolean;
  blockNumber: number | null;
  contractsReady: boolean;
  warnings: string[];
  contracts: {
    poctAddress: string;
    poctDeployed: boolean;
    eduAddress: string;
    eduDeployed: boolean;
    mintControllerAddress: string;
    mintControllerDeployed: boolean;
  };
}

function hasDeployedCode(code: string) {
  return /^0x[0-9a-f]+$/i.test(code) && !/^0x0*$/i.test(code);
}

/**
 * Resolves RPC reachability, observed chain id, and deployed contract availability.
 */
export async function getBlockchainReadiness(): Promise<BlockchainReadiness> {
  const warnings: string[] = [];

  const [networkResult, blockNumberResult] = await Promise.allSettled([
    provider.getNetwork(),
    provider.getBlockNumber(),
  ]);

  if (networkResult.status !== "fulfilled" || blockNumberResult.status !== "fulfilled") {
    warnings.push(
      "Could not reach the configured RPC endpoint. Start the local devnet or confirm RPC_URL is correct."
    );

    return {
      status: "degraded",
      chainId: null,
      observedChainId: null,
      expectedChainId: runtimeConfig.expectedChainId,
      chainIdMatchesConfig: false,
      persistentDevnet: true,
      blockNumber: null,
      contractsReady: false,
      warnings,
      contracts: {
        poctAddress,
        poctDeployed: false,
        eduAddress,
        eduDeployed: false,
        mintControllerAddress,
        mintControllerDeployed: false,
      },
    };
  }

  const observedChainId = Number(networkResult.value.chainId);
  const blockNumber = blockNumberResult.value;
  const expectedChainId = runtimeConfig.expectedChainId;
  const chainIdMatchesConfig = observedChainId === expectedChainId;

  const [poctCodeResult, eduCodeResult, mintControllerCodeResult] =
    await Promise.allSettled([
      provider.getCode(poctAddress),
      provider.getCode(eduAddress),
      provider.getCode(mintControllerAddress),
    ]);

  const poctDeployed =
    poctCodeResult.status === "fulfilled" && hasDeployedCode(poctCodeResult.value);
  const eduDeployed =
    eduCodeResult.status === "fulfilled" && hasDeployedCode(eduCodeResult.value);
  const mintControllerDeployed =
    mintControllerCodeResult.status === "fulfilled" &&
    hasDeployedCode(mintControllerCodeResult.value);

  if (!poctDeployed) {
    warnings.push(
      `No contract code found at POCT_ADDRESS (${poctAddress}) on chain ${observedChainId}.`
    );
  }

  if (!eduDeployed) {
    warnings.push(
      `No contract code found at EDU_ADDRESS (${eduAddress}) on chain ${observedChainId}.`
    );
  }

  if (!mintControllerDeployed) {
    warnings.push(
      `No contract code found at MINT_CONTROLLER_ADDRESS (${mintControllerAddress}) on chain ${observedChainId}.`
    );
  }

  if (!chainIdMatchesConfig) {
    warnings.push(
      `Observed chain ${observedChainId} does not match expected CHAIN_ID ${expectedChainId}. Restart the backend after resyncing env files.`
    );
  }

  const contractsReady = poctDeployed && eduDeployed && mintControllerDeployed;

  return {
    status: contractsReady && chainIdMatchesConfig ? "connected" : "degraded",
    chainId: observedChainId,
    observedChainId,
    expectedChainId,
    chainIdMatchesConfig,
    persistentDevnet: true,
    blockNumber,
    contractsReady,
    warnings,
    contracts: {
      poctAddress,
      poctDeployed,
      eduAddress,
      eduDeployed,
      mintControllerAddress,
      mintControllerDeployed,
    },
  };
}
