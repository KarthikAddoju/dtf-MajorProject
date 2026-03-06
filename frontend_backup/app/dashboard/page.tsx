"use client";

import { useEffect, useState } from "react";
import { ethers } from "ethers";
import { EDU_ADDRESS, EDU_ABI } from "@/lib/contracts/edu";

interface JWTPayload {
  address: string;
  role: string;
  exp: number;
  iat: number;
}

// 🔹 Safe synchronous token reader
function getToken(): JWTPayload | null {
  if (typeof window === "undefined") return null;

  const token = localStorage.getItem("token");
  if (!token) return null;

  try {
    return JSON.parse(atob(token.split(".")[1])) as JWTPayload;
  } catch {
    return null;
  }
}

export default function Dashboard() {
  // ✅ Lazy initialization (NO effect needed)
  const [tokenData] = useState<JWTPayload | null>(() => getToken());
  const [eduBalance, setEduBalance] = useState<string>("0");

  // ✅ Only fetch blockchain data in effect
  useEffect(() => {
    if (!tokenData) return;
  
    const address = tokenData.address; // 🔥 Fix here
  
    async function fetchBalance() {
      if (!window.ethereum) return;
  
      const provider = new ethers.BrowserProvider(window.ethereum);
  
      const contract = new ethers.Contract(
        EDU_ADDRESS,
        EDU_ABI,
        provider
      );
  
      const balance = await contract.balanceOf(address);
      const formatted = ethers.formatUnits(balance, 18);
  
      setEduBalance(formatted);
    }
  
    fetchBalance();
  }, [tokenData]);

  if (!tokenData) {
    return (
      <div className="p-10">
        <p className="text-red-400">Not authenticated</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-[#0f172a] via-[#0b1120] to-black text-white px-8 py-12">
      
      <div className="max-w-4xl mx-auto space-y-8">
        
        <h1 className="text-4xl font-bold tracking-tight">
          Dashboard
        </h1>
  
        <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 space-y-6 shadow-xl">
          
          <div className="flex justify-between items-center">
            <div>
              <p className="text-sm text-gray-400">Wallet</p>
              <p className="font-mono text-green-400 text-lg">
                {tokenData.address}
              </p>
            </div>
  
            <span
              className={`px-4 py-1 rounded-full text-sm font-semibold ${
                tokenData.role === "admin"
                  ? "bg-purple-600/30 text-purple-400"
                  : "bg-blue-600/30 text-blue-400"
              }`}
            >
              {tokenData.role.toUpperCase()}
            </span>
          </div>
  
          <div className="grid grid-cols-2 gap-6">
            
            <div className="bg-black/30 rounded-xl p-6 border border-white/5">
              <p className="text-gray-400 text-sm">EDU Balance</p>
              <p className="text-2xl font-bold text-yellow-400">
                {eduBalance} EDU
              </p>
            </div>
  
            <div className="bg-black/30 rounded-xl p-6 border border-white/5">
              <p className="text-gray-400 text-sm">Token Expires</p>
              <p className="text-blue-400 font-medium">
                {new Date(tokenData.exp * 1000).toLocaleString()}
              </p>
            </div>
  
          </div>
  
        </div>
  
      </div>
    </div>
  );
}