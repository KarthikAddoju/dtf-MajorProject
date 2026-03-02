import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Starting Deployment...\n");

  const [deployer] = await ethers.getSigners();
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

  console.log("\n🔗 Contracts connected successfully!");
  console.log("🎉 Full System Deployment Complete\n");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});