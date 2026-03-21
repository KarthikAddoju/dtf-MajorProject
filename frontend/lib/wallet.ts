import { BrowserProvider, type JsonRpcSigner } from "ethers"
import { CHAIN_ID, RPC_URL } from "@/lib/config"
import type { AuthFlowState } from "@/lib/types"

interface EthereumProviderLike {
  isMetaMask?: boolean
  providers?: EthereumProviderLike[]
  on?: (event: string, listener: (...args: unknown[]) => void) => void
  removeListener?: (event: string, listener: (...args: unknown[]) => void) => void
  request: (args: { method: string; params?: unknown[] | object }) => Promise<unknown>
}

declare global {
  interface Window {
    ethereum?: EthereumProviderLike
  }
}

export interface ConnectedWallet {
  provider: BrowserProvider
  signer: JsonRpcSigner
  address: string
  chainId: number
  isSupportedNetwork: boolean
}

export class WalletConnectionError extends Error {
  code: string

  constructor(message: string, code: string) {
    super(message)
    this.name = "WalletConnectionError"
    this.code = code
  }
}

function getErrorCode(error: unknown) {
  if (!error || typeof error !== "object" || !("code" in error)) {
    return undefined
  }

  const { code } = error as { code?: unknown }

  return typeof code === "string" || typeof code === "number" ? code : undefined
}

export function isWalletActionRejected(error: unknown) {
  if (error instanceof WalletConnectionError && error.code === "USER_REJECTED") {
    return true
  }

  const code = getErrorCode(error)

  if (code === 4001 || code === "ACTION_REJECTED") {
    return true
  }

  if (!(error instanceof Error)) {
    return false
  }

  const normalizedMessage = error.message.toLowerCase()

  return (
    normalizedMessage.includes("user rejected") ||
    normalizedMessage.includes("action_rejected") ||
    normalizedMessage.includes("rejectallapprovals")
  )
}

const SUPPORTED_CHAIN_IDS = new Set([CHAIN_ID])
const HARDHAT_CHAIN_PARAMETERS = {
  chainId: `0x${CHAIN_ID.toString(16)}`,
  chainName: "DACS Local Chain",
  nativeCurrency: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: [RPC_URL],
}

export function isSupportedChainId(chainId: number | null) {
  return chainId !== null && SUPPORTED_CHAIN_IDS.has(chainId)
}

export function getWalletNetworkLabel(chainId: number | null) {
  if (chainId === null) {
    return "Wallet disconnected"
  }

  if (SUPPORTED_CHAIN_IDS.has(chainId)) {
    return "DACS Local Chain"
  }

  return `Unsupported Chain (${chainId})`
}

export function getWalletSignInLabel(
  authFlowState: AuthFlowState,
  hasConnectedWallet: boolean
) {
  switch (authFlowState) {
    case "connecting_wallet":
      return "Connecting Wallet..."
    case "awaiting_signature":
      return "Awaiting Signature..."
    case "wallet_connected":
      return "Complete Sign-In"
    case "authenticated":
      return "Signed In"
    default:
      return hasConnectedWallet ? "Complete Sign-In" : "Connect & Sign In"
  }
}

function normalizeAddress(address: string) {
  return address.toLowerCase()
}

function getInjectedProvider() {
  if (typeof window === "undefined") {
    return null
  }

  const ethereum = window.ethereum

  if (!ethereum) {
    return null
  }

  const injectedProviders = Array.isArray(ethereum.providers)
    ? ethereum.providers
    : [ethereum]

  const metaMaskProvider =
    injectedProviders.find((provider) => provider.isMetaMask) ?? null

  return metaMaskProvider ?? ethereum
}

export function hasInjectedWalletProvider() {
  return getInjectedProvider() !== null
}

function ensureEthereumProvider() {
  const ethereum = getInjectedProvider()

  if (!ethereum) {
    throw new WalletConnectionError(
      "MetaMask was not detected in this browser.",
      "METAMASK_MISSING"
    )
  }

  return ethereum
}

async function buildWalletSnapshot(provider: BrowserProvider) {
  const signer = await provider.getSigner()
  const address = normalizeAddress(await signer.getAddress())
  const network = await provider.getNetwork()
  const chainId = Number(network.chainId)

  return {
    provider,
    signer,
    address,
    chainId,
    isSupportedNetwork: SUPPORTED_CHAIN_IDS.has(chainId),
  }
}

async function trySwitchToConfiguredNetwork() {
  const ethereum = ensureEthereumProvider()

  try {
    await ethereum.request({
      method: "wallet_switchEthereumChain",
      params: [{ chainId: HARDHAT_CHAIN_PARAMETERS.chainId }],
    })
  } catch (error) {
    const switchError = error as { code?: number }

    if (switchError.code === 4902) {
      await ethereum.request({
        method: "wallet_addEthereumChain",
        params: [HARDHAT_CHAIN_PARAMETERS],
      })
      return
    }

    throw new WalletConnectionError(
      "Please switch MetaMask to the configured DACS network.",
      "UNSUPPORTED_NETWORK"
    )
  }
}

export async function connectWallet(): Promise<ConnectedWallet> {
  const ethereum = ensureEthereumProvider()

  const provider = new BrowserProvider(ethereum)

  try {
    await provider.send("eth_requestAccounts", [])
  } catch (error) {
    if (isWalletActionRejected(error)) {
      throw new WalletConnectionError(
        "Wallet connection was canceled.",
        "USER_REJECTED"
      )
    }

    throw error
  }

  let wallet = await buildWalletSnapshot(provider)

  if (!wallet.isSupportedNetwork) {
    await trySwitchToConfiguredNetwork()
    wallet = await buildWalletSnapshot(new BrowserProvider(ensureEthereumProvider()))
  }

  if (!wallet.isSupportedNetwork) {
    throw new WalletConnectionError(
      "Please switch MetaMask to the configured DACS network.",
      "UNSUPPORTED_NETWORK"
    )
  }

  return wallet
}

export async function getConnectedWallet(): Promise<ConnectedWallet | null> {
  const ethereum = getInjectedProvider()

  if (!ethereum) {
    return null
  }

  const provider = new BrowserProvider(ethereum)
  const accounts = (await provider.send("eth_accounts", [])) as string[]

  if (accounts.length === 0) {
    return null
  }

  return buildWalletSnapshot(provider)
}
