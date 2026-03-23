"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { StatusBanner } from "./StatusBanner"
import { WalletBadge } from "./WalletBadge"
import { RoleBadge } from "./RoleBadge"
import { getWalletNetworkLabel, getWalletSignInLabel } from "@/lib/wallet"
import type { AuthFlowState, AuthUser } from "@/lib/types"

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload" },
  { href: "/admin", label: "Review" },
  { href: "/verify", label: "Verify" },
  { href: "/colleges", label: "Colleges" },
]

interface NavbarProps {
  walletAddress?: string | null
  chainId?: number | null
  hasWalletProvider?: boolean
  user?: AuthUser | null
  isAuthenticated?: boolean
  isSupportedNetwork?: boolean
  isBusy?: boolean
  authFlowState?: AuthFlowState
  walletNote?: string | null
  walletWarning?: string | null
  onConnectWallet?: () => void | Promise<void>
  onLogout?: () => void
  blockNumber?: number | null
  isChainLive?: boolean
}

export function Navbar({
  walletAddress,
  chainId,
  hasWalletProvider = true,
  user,
  isAuthenticated = false,
  isSupportedNetwork = false,
  isBusy = false,
  authFlowState = "idle",
  walletNote,
  walletWarning,
  onConnectWallet,
  onLogout,
  blockNumber,
  isChainLive = false,
}: NavbarProps) {
  const pathname = usePathname()
  const networkLabel = getWalletNetworkLabel(chainId ?? null)
  const sessionLabel = isAuthenticated
    ? user?.role === "admin"
      ? "Admin Session"
      : user?.role === "verifier"
        ? "Verifier Session"
        : "Student Session"
    : authFlowState === "awaiting_signature"
      ? "Awaiting Signature"
      : authFlowState === "connecting_wallet"
        ? "Connecting Wallet"
        : walletAddress
          ? "Wallet Connected"
          : "Guest Mode"

  const sessionTone = isAuthenticated
    ? "border-[#4f7ef5]/25 bg-[#4f7ef5]/10 text-[#a5c0f8]"
    : authFlowState === "awaiting_signature" || authFlowState === "connecting_wallet"
      ? "border-amber-500/25 bg-amber-500/10 text-amber-200"
      : walletAddress
        ? "border-white/[0.12] bg-white/[0.04] text-[#a0a0a0]"
        : "border-white/[0.08] bg-transparent text-[#666666]"

  const networkTone =
    chainId === null
      ? "border-white/[0.08] bg-transparent text-[#666666]"
      : isSupportedNetwork
        ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
        : "border-amber-500/25 bg-amber-500/10 text-amber-200"

  const warningMessage = !hasWalletProvider
    ? "MetaMask was not detected in this browser. Install it to unlock upload, admin review, and signed dashboard flows."
    : walletWarning

  const walletActionLabel = getWalletSignInLabel(authFlowState, Boolean(walletAddress))

  const primaryAction =
    isAuthenticated && (user?.role === "admin" || user?.role === "verifier")
      ? { href: "/admin", label: "Open Review Queue" }
      : isAuthenticated
        ? pathname === "/upload"
          ? { href: "/dashboard", label: "Open Dashboard" }
          : { href: "/upload", label: "Upload Credential" }
        : null

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-white/[0.06] bg-[#111]/80 backdrop-blur-xl">
      <div className="mx-auto max-w-[1480px]">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-3 xl:flex-nowrap">

          {/* Logo */}
          <Link href="/" className="flex shrink-0 items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#4f7ef5]/30 bg-[#1d2b4a]">
              <svg
                className="h-5 w-5 text-[#a5c0f8]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                />
              </svg>
            </div>
            <div>
              <div className="text-[1.1rem] font-semibold leading-none tracking-tight text-[#f0f0f0]">
                DACS
              </div>
              <div className="mt-0.5 text-[10px] text-[#666666]">
                Academic Trust Ledger
              </div>
            </div>
          </Link>

          {/* Nav links */}
          <div className="flex items-center gap-1 overflow-x-auto">
            {navLinks.map((link) => {
              const isActive =
                pathname === link.href ||
                (link.href !== "/" && pathname.startsWith(link.href))
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`shrink-0 rounded-lg px-3 py-1.5 text-sm font-medium transition-colors duration-150 ${
                    isActive
                      ? "bg-[#1d2b4a] text-[#a5c0f8]"
                      : "text-[#a0a0a0] hover:bg-white/[0.04] hover:text-[#f0f0f0]"
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </div>

          {/* Status badges */}
          <div className="flex flex-1 flex-wrap items-center justify-end gap-2">
            <div
              className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${sessionTone}`}
            >
              {sessionLabel}
            </div>
            <div
              className={`rounded-full border px-2.5 py-1 text-[10px] font-medium ${networkTone}`}
            >
              {networkLabel}
            </div>
            <div
              className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-medium ${
                isChainLive
                  ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-300"
                  : "border-white/[0.08] bg-transparent text-[#666666]"
              }`}
            >
              {isChainLive ? (
                <>
                  <span className="brand-status-dot" />
                  {blockNumber != null
                    ? `Block ${blockNumber.toLocaleString()}`
                    : "Live"}
                </>
              ) : (
                "Chain —"
              )}
            </div>
            {user?.role ? <RoleBadge role={user.role} /> : null}
            {walletAddress ? (
              <WalletBadge
                address={walletAddress}
                label={isAuthenticated ? "Verified Wallet" : "Connected Wallet"}
              />
            ) : null}

            {/* Actions */}
            {primaryAction ? (
              <Link
                href={primaryAction.href}
                className="brand-button-primary px-3 py-1.5 text-sm"
              >
                {primaryAction.label}
              </Link>
            ) : null}
            {isAuthenticated ? (
              <button
                onClick={onLogout}
                className="brand-button-secondary px-3 py-1.5 text-sm"
              >
                Logout
              </button>
            ) : (
              <button
                onClick={onConnectWallet}
                disabled={isBusy}
                className="brand-button-primary px-3 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-60"
              >
                {walletActionLabel}
              </button>
            )}
          </div>
        </div>

        {warningMessage || walletNote ? (
          <div className="border-t border-white/[0.06] px-5 py-3">
            <div className="space-y-2">
              {warningMessage ? (
                <StatusBanner
                  compact
                  tone="warning"
                  title="Wallet Attention"
                  message={warningMessage}
                />
              ) : null}
              {walletNote ? (
                <StatusBanner
                  compact
                  tone="neutral"
                  title="Session Note"
                  message={walletNote}
                />
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </nav>
  )
}
