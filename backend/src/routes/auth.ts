console.log("AUTH ROUTE FILE LOADED");
import { Router } from "express";
import { verifyMessage } from "ethers";
import jwt from "jsonwebtoken";

const router = Router();

const JWT_SECRET = "supersecret";

// Step 1: Generate login challenge
router.post("/challenge", (req, res) => {
  const { address } = req.body;

  const message = `Login to DACS with wallet: ${address}`;

  res.json({ message });
});

// Step 2: Verify signature
router.post("/verify", (req, res) => {
  const { address, signature, message } = req.body;

  const recoveredAddress = verifyMessage(message, signature);

  if (recoveredAddress.toLowerCase() !== address.toLowerCase()) {
    return res.status(401).json({ error: "Invalid signature" });
  }

  // Example role logic (you can improve later)
let role = "student";

if (address.toLowerCase() === "0xf39fd6e51aad88f6f4ce6ab8827279cfffb92266") {
  role = "admin";
}

const token = jwt.sign(
  { address, role },
  JWT_SECRET,
  { expiresIn: "1h" }
);

  res.json({ token });
});

export default router;