"use client"

import { useEffect, useRef, useState } from "react"
import { JsonRpcProvider } from "ethers"

export function useBlockNumber(intervalMs = 15_000) {
  const [blockNumber, setBlockNumber] = useState<number | null>(null)
  const [isLive, setIsLive] = useState(false)
  const providerRef = useRef<JsonRpcProvider | null>(null)

  useEffect(() => {
    let mounted = true

    async function fetchBlock() {
      try {
        // Lazily get the RPC URL to avoid throwing at module eval time
        const rpcUrl = process.env.NEXT_PUBLIC_RPC_URL?.trim()
        if (!rpcUrl) {
          if (mounted) setIsLive(false)
          return
        }

        if (!providerRef.current) {
          providerRef.current = new JsonRpcProvider(rpcUrl)
        }

        const block = await providerRef.current.getBlockNumber()
        if (mounted) {
          setBlockNumber(block)
          setIsLive(true)
        }
      } catch {
        if (mounted) {
          setIsLive(false)
          providerRef.current = null
        }
      }
    }

    void fetchBlock()
    const id = setInterval(() => void fetchBlock(), intervalMs)

    return () => {
      mounted = false
      clearInterval(id)
    }
  }, [intervalMs])

  return { blockNumber, isLive }
}
