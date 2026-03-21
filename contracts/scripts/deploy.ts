import fs from "node:fs/promises";
import path from "node:path";
import { ethers } from "hardhat";
import hre from "hardhat";

const DEFAULT_INSTITUTE_SHORT_CODES = ["IITH", "JNTUH", "OU", "BITS", "NITW"];

function buildInstituteHash(shortCode: string) {
  return ethers.id(`DACS_INSTITUTE:${shortCode.trim().toUpperCase()}`);
}

async function writeDeploymentArtifacts(deployment: Record<string, unknown>) {
  const deploymentsDirectory = path.resolve(__dirname, "..", "deployments");
  const deploymentFilePath = path.join(
    deploymentsDirectory,
    `${hre.network.name}.json`
  );
  const envSnippetFilePath = path.join(
    deploymentsDirectory,
    `${hre.network.name}.env`
  );

  await fs.mkdir(deploymentsDirectory, { recursive: true });
  await fs.writeFile(
    deploymentFilePath,
    `${JSON.stringify(deployment, null, 2)}\n`,
    "utf8"
  );

  const envSnippet = [
    `RPC_URL=http://127.0.0.1:8545`,
    `ADMIN_WALLET_ADDRESSES=${deployment.admin}`,
    `POCT_ADDRESS=${deployment.poctAddress}`,
    `EDU_ADDRESS=${deployment.eduAddress}`,
    `MINT_CONTROLLER_ADDRESS=${deployment.mintControllerAddress}`,
    `NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545`,
    `NEXT_PUBLIC_CHAIN_ID=${deployment.chainId}`,
    `NEXT_PUBLIC_POCT_ADDRESS=${deployment.poctAddress}`,
    `NEXT_PUBLIC_EDU_ADDRESS=${deployment.eduAddress}`,
    `NEXT_PUBLIC_MINT_CONTROLLER_ADDRESS=${deployment.mintControllerAddress}`,
  ].join("\n");

  await fs.writeFile(envSnippetFilePath, `${envSnippet}\n`, "utf8");

  console.log("📝 Deployment JSON:", deploymentFilePath);
  console.log("📝 Env snippet:", envSnippetFilePath);
}

async function main() {
  console.log("🚀 Starting Deployment...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  const adminAddress =
    process.env.MULTISIG_ADMIN_ADDRESS?.trim() || deployer.address;
  const initialVerifierAddress =
    process.env.INITIAL_VERIFIER_ADDRESS?.trim() || adminAddress;
  const instituteShortCodes = (
    process.env.INITIAL_INSTITUTE_SHORT_CODES ?? DEFAULT_INSTITUTE_SHORT_CODES.join(",")
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString(), "\n");
  console.log("Admin address:", adminAddress);
  console.log("Initial verifier:", initialVerifierAddress, "\n");

  // Deploy PoCT
  const PoCT = await ethers.getContractFactory("PoCT");
  const poct = await PoCT.deploy();
  await poct.waitForDeployment();
  console.log("✅ PoCT deployed to:", await poct.getAddress());

  // Deploy EDU Token
  const EDUToken = await ethers.getContractFactory("EDUToken");
  const edu = await EDUToken.deploy();
  await edu.waitForDeployment();
  console.log("✅ EDUToken deployed to:", await edu.getAddress());

  // Deploy MintController
  const MintController = await ethers.getContractFactory("MintController");
  const controller = await MintController.deploy(
    adminAddress,
    await poct.getAddress(),
    await edu.getAddress()
  );
  await controller.waitForDeployment();
  console.log("✅ MintController deployed to:", await controller.getAddress());

  // Connect contracts
  const controllerAddress = await controller.getAddress();
  await poct.setMintController(controllerAddress);
  await edu.setMintController(controllerAddress);

  if (adminAddress.toLowerCase() === deployer.address.toLowerCase()) {
    for (const shortCode of instituteShortCodes) {
      await controller.setInstituteVerifier(
        buildInstituteHash(shortCode),
        initialVerifierAddress,
        true
      );
    }
  } else {
    console.log(
      "Skipping automatic institute verifier bootstrap because the configured admin is not the deployer."
    );
  }

  const deployment = {
    network: hre.network.name,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    admin: adminAddress,
    verifier: initialVerifierAddress,
    instituteShortCodes,
    poctAddress: await poct.getAddress(),
    eduAddress: await edu.getAddress(),
    mintControllerAddress: controllerAddress,
  };

  await writeDeploymentArtifacts(deployment);

  console.log("\n🔗 Contracts connected successfully!");
  if (adminAddress.toLowerCase() === deployer.address.toLowerCase()) {
    console.log("🏫 Seed verifier authorization applied for:", instituteShortCodes.join(", "));
  }
  console.log("🎉 Full System Deployment Complete\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
