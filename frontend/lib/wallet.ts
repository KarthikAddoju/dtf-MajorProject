import { BrowserProvider } from "ethers"

declare global {
  interface Window {
    ethereum?: any
  }
}

/**
 * Connect wallet when user clicks "Connect Wallet"
 */
export async function connectWallet() {

  if (typeof window === "undefined") return null

  if (!window.ethereum) {
    alert("MetaMask not detected. Please install MetaMask.")
    return null
  }

  const provider = new BrowserProvider(window.ethereum)

  // 🔹 First request wallet connection
  await provider.send("eth_requestAccounts", [])

  const signer = await provider.getSigner()
  const address = await signer.getAddress()

  // 🔹 Now check network
  const network = await provider.getNetwork()
  const chainId = Number(network.chainId)

  console.log("Connected network:", chainId)

  // Accept both Hardhat chain IDs
  if (chainId !== 31337 && chainId !== 1337) {
    alert("Please switch MetaMask to Hardhat Local Network (Chain ID: 31337)")
    return null
  }

  // Save wallet
  localStorage.setItem("walletAddress", address)

  return { provider, signer, address }
}


/**
 * Auto reconnect wallet if already connected
 */
export async function getConnectedWallet() {

  if (typeof window === "undefined") return null

  if (!window.ethereum) return null

  const provider = new BrowserProvider(window.ethereum)

  const accounts = await provider.send("eth_accounts", [])

  if (accounts.length === 0) return null

  const signer = await provider.getSigner()
  const address = await signer.getAddress()

  const network = await provider.getNetwork()
  const chainId = Number(network.chainId)

  console.log("Connected network:", chainId)

  if (chainId !== 31337 && chainId !== 1337) {
    console.warn("Wrong network. Please switch to Hardhat.")
    return null
  }

  return { provider, signer, address }
}