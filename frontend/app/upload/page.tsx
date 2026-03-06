"use client"

import { useState } from "react"
import { PageLayout } from "@/components/PageLayout"
import { DashboardCard } from "@/components/DashboardCard"

interface UploadedCertificate {
  id: string
  courseName: string
  cid: string
  certificateUrl: string
  status: "pending" | "approved" | "rejected"
  uploadDate: string
}

// Mock uploaded certificates
const mockUploadedCertificates: UploadedCertificate[] = [
  {
    id: "1",
    courseName: "Web Development Bootcamp",
    cid: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    certificateUrl: "https://ipfs.io/ipfs/QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    status: "pending",
    uploadDate: "2024-03-01",
  },
  {
    id: "2",
    courseName: "Data Science Fundamentals",
    cid: "QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
    certificateUrl: "https://ipfs.io/ipfs/QmYwAPJzv5CZsnA625s3Xf2nemtYgPpHdWEz79ojWnPbdG",
    status: "approved",
    uploadDate: "2024-02-15",
  },
]

export default function UploadPage() {
  const [courseName, setCourseName] = useState("")
  const [ipfsCid, setIpfsCid] = useState("")
  const [certificateUrl, setCertificateUrl] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)

    // Mock submit - in production this would call the blockchain
    await new Promise((resolve) => setTimeout(resolve, 1500))

    // Reset form
    setCourseName("")
    setIpfsCid("")
    setCertificateUrl("")
    setIsSubmitting(false)
  }

  const getStatusBadge = (status: UploadedCertificate["status"]) => {
    const styles = {
      pending: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
      approved: "bg-green-500/20 text-green-400 border-green-500/30",
      rejected: "bg-red-500/20 text-red-400 border-red-500/30",
    }

    return (
      <span
        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${styles[status]}`}
      >
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    )
  }

  return (
    <PageLayout>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">Upload Certificate</h1>
        <p className="text-slate-400">
          Submit your academic certificates for verification and NFT minting.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Upload Form */}
        <DashboardCard title="Submit New Certificate">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Course Name */}
            <div>
              <label
                htmlFor="courseName"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Course Name
              </label>
              <input
                type="text"
                id="courseName"
                value={courseName}
                onChange={(e) => setCourseName(e.target.value)}
                placeholder="e.g., Advanced Machine Learning"
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                required
              />
            </div>

            {/* IPFS CID */}
            <div>
              <label
                htmlFor="ipfsCid"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                IPFS CID
              </label>
              <input
                type="text"
                id="ipfsCid"
                value={ipfsCid}
                onChange={(e) => setIpfsCid(e.target.value)}
                placeholder="e.g., QmXoypizjW3WknFiJnKLwHCnL..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all font-mono text-sm"
                required
              />
              <p className="mt-1.5 text-xs text-slate-500">
                Upload your certificate to IPFS first and paste the CID here.
              </p>
            </div>

            {/* Certificate URL */}
            <div>
              <label
                htmlFor="certificateUrl"
                className="block text-sm font-medium text-slate-300 mb-2"
              >
                Certificate URL
              </label>
              <input
                type="url"
                id="certificateUrl"
                value={certificateUrl}
                onChange={(e) => setCertificateUrl(e.target.value)}
                placeholder="https://ipfs.io/ipfs/..."
                className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-all"
                required
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full px-6 py-4 text-base font-semibold text-white bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl hover:from-blue-500 hover:to-purple-500 transition-all duration-200 shadow-lg shadow-blue-500/25 hover:shadow-blue-500/40 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isSubmitting ? (
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
                  Uploading...
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
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                  Upload Certificate
                </>
              )}
            </button>
          </form>
        </DashboardCard>

        {/* Uploaded Certificates Preview */}
        <DashboardCard title="Your Uploads">
          <div className="space-y-4">
            {mockUploadedCertificates.map((cert) => (
              <div
                key={cert.id}
                className="p-4 bg-white/5 border border-white/10 rounded-xl hover:bg-white/[0.07] transition-colors"
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h4 className="font-medium text-white">{cert.courseName}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Uploaded: {cert.uploadDate}
                    </p>
                  </div>
                  {getStatusBadge(cert.status)}
                </div>
                <div className="space-y-1 text-sm">
                  <div className="flex items-center gap-2">
                    <span className="text-slate-500">CID:</span>
                    <span className="text-slate-400 font-mono text-xs truncate max-w-[200px]">
                      {cert.cid}
                    </span>
                  </div>
                </div>
                <button
                  onClick={() => window.open(cert.certificateUrl, "_blank")}
                  className="mt-3 w-full px-3 py-2 text-sm font-medium text-white bg-white/10 border border-white/10 rounded-lg hover:bg-white/20 transition-colors"
                >
                  View Certificate
                </button>
              </div>
            ))}

            {mockUploadedCertificates.length === 0 && (
              <div className="text-center py-8">
                <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
                  <svg
                    className="w-6 h-6 text-slate-500"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={1.5}
                      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                    />
                  </svg>
                </div>
                <p className="text-slate-400 text-sm">No uploads yet</p>
              </div>
            )}
          </div>
        </DashboardCard>
      </div>
    </PageLayout>
  )
}
