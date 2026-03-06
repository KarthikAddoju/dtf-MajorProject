"use client"

import { useState, useEffect } from "react"
import { Navbar } from "@/components/Navbar"
import { connectWallet, getConnectedWallet } from "@/lib/wallet"
import { toast } from "sonner"

export default function ClientLayout({
  children,
}: {
  children: React.ReactNode
}) {

  const [walletAddress, setWalletAddress] = useState<string | null>(null)

  async function handleConnectWallet() {
    const result = await connectWallet()

    if (result) {
      setWalletAddress(result.address)

      toast.success("Wallet connected")
    }
  }

  // 🔹 auto reconnect
  useEffect(() => {
    async function checkWallet() {
      const result = await getConnectedWallet()

      if (result) {
        setWalletAddress(result.address)
      }
    }

    checkWallet()
  }, [])

  return (
    <>
      <Navbar
        walletAddress={walletAddress}
        isConnected={!!walletAddress}
        onConnectWallet={handleConnectWallet}
      />

      {children}
    </>
  )
}