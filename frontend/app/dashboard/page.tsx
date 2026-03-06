"use client"

import { PageLayout } from "@/components/PageLayout"
import { MetricCard } from "@/components/MetricCard"
import { DashboardCard } from "@/components/DashboardCard"
import { CertificateCard } from "@/components/CertificateCard"
import { RoleBadge } from "@/components/RoleBadge"
import { WalletBadge } from "@/components/WalletBadge"

// Mock data - in production this would come from the blockchain
const mockCertificates = [
  {
    id: "1",
    courseTitle: "Advanced Blockchain Development",
    cid: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    issuedBy: "MIT",
    issueDate: "2024-02-15",
  },
  {
    id: "2",
    courseTitle: "Smart Contract Security",
    cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
    issuedBy: "Stanford University",
    issueDate: "2024-01-20",
  },
  {
    id: "3",
    courseTitle: "Decentralized Finance Fundamentals",
    cid: "QmZTR5bcpQD7cFgTorqxZDYaew1Wqgfbd2ud9QqGPAkK2V",
    issuedBy: "Harvard Extension",
    issueDate: "2023-12-10",
  },
]

export default function DashboardPage() {
  const walletAddress = "0x1234567890abcdef1234567890abcdef12345678"
  const eduBalance = "1,250.00"
  const certificatesOwned = mockCertificates.length

  return (
    <PageLayout>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Student Dashboard</h1>
        <p className="text-slate-400">
          Manage your academic credentials and track your EDU tokens.
        </p>
      </div>

      {/* Metrics Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <MetricCard
          title="Wallet Address"
          value={<WalletBadge address={walletAddress} />}
          accentColor="blue"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
              />
            </svg>
          }
        />
        <MetricCard
          title="Role"
          value={<RoleBadge role="student" />}
          accentColor="purple"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
              />
            </svg>
          }
        />
        <MetricCard
          title="EDU Balance"
          value={
            <span className="flex items-center gap-2">
              <span className="text-yellow-400">{eduBalance}</span>
              <span className="text-sm text-slate-400">EDU</span>
            </span>
          }
          accentColor="yellow"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
        <MetricCard
          title="Certificates Owned"
          value={
            <span className="flex items-center gap-2">
              <span className="text-green-400">{certificatesOwned}</span>
              <span className="text-sm text-slate-400">NFTs</span>
            </span>
          }
          accentColor="green"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          }
        />
      </div>

      {/* Recent Certificates */}
      <DashboardCard title="Recent Certificates">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {mockCertificates.map((cert) => (
            <CertificateCard
              key={cert.id}
              courseTitle={cert.courseTitle}
              cid={cert.cid}
              issuedBy={cert.issuedBy}
              issueDate={cert.issueDate}
              onView={() => window.open(`https://ipfs.io/ipfs/${cert.cid}`, "_blank")}
            />
          ))}
        </div>

        {mockCertificates.length === 0 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
              <svg
                className="w-8 h-8 text-slate-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
            </div>
            <h3 className="text-lg font-medium text-white mb-1">No certificates yet</h3>
            <p className="text-slate-400">Upload your first certificate to get started.</p>
          </div>
        )}
      </DashboardCard>
    </PageLayout>
  )
}
