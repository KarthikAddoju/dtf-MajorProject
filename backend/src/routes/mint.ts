import express from "express";
import { ethers } from "ethers";
import { authenticate, authorize } from "../middleware/authMiddleware";
const router = express.Router();

// Hardhat Local Network
const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");

// Use Account #0 as backend signer
const privateKey =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80";

const wallet = new ethers.Wallet(privateKey, provider);

// IMPORTANT: Replace with your deployed MintController address
const controllerAddress = "0x9fE46736679d2D9a65F0992F2272dE9f3c7fa6e0";

const controllerABI = [
  "function dualMint(address student,string cid,uint256 eduAmount,address verifier,bytes signature) external"
];

const contract = new ethers.Contract(
  controllerAddress,
  controllerABI,
  wallet
);

router.post(
  "/",
  authenticate,
  authorize("admin"),
  async (req, res) => {
    try {
      const { student, cid, eduAmount } = req.body;

      const verifier = wallet.address;
      const chainId = 31337;

      // 🔥 Convert to 18 decimals properly
      const parsedAmount = ethers.parseUnits(
        eduAmount.toString(),
        18
      );

      const coder = ethers.AbiCoder.defaultAbiCoder();

      // ⚠️ IMPORTANT: Use parsedAmount here also
      const encoded = coder.encode(
        ["address", "uint256", "address", "string", "uint256"],
        [controllerAddress, chainId, student, cid, parsedAmount]
      );

      const messageHash = ethers.keccak256(encoded);

      const signature = await wallet.signMessage(
        ethers.getBytes(messageHash)
      );

      const tx = await contract.dualMint(
        student,
        cid,
        parsedAmount,   // 🔥 use parsedAmount
        verifier,
        signature
      );

      await tx.wait();

      res.json({
        success: true,
        txHash: tx.hash
      });

    } catch (err: any) {
      console.error(err);
      res.status(500).json({
        success: false,
        error: err.message
      });
    }
  }
);

export default router;