import {
  eduAddress,
  mintControllerAddress,
  poctAddress,
  provider,
} from "../services/blockchain";

export interface BlockchainReadiness {
  status: "connected" | "degraded";
  chainId: number | null;
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

export async function getBlockchainReadiness(): Promise<BlockchainReadiness> {
  const warnings: string[] = [];

  const [networkResult, blockNumberResult] = await Promise.allSettled([
    provider.getNetwork(),
    provider.getBlockNumber(),
  ]);

  if (networkResult.status !== "fulfilled" || blockNumberResult.status !== "fulfilled") {
    warnings.push(
      "Could not reach the configured RPC endpoint. Start Hardhat or confirm RPC_URL is correct."
    );

    return {
      status: "degraded",
      chainId: null,
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

  const chainId = Number(networkResult.value.chainId);
  const blockNumber = blockNumberResult.value;

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
      `No contract code found at POCT_ADDRESS (${poctAddress}) on chain ${chainId}.`
    );
  }

  if (!eduDeployed) {
    warnings.push(
      `No contract code found at EDU_ADDRESS (${eduAddress}) on chain ${chainId}.`
    );
  }

  if (!mintControllerDeployed) {
    warnings.push(
      `No contract code found at MINT_CONTROLLER_ADDRESS (${mintControllerAddress}) on chain ${chainId}.`
    );
  }

  const contractsReady = poctDeployed && eduDeployed && mintControllerDeployed;

  return {
    status: contractsReady ? "connected" : "degraded",
    chainId,
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
