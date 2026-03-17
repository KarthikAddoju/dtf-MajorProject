import fs from "node:fs/promises";
import path from "node:path";
import { ethers } from "hardhat";
import hre from "hardhat";

const DEFAULT_BACKEND_SIGNER_PRIVATE_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

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
    `BACKEND_SIGNER_PRIVATE_KEY=${DEFAULT_BACKEND_SIGNER_PRIVATE_KEY}`,
    `ADMIN_WALLET_ADDRESS=${deployment.deployer}`,
    `POCT_ADDRESS=${deployment.poctAddress}`,
    `EDU_ADDRESS=${deployment.eduAddress}`,
    `MINT_CONTROLLER_ADDRESS=${deployment.mintControllerAddress}`,
    `NEXT_PUBLIC_RPC_URL=http://127.0.0.1:8545`,
    `NEXT_PUBLIC_POCT_ADDRESS=${deployment.poctAddress}`,
    `NEXT_PUBLIC_EDU_ADDRESS=${deployment.eduAddress}`,
  ].join("\n");

  await fs.writeFile(envSnippetFilePath, `${envSnippet}\n`, "utf8");

  console.log("📝 Deployment JSON:", deploymentFilePath);
  console.log("📝 Env snippet:", envSnippetFilePath);
}

async function main() {
  console.log("🚀 Starting Deployment...\n");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  console.log("Deploying with account:", deployer.address);
  console.log("Account balance:", (await deployer.provider.getBalance(deployer.address)).toString(), "\n");

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
    await poct.getAddress(),
    await edu.getAddress()
  );
  await controller.waitForDeployment();
  console.log("✅ MintController deployed to:", await controller.getAddress());

  // Connect contracts
  const controllerAddress = await controller.getAddress();
  await poct.setMintController(controllerAddress);
  await edu.setMintController(controllerAddress);
  await controller.setVerifier(deployer.address, true);

  const deployment = {
    network: hre.network.name,
    chainId: Number(network.chainId),
    deployedAt: new Date().toISOString(),
    deployer: deployer.address,
    verifier: deployer.address,
    poctAddress: await poct.getAddress(),
    eduAddress: await edu.getAddress(),
    mintControllerAddress: controllerAddress,
  };

  await writeDeploymentArtifacts(deployment);

  console.log("\n🔗 Contracts connected successfully!");
  console.log("🎉 Full System Deployment Complete\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
