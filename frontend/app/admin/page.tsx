"use client"

import { useState } from "react"
import { PageLayout } from "@/components/PageLayout"
import { DashboardCard } from "@/components/DashboardCard"
import { MetricCard } from "@/components/MetricCard"
import { RoleBadge } from "@/components/RoleBadge"
import { CertificateCard } from "@/components/CertificateCard"

interface PendingCertificate {
  id: string
  studentAddress: string
  courseTitle: string
  cid: string
  uploadDate: string
}

// Mock pending certificates
const initialPendingCertificates: PendingCertificate[] = [
  {
    id: "1",
    studentAddress: "0xABC123def456789012345678901234567890abcd",
    courseTitle: "Blockchain Architecture",
    cid: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    uploadDate: "2024-03-05",
  },
  {
    id: "2",
    studentAddress: "0xDEF456abc789012345678901234567890ABCDEF",
    courseTitle: "Cryptography Fundamentals",
    cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
    uploadDate: "2024-03-04",
  },
  {
    id: "3",
    studentAddress: "0x789012345678901234567890abcdef1234567890",
    courseTitle: "Distributed Systems Design",
    cid: "QmZTR5bcpQD7cFgTorqxZDYaew1Wqgfbd2ud9QqGPAkK2V",
    uploadDate: "2024-03-03",
  },
  {
    id: "4",
    studentAddress: "0xFEDCBA098765432109876543210fedcba098765",
    courseTitle: "Zero Knowledge Proofs",
    cid: "QmabcdEFGH1234567890abcdefghijklmnopqrstuv",
    uploadDate: "2024-03-02",
  },
]

export default function AdminPage() {
  const [pendingCertificates, setPendingCertificates] = useState(initialPendingCertificates)
  const [processingId, setProcessingId] = useState<string | null>(null)

  const handleApprove = async (id: string) => {
    setProcessingId(id)
    // Mock approval - in production this would call the blockchain
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setPendingCertificates((prev) => prev.filter((cert) => cert.id !== id))
    setProcessingId(null)
  }

  const handleReject = async (id: string) => {
    setProcessingId(id)
    // Mock rejection - in production this would call the blockchain
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setPendingCertificates((prev) => prev.filter((cert) => cert.id !== id))
    setProcessingId(null)
  }

  return (
    <PageLayout>
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-bold text-white">Admin Panel</h1>
            <RoleBadge role="admin" />
          </div>
          <p className="text-slate-400">
            Review and verify pending certificate submissions.
          </p>
        </div>
      </div>

      {/* Admin Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-10">
        <MetricCard
          title="Pending Reviews"
          value={
            <span className="text-yellow-400">{pendingCertificates.length}</span>
          }
          accentColor="yellow"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
        <MetricCard
          title="Approved Today"
          value={<span className="text-green-400">12</span>}
          accentColor="green"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          }
        />
        <MetricCard
          title="Total Verified"
          value={<span className="text-blue-400">1,248</span>}
          accentColor="blue"
          icon={
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
              />
            </svg>
          }
        />
        <MetricCard
          title="EDU Distributed"
          value={<span className="text-purple-400">24.5K</span>}
          accentColor="purple"
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
      </div>

      {/* Pending Certificates */}
      <DashboardCard title="Pending Certificates">
        {pendingCertificates.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {pendingCertificates.map((cert) => (
              <div
                key={cert.id}
                className={`relative ${
                  processingId === cert.id ? "opacity-50 pointer-events-none" : ""
                }`}
              >
                {processingId === cert.id && (
                  <div className="absolute inset-0 flex items-center justify-center z-10">
                    <svg className="animate-spin w-8 h-8 text-blue-500" viewBox="0 0 24 24">
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
                  </div>
                )}
                <CertificateCard
                  courseTitle={cert.courseTitle}
                  cid={cert.cid}
                  issuedBy="Pending Verification"
                  issueDate={cert.uploadDate}
                  studentAddress={cert.studentAddress}
                  variant="pending"
                  onView={() =>
                    window.open(`https://ipfs.io/ipfs/${cert.cid}`, "_blank")
                  }
                  onApprove={() => handleApprove(cert.id)}
                  onReject={() => handleReject(cert.id)}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-16">
            <div className="w-20 h-20 mx-auto mb-6 rounded-full bg-green-500/10 border border-green-500/20 flex items-center justify-center">
              <svg
                className="w-10 h-10 text-green-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <h3 className="text-xl font-semibold text-white mb-2">All caught up!</h3>
            <p className="text-slate-400">
              There are no pending certificates to review at this time.
            </p>
          </div>
        )}
      </DashboardCard>
    </PageLayout>
  )
}
