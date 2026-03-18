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
  isWalletActionRejected,
  WalletConnectionError,
} from "@/lib/wallet"
import type { AuthFlowState, AuthUser } from "@/lib/types"

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
  authFlowState: AuthFlowState
  walletNote: string | null
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
  const [walletNote, setWalletNote] = useState<string | null>(null)
  const [isReady, setIsReady] = useState(false)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [authFlowState, setAuthFlowState] = useState<AuthFlowState>("idle")

  useEffect(() => {
    let cancelled = false

    async function restoreSession() {
      let restoredWallet: Awaited<ReturnType<typeof getConnectedWallet>> = null

      try {
        setHasWalletProvider(hasInjectedWalletProvider())
        const storedToken = window.localStorage.getItem(TOKEN_STORAGE_KEY)
        const wallet = await getConnectedWallet()
        restoredWallet = wallet

        if (!cancelled) {
          setConnectedWalletAddress(wallet?.address ?? null)
          setChainId(wallet?.chainId ?? null)
          setAuthFlowState(
            wallet?.address ? (storedToken ? "authenticated" : "wallet_connected") : "idle"
          )
          setWalletWarning(
            wallet && !wallet.isSupportedNetwork
              ? "Switch MetaMask to the Hardhat localhost network to use authenticated flows."
              : null
          )
        }

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
            setAuthFlowState(wallet?.address ? "wallet_connected" : "idle")
            setWalletNote(null)
            setWalletWarning(
              "Your connected wallet changed, so the previous DACS session was cleared for safety."
            )
          }

          return
        }

        if (!cancelled) {
          setToken(storedToken)
          setUser(restoredUser)
          setAuthFlowState("authenticated")
        }
      } catch {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY)

        if (!cancelled) {
          setToken(null)
          setUser(null)
          setAuthFlowState(restoredWallet?.address ? "wallet_connected" : "idle")
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
      setWalletNote(null)

      if (user?.address && nextAddress && user.address !== nextAddress) {
        window.localStorage.removeItem(TOKEN_STORAGE_KEY)
        setToken(null)
        setUser(null)
        setAuthFlowState("wallet_connected")
        setWalletWarning(
          "The connected wallet changed. Sign in again to continue with DACS."
        )
        return
      }

      if (user?.address && nextAddress && user.address === nextAddress) {
        setAuthFlowState("authenticated")
        setWalletWarning(null)
        return
      }

      if (!nextAddress) {
        setAuthFlowState("idle")
        setWalletWarning("MetaMask is disconnected. Reconnect it for upload and admin actions.")
        return
      }

      setAuthFlowState("wallet_connected")
      setWalletWarning(null)
    }

    const handleChainChanged = () => {
      getConnectedWallet()
        .then((wallet) => {
          setChainId(wallet?.chainId ?? null)
          setAuthFlowState(
            wallet?.address ? (user?.address ? "authenticated" : "wallet_connected") : "idle"
          )
          setWalletNote(null)
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
    setWalletWarning(null)
    setWalletNote(null)
    setAuthFlowState("connecting_wallet")
    let attemptedWalletAddress: string | null = null

    try {
      const wallet = await connectWallet()
      attemptedWalletAddress = wallet.address
      setConnectedWalletAddress(wallet.address)
      setChainId(wallet.chainId)
      setAuthFlowState("awaiting_signature")
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
      setWalletNote(null)
      setAuthFlowState("authenticated")

      toast.success(
        nextUser.role === "admin"
          ? "Admin session restored on DACS."
          : "Wallet connected and signed in to DACS."
      )
    } catch (error) {
      if (isWalletActionRejected(error)) {
        setWalletWarning(null)
        setWalletNote("Sign-in was canceled. You can try again whenever you're ready.")
        setAuthFlowState(attemptedWalletAddress ? "wallet_connected" : "idle")
        return
      }

      const message =
        error instanceof WalletConnectionError || error instanceof Error
          ? error.message
          : "Could not sign in with your wallet."

      setWalletWarning(message)
      setWalletNote(null)
      setAuthFlowState(attemptedWalletAddress ? "wallet_connected" : "idle")
      toast.error(message)
    } finally {
      setIsAuthenticating(false)
    }
  }

  function logout() {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY)
    setToken(null)
    setUser(null)
    setWalletWarning(null)
    setWalletNote(null)
    setAuthFlowState(connectedWalletAddress ? "wallet_connected" : "idle")
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
        authFlowState,
        walletNote,
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
