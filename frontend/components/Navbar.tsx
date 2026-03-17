"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { WalletBadge } from "./WalletBadge"
import { RoleBadge } from "./RoleBadge"
import { getWalletNetworkLabel } from "@/lib/wallet"
import type { AuthUser } from "@/lib/types"

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload" },
  { href: "/admin", label: "Admin" },
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
  walletWarning?: string | null
  onConnectWallet?: () => void | Promise<void>
  onLogout?: () => void
}

export function Navbar({
  walletAddress,
  chainId,
  hasWalletProvider = true,
  user,
  isAuthenticated = false,
  isSupportedNetwork = false,
  isBusy = false,
  walletWarning,
  onConnectWallet,
  onLogout,
}: NavbarProps) {
  const pathname = usePathname()
  const networkLabel = getWalletNetworkLabel(chainId ?? null)
  const sessionLabel = isAuthenticated
    ? user?.role === "admin"
      ? "Admin Session"
      : "Student Session"
    : walletAddress
      ? "Wallet Connected"
      : "Guest Mode"
  const sessionTone = isAuthenticated
    ? "border-[#8bbbd5]/20 bg-[#8bbbd5]/10 text-[#d8ebf5]"
    : walletAddress
      ? "border-[#d25b36]/25 bg-[#d25b36]/10 text-[#ffd7c8]"
      : "border-[#eedfce]/12 bg-[#101726]/72 text-[#d4dbeb]"
  const networkTone =
    chainId === null
      ? "border-[#eedfce]/12 bg-[#101726]/72 text-[#d4dbeb]"
      : isSupportedNetwork
        ? "border-[#8bbbd5]/20 bg-[#8bbbd5]/10 text-[#d8ebf5]"
        : "border-[#f0c57f]/24 bg-[#f0c57f]/10 text-[#fde4b8]"
  const warningMessage = !hasWalletProvider
    ? "MetaMask was not detected in this browser. Install it to unlock upload, admin review, and signed dashboard flows."
    : walletWarning

  const primaryAction =
    isAuthenticated && user?.role === "admin"
      ? { href: "/admin", label: "Open Review Queue" }
      : isAuthenticated
        ? pathname === "/upload"
          ? { href: "/dashboard", label: "Open Dashboard" }
          : { href: "/upload", label: "Upload Credential" }
        : null

  return (
    <nav className="sticky top-4 z-50 w-full px-4 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1480px]">
        <div className="overflow-hidden rounded-[30px_14px_30px_14px] border border-[#eedfce]/12 bg-[rgba(8,13,24,0.74)] shadow-[0_20px_56px_rgba(3,7,15,0.28)] backdrop-blur-2xl">
          <div className="grid gap-4 px-5 py-5 xl:grid-cols-[auto_1fr_auto] xl:items-start">
            <Link href="/" className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-[linear-gradient(145deg,#f3eadc,#e0d1bd)] shadow-[0_16px_36px_rgba(5,10,20,0.16)]">
                <svg
                  className="h-6 w-6 text-[#101828]"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
                  />
                </svg>
              </div>
              <div>
                <div className="display-serif text-[1.9rem] font-semibold leading-none text-[#f7efe3]">
                  DACS
                </div>
                <div className="mt-1 text-[11px] uppercase tracking-[0.32em] text-[#92a4ba]">
                  Academic Trust Ledger
                </div>
              </div>
            </Link>

            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2">
                <div
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] ${sessionTone}`}
                >
                  {sessionLabel}
                </div>
                <div
                  className={`rounded-full border px-3 py-1.5 text-[11px] font-medium uppercase tracking-[0.2em] ${networkTone}`}
                >
                  {networkLabel}
                </div>
                {user?.role ? <RoleBadge role={user.role} /> : null}
                {walletAddress ? (
                  <WalletBadge
                    address={walletAddress}
                    label={isAuthenticated ? "Verified Wallet" : "Connected Wallet"}
                  />
                ) : null}
              </div>

              <div className="flex items-center gap-2 overflow-x-auto pb-1">
                <span className="hidden shrink-0 text-[11px] uppercase tracking-[0.28em] text-[#77879e] sm:inline-flex">
                  Navigate
                </span>
              {navLinks.map((link) => {
                const isActive =
                  pathname === link.href ||
                  (link.href !== "/" && pathname.startsWith(link.href))

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`relative shrink-0 rounded-full px-4 py-2.5 text-sm font-medium transition-all duration-200 ${
                      isActive
                        ? "bg-[#f3eadc] text-[#101828] shadow-[0_10px_30px_rgba(5,10,20,0.18)]"
                        : "border border-transparent text-[#b4c0d1] hover:border-[#eedfce]/10 hover:bg-[#111b2d]/76 hover:text-[#f7efe3]"
                    }`}
                  >
                    {link.label}
                  </Link>
                )
              })}
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3 xl:justify-end">
              {primaryAction ? (
                <Link
                  href={primaryAction.href}
                  className="brand-button-primary px-4 py-3 text-sm"
                >
                  {primaryAction.label}
                </Link>
              ) : null}

              {isAuthenticated ? (
                <button
                  onClick={onLogout}
                  className="brand-button-secondary px-4 py-3 text-sm"
                >
                  Logout
                </button>
              ) : (
                <button
                  onClick={onConnectWallet}
                  disabled={isBusy}
                  className="brand-button-primary px-4 py-3 text-sm disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isBusy
                    ? "Connecting..."
                    : walletAddress
                      ? "Complete Sign-In"
                      : "Connect & Sign In"}
                </button>
              )}
            </div>
          </div>
          <div className="brand-divider" />

          {warningMessage ? (
            <div className="px-5 py-4">
              <div className="rounded-[22px] border border-[#f0c57f]/18 bg-[#f0c57f]/10 px-4 py-3 text-sm text-[#fde4b8]">
              {warningMessage}
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </nav>
  )
}
