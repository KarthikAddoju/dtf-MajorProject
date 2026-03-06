"use client";

console.log("THIS IS MY NAVBAR FILE");

import Link from "next/link";
import WalletConnect from "./WalletConnect";

export default function Navbar() {
  return (
    <nav className="bg-gray-900 text-white px-6 py-4 flex justify-between items-center">
      <h1 className="font-bold text-lg">DACS</h1>

      <div className="flex items-center space-x-6">
        <Link href="/">Home</Link>
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/verifier">Verifier</Link>
        <Link href="/admin">Admin</Link>
        <Link href="/verify">Verify</Link>

        <WalletConnect />
      </div>
    </nav>
  );
}