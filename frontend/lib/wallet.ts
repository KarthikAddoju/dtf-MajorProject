import { BrowserProvider, type JsonRpcSigner } from "ethers"

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

const SUPPORTED_CHAIN_IDS = new Set([1337, 31337])
const HARDHAT_CHAIN_PARAMETERS = {
  chainId: "0x7a69",
  chainName: "Hardhat Localhost",
  nativeCurrency: {
    name: "Ethereum",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: ["http://127.0.0.1:8545"],
}

export function isSupportedChainId(chainId: number | null) {
  return chainId !== null && SUPPORTED_CHAIN_IDS.has(chainId)
}

export function getWalletNetworkLabel(chainId: number | null) {
  if (chainId === null) {
    return "Wallet disconnected"
  }

  if (SUPPORTED_CHAIN_IDS.has(chainId)) {
    return "Hardhat Localhost"
  }

  return `Unsupported Chain (${chainId})`
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

async function trySwitchToHardhatNetwork() {
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
      "Please switch MetaMask to the Hardhat localhost network.",
      "UNSUPPORTED_NETWORK"
    )
  }
}

export async function connectWallet(): Promise<ConnectedWallet> {
  const ethereum = ensureEthereumProvider()

  const provider = new BrowserProvider(ethereum)
  await provider.send("eth_requestAccounts", [])

  let wallet = await buildWalletSnapshot(provider)

  if (!wallet.isSupportedNetwork) {
    await trySwitchToHardhatNetwork()
    wallet = await buildWalletSnapshot(new BrowserProvider(ensureEthereumProvider()))
  }

  if (!wallet.isSupportedNetwork) {
    throw new WalletConnectionError(
      "Please switch MetaMask to the Hardhat localhost network.",
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
