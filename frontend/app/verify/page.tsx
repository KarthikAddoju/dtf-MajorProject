"use client"

import { useState } from "react"
import { PageLayout } from "@/components/PageLayout"
import { DashboardCard } from "@/components/DashboardCard"

interface VerificationResult {
  found: boolean
  studentAddress?: string
  verifierAddress?: string
  tokenId?: string
  issueDate?: string
  courseTitle?: string
  institution?: string
}

// Mock verification data
const mockVerificationData: Record<string, VerificationResult> = {
  "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco": {
    found: true,
    studentAddress: "0x1234567890abcdef1234567890abcdef12345678",
    verifierAddress: "0xABCDEF1234567890abcdef1234567890ABCDEF12",
    tokenId: "42",
    issueDate: "2024-02-15",
    courseTitle: "Advanced Blockchain Development",
    institution: "MIT",
  },
  "42": {
    found: true,
    studentAddress: "0x1234567890abcdef1234567890abcdef12345678",
    verifierAddress: "0xABCDEF1234567890abcdef1234567890ABCDEF12",
    tokenId: "42",
    issueDate: "2024-02-15",
    courseTitle: "Advanced Blockchain Development",
    institution: "MIT",
  },
}

export default function VerifyPage() {
  const [searchQuery, setSearchQuery] = useState("")
  const [isSearching, setIsSearching] = useState(false)
  const [result, setResult] = useState<VerificationResult | null>(null)
  const [hasSearched, setHasSearched] = useState(false)

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!searchQuery.trim()) return

    setIsSearching(true)
    setHasSearched(false)

    // Mock verification - in production this would query the blockchain
    await new Promise((resolve) => setTimeout(resolve, 1500))

    const mockResult = mockVerificationData[searchQuery.trim()]
    setResult(mockResult || { found: false })
    setHasSearched(true)
    setIsSearching(false)
  }

  const truncateAddress = (address: string) => {
    return `${address.slice(0, 8)}...${address.slice(-6)}`
  }

  return (
    <PageLayout>
      {/* Page Header */}
      <div className="mb-8 text-center">
        <h1 className="text-3xl font-bold text-white mb-2">Verify Certificate</h1>
        <p className="text-slate-400">
          Enter a CID or Token ID to verify the authenticity of a certificate.
        </p>
      </div>

      {/* Search Card */}
      <div className="max-w-2xl mx-auto mb-10">
        <DashboardCard>
          <form onSubmit={handleVerify} className="space-y-4">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <svg
                  className="w-5 h-5 text-slate-500"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Enter CID or Token ID..."
                className="w-full pl-12 pr-4 py-4 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-mono"
              />
            </div>
            <button
              type="submit"
              disabled={isSearching || !searchQuery.trim()}
              className="w-full px-6 py-4 text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl hover:from-blue-500 hover:to-purple-500 transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSearching ? (
                <>
                  <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24">
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                      fill="none"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                    />
                  </svg>
                  Verifying...
                </>
              ) : (
                <>
                  <svg
                    className="w-5 h-5"
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
                  Verify Certificate
                </>
              )}
            </button>
          </form>
        </DashboardCard>
      </div>

      {/* Results */}
      {hasSearched && (
        <div className="max-w-2xl mx-auto">
          {result?.found ? (
            <DashboardCard>
              <div className="text-center mb-6">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-green-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-green-400 mb-1">
                  Certificate Verified
                </h3>
                <p className="text-slate-400">
                  This certificate is authentic and recorded on the blockchain.
                </p>
              </div>

              <div className="bg-white/5 rounded-xl p-6 space-y-4">
                {result.courseTitle && (
                  <div className="text-center mb-4">
                    <h4 className="text-lg font-semibold text-white">
                      {result.courseTitle}
                    </h4>
                    {result.institution && (
                      <p className="text-slate-400">{result.institution}</p>
                    )}
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-xs text-slate-500 mb-1">Student Address</div>
                    <div className="font-mono text-sm text-blue-400">
                      {truncateAddress(result.studentAddress!)}
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-xs text-slate-500 mb-1">Verifier Address</div>
                    <div className="font-mono text-sm text-purple-400">
                      {truncateAddress(result.verifierAddress!)}
                    </div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-xs text-slate-500 mb-1">Token ID</div>
                    <div className="font-semibold text-yellow-400">#{result.tokenId}</div>
                  </div>
                  <div className="p-4 bg-white/5 rounded-lg border border-white/10">
                    <div className="text-xs text-slate-500 mb-1">Issue Date</div>
                    <div className="text-white">{result.issueDate}</div>
                  </div>
                </div>
              </div>
            </DashboardCard>
          ) : (
            <DashboardCard>
              <div className="text-center py-8">
                <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
                  <svg
                    className="w-8 h-8 text-red-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M6 18L18 6M6 6l12 12"
                    />
                  </svg>
                </div>
                <h3 className="text-xl font-semibold text-red-400 mb-1">
                  Certificate Not Found
                </h3>
                <p className="text-slate-400 max-w-sm mx-auto">
                  No certificate was found with the provided CID or Token ID. Please
                  check the input and try again.
                </p>
              </div>
            </DashboardCard>
          )}
        </div>
      )}

      {/* How It Works */}
      {!hasSearched && (
        <div className="max-w-4xl mx-auto">
          <h2 className="text-xl font-semibold text-white text-center mb-8">
            How Verification Works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center p-6 bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-blue-500/20 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold">
                1
              </div>
              <h3 className="font-semibold text-white mb-2">Enter Details</h3>
              <p className="text-sm text-slate-400">
                Input the certificate CID or NFT Token ID
              </p>
            </div>
            <div className="text-center p-6 bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-purple-500/20 border border-purple-500/30 flex items-center justify-center text-purple-400 font-bold">
                2
              </div>
              <h3 className="font-semibold text-white mb-2">Blockchain Query</h3>
              <p className="text-sm text-slate-400">
                We verify the data against the blockchain
              </p>
            </div>
            <div className="text-center p-6 bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-green-500/20 border border-green-500/30 flex items-center justify-center text-green-400 font-bold">
                3
              </div>
              <h3 className="font-semibold text-white mb-2">View Results</h3>
              <p className="text-sm text-slate-400">
                Get instant verification with full details
              </p>
            </div>
          </div>
        </div>
      )}
    </PageLayout>
  )
}
