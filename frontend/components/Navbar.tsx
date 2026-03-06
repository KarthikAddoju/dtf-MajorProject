"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { WalletBadge } from "./WalletBadge"

const navLinks = [
  { href: "/", label: "Home" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/upload", label: "Upload" },
  { href: "/admin", label: "Admin" },
  { href: "/verify", label: "Verify" },
]

interface NavbarProps {
  walletAddress?: string | null
  isConnected?: boolean
  onConnectWallet?: () => void
}

export function Navbar({ walletAddress, isConnected = false, onConnectWallet }: NavbarProps) {
  const pathname = usePathname()

  return (
    <nav className="sticky top-0 z-50 w-full bg-black/40 backdrop-blur-md border-b border-white/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-linear-to-br from-blue-500 to-purple-600 flex items-center justify-center">
              <svg
                className="w-5 h-5 text-white"
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
            <span className="text-xl font-bold bg-linear-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
              DACS
            </span>
          </Link>

          {/* Center Navigation */}
          <div className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative px-4 py-2 text-sm font-medium transition-colors duration-200 rounded-lg ${
                    isActive
                      ? "text-white"
                      : "text-slate-400 hover:text-white"
                  }`}
                >
                  {link.label}
                  {isActive && (
                    <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-linear-to-r from-blue-500 to-purple-500 rounded-full" />
                  )}
                  <span className="absolute inset-x-4 -bottom-px h-px bg-linear-to-r from-blue-500/0 via-blue-500/40 to-blue-500/0 opacity-0 hover:opacity-100 transition-opacity" />
                </Link>
              )
            })}
          </div>

          {/* Right Side - Wallet */}
          <div className="flex items-center gap-4">
            {isConnected && walletAddress ? (
              <WalletBadge address={walletAddress} />
            ) : (
              <button
                onClick={onConnectWallet}
                className="px-4 py-2 text-sm font-medium text-white bg-linear-to-r from-blue-600 to-purple-600 rounded-lg hover:from-blue-500 hover:to-purple-500 transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40"
              >
                Connect Wallet
              </button>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button className="md:hidden p-2 text-slate-400 hover:text-white">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          </button>
        </div>
      </div>
    </nav>
  )
}
