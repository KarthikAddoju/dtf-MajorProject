"use client"

import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react"
import { toast } from "sonner"
import { fetchCurrentUser, requestAuthChallenge, verifyAuthChallenge } from "@/lib/api"
import {
  connectWallet,
  getConnectedWallet,
  hasInjectedWalletProvider,
  WalletConnectionError,
} from "@/lib/wallet"
import type { AuthUser } from "@/lib/types"

interface AuthContextValue {
  token: string | null
  user: AuthUser | null
  connectedWalletAddress: string | null
  chainId: number | null
  hasWalletProvider: boolean
  isSupportedNetwork: boolean
  isReady: boolean
  isAuthenticating: boolean
  isAuthenticated: boolean
  walletWarning: string | null
  connectAndSignIn: () => Promise<void>
  logout: () => void
}

const TOKEN_STORAGE_KEY = "dacs.auth.token"

const AuthContext = createContext<AuthContextValue | null>(null)

function normalizeAddress(address: string) {
  return address.toLowerCase()
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(null)
  const [user, setUser] = useState<AuthUser | null>(null)
  const [connectedWalletAddress, setConnectedWalletAddress] = useState<string | null>(
    null
  )
  const [chainId, setChainId] = useState<number | null>(null)
  const [hasWalletProvider, setHasWalletProvider] = useState(false)
  const [walletWarning, setWalletWarning] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      try {
        setHasWalletProvider(hasInjectedWalletProvider())
        const wallet = await getConnectedWallet()

        if (!cancelled) {
          setConnectedWalletAddress(wallet?.address ?? null)
          setChainId(wallet?.chainId ?? null)
          setWalletWarning(
            wallet && !wallet.isSupportedNetwork
              ? "Switch MetaMask to the Hardhat localhost network to use authenticated flows."
              : null
          )
        }

        const storedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY)

        if (!storedToken) {
          return
        }

        const { user: restoredUser } = await fetchCurrentUser(storedToken)

        if (
          wallet?.address &&
          normalizeAddress(restoredUser.address) !== normalizeAddress(wallet.address)
        ) {
          window.localStorage.removeItem(TOKEN_STORAGE_KEY)

          if (!cancelled) {
            setToken(null)
            setUser(null)
            setWalletWarning(
              "Your connected wallet changed, so the previous DACS session was cleared for safety."
            )
          }

          return
        }

        if (!cancelled) {
          setToken(storedToken)
          setUser(restoredUser)
        }
      } catch {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY)

        if (!cancelled) {
          setToken(null)
          setUser(null)
        }
      } finally {
        if (!cancelled) {
          setIsReady(true)
        }
      }
    }

    restoreSession()

    const ethereum = window.ethereum

    if (!ethereum?.on || !ethereum.removeListener) {
      return () => {
        cancelled = true
      }
    }

    const handleAccountsChanged = (accounts: unknown) => {
      const nextAccounts = Array.isArray(accounts) ? accounts : []
      const nextAddress =
        typeof nextAccounts[0] === "string"
          ? normalizeAddress(nextAccounts[0])
          : null

      setConnectedWalletAddress(nextAddress)

      if (user?.address && nextAddress && user.address !== nextAddress) {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY)
        setToken(null)
        setUser(null)
        setWalletWarning(
          "The connected wallet changed. Sign in again to continue with DACS."
        )
      }

      if (!nextAddress) {
        setWalletWarning("MetaMask is disconnected. Reconnect it for upload and admin actions.")
      }
    }

    const handleChainChanged = () => {
      getConnectedWallet()
        .then((wallet) => {
          setChainId(wallet?.chainId ?? null)
          setWalletWarning(
            wallet && !wallet.isSupportedNetwork
              ? "Switch MetaMask to the Hardhat localhost network to continue."
              : null
          )
        })
        .catch(() => {
          setWalletWarning("Could not refresh wallet network status.")
        })
    }

    ethereum.on("accountsChanged", handleAccountsChanged)
    ethereum.on("chainChanged", handleChainChanged)

    return () => {
      cancelled = true
      ethereum.removeListener?.("accountsChanged", handleAccountsChanged)
      ethereum.removeListener?.("chainChanged", handleChainChanged)
    }
  }, [user?.address])

  async function connectAndSignIn() {
    setIsAuthenticating(true)

    try {
      const wallet = await connectWallet()
      const { message } = await requestAuthChallenge(wallet.address)
      const signature = await wallet.signer.signMessage(message)
      const verified = await verifyAuthChallenge(wallet.address, message, signature)
      const nextUser = {
        address: verified.address,
        role: verified.role,
      } satisfies AuthUser

      window.localStorage.setItem(TOKEN_STORAGE_KEY, verified.token)
      setToken(verified.token)
      setUser(nextUser)
      setConnectedWalletAddress(wallet.address)
      setChainId(wallet.chainId)
      setWalletWarning(null)

      toast.success(
        nextUser.role === "admin"
          ? "Admin session restored on DACS."
          : "Wallet connected and signed in to DACS."
      )
    } catch (error) {
      const message =
        error instanceof WalletConnectionError || error instanceof Error
          ? error.message
          : "Could not sign in with your wallet."

      setWalletWarning(message)
      toast.error(message)
    } finally {
      setIsAuthenticating(false)
    }
  }

  function logout() {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
    setUser(null)
    toast.success("Signed out of DACS")
  }

  return (
    <AuthContext.Provider
      value={{
        token,
        user,
        connectedWalletAddress,
        chainId,
        hasWalletProvider,
        isSupportedNetwork:
          connectedWalletAddress !== null &&
          chainId !== null &&
          (chainId === 1337 || chainId === 31337),
        isReady,
        isAuthenticating,
        isAuthenticated: !!token && !!user,
        walletWarning,
        connectAndSignIn,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)

  if (!context) {
    throw new Error("useAuth must be used within AuthProvider")
  }

  return context
}
