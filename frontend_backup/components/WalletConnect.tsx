"use client";

import { useState } from "react";
import { BrowserProvider } from "ethers";

export default function WalletConnect() {
  const [address, setAddress] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      if (!window.ethereum) {
        alert("MetaMask not detected");
        return;
      }

      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const signer = await provider.getSigner();
      const userAddress = await signer.getAddress();

      // Step 1: Request challenge
      const challengeRes = await fetch("http://localhost:4000/api/auth/challenge", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ address: userAddress }),
      });

      const { message } = await challengeRes.json();

      // Step 2: Sign message
      const signature = await signer.signMessage(message);

      // Step 3: Send signature to backend
      const verifyRes = await fetch("http://localhost:4000/api/auth/verify", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          address: userAddress,
          signature,
          message,
        }),
      });

      const data = await verifyRes.json();

      if (data.token) {
        localStorage.setItem("token", data.token);
        setAddress(userAddress);
        console.log("JWT stored:", data.token);
      } else {
        alert("Authentication failed");
      }

    } catch (error) {
      console.error("Login error:", error);
    }
  };

  return (
    <div>
      {address ? (
        <span className="bg-green-600 px-3 py-1 rounded text-sm">
          {address.slice(0, 6)}...{address.slice(-4)}
        </span>
      ) : (
        <button
          onClick={handleConnect}
          className="bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded text-sm"
        >
          Connect Wallet
        </button>
      )}
    </div>
  );
}