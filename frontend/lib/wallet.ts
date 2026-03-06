import { BrowserProvider } from "ethers"

declare global {
  interface Window {
    ethereum?: any
  }
}

export async function connectWallet() {
  if (typeof window === "undefined") return null

  if (!window.ethereum) {
    alert("MetaMask not detected. Please install MetaMask.")
    return null
  }

  const provider = new BrowserProvider(window.ethereum)

  const network = await provider.getNetwork()
  console.log("Connected network:", network.chainId)

  if (Number(network.chainId) !== 31337) {
    alert("Please switch MetaMask to Hardhat Local Network (Chain ID: 31337)")
    return null
  }

  await provider.send("eth_requestAccounts", [])

  const signer = await provider.getSigner()
  const address = await signer.getAddress()

  localStorage.setItem("walletAddress", address)

  return { provider, signer, address }
}

export async function getConnectedWallet() {
  if (typeof window === "undefined") return null
  if (!window.ethereum) return null

  const provider = new BrowserProvider(window.ethereum)

  const network = await provider.getNetwork()
  console.log("Connected network:", network.chainId)

  if (Number(network.chainId) !== 31337) {
    console.warn("Wrong network. Please switch to Hardhat.")
    return null
  }

  const accounts = await provider.send("eth_accounts", [])

  if (accounts.length === 0) return null

  const signer = await provider.getSigner()
  const address = await signer.getAddress()

  return { provider, signer, address }
}