import { JsonRpcProvider } from "ethers"
import { RPC_URL } from "@/lib/config"

let provider: JsonRpcProvider | null = null

export function getRpcProvider() {
  if (!provider) {
    provider = new JsonRpcProvider(RPC_URL)
  }

  return provider
}
