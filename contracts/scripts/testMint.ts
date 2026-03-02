console.log("FILE LOADED");
import { ethers } from "hardhat";

async function main() {

  console.log("🚀 Starting testMint script...\n");

  const [deployer, student, verifier] = await ethers.getSigners();

  console.log("Deployer:", deployer.address);
  console.log("Student:", student.address);
  console.log("Verifier:", verifier.address);

  const controllerAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";
  const poctAddress = "0x5FbDB2315678afecb367f032d93F642f64180aa3";
  const eduAddress = "0xe7f1725E7734CE288F8367e1Bb143E90bb3F0512";

  const mintController = await ethers.getContractAt("MintController", controllerAddress);
  const poct = await ethers.getContractAt("PoCT", poctAddress);
  const edu = await ethers.getContractAt("EDUToken", eduAddress);

  console.log("\nAuthorizing verifier...");
  await mintController.connect(deployer).setVerifier(verifier.address, true);

  const cid = "QmTestCID123";
  const eduAmount = ethers.parseEther("10");

  const network = await ethers.provider.getNetwork();
  const chainId = network.chainId;

  const coder = ethers.AbiCoder.defaultAbiCoder();

  const encoded = coder.encode(
    ["address", "uint256", "address", "string", "uint256"],
    [
      controllerAddress,
      chainId,
      student.address,
      cid,
      eduAmount
    ]
  );
  
  const messageHash = ethers.keccak256(encoded);
  
  const signature = await verifier.signMessage(
    ethers.getBytes(messageHash)
  );

  console.log("\nCalling dualMint...");

  const tx = await mintController.connect(deployer).dualMint(
    student.address,
    cid,
    eduAmount,
    verifier.address,
    signature
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