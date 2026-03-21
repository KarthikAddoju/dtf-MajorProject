import { ethers } from "hardhat";
import fs from "node:fs/promises";
import path from "node:path";

function buildInstituteHash(shortCode: string) {
  return ethers.id(`DACS_INSTITUTE:${shortCode.trim().toUpperCase()}`);
}

async function main() {
  console.log("🚀 Starting testMint script...\n");

  const [deployer, student] = await ethers.getSigners();
  const deploymentFilePath = path.resolve(
    __dirname,
    "..",
    "deployments",
    "localhost.json"
  );
  const deployment = JSON.parse(await fs.readFile(deploymentFilePath, "utf8")) as {
    mintControllerAddress: string;
    poctAddress: string;
    eduAddress: string;
    verifier?: string;
    instituteShortCodes?: string[];
  };
  const instituteShortCode = deployment.instituteShortCodes?.[0] ?? "IITH";

  console.log("Deployer:", deployer.address);
  console.log("Student:", student.address);
  console.log("Verifier:", deployment.verifier ?? deployer.address);

  const mintController = await ethers.getContractAt(
    "MintController",
    deployment.mintControllerAddress
  );
  const poct = await ethers.getContractAt("PoCT", deployment.poctAddress);
  const edu = await ethers.getContractAt("EDUToken", deployment.eduAddress);

  const publicProofCid = "QmTestPublicProofCID123";
  const eduAmount = ethers.parseEther("10");
  const instituteHash = buildInstituteHash(instituteShortCode);
  const claimsRoot = ethers.keccak256(
    ethers.toUtf8Bytes("sample-claims-root")
  );

  console.log("\nCalling dualMint...");

  const tx = await mintController.connect(deployer).dualMint(
    student.address,
    publicProofCid,
    claimsRoot,
    instituteHash,
    eduAmount,
    0
  );

  await tx.wait();

  const eduBalance = await edu.balanceOf(student.address);
  const poctBalance = await poct.balanceOf(student.address);

  console.log("\n✅ Mint Successful!");
  console.log("Student EDU balance:", eduBalance.toString());
  console.log("Student PoCT balance:", poctBalance.toString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Error:", error);
    process.exit(1);
  });
