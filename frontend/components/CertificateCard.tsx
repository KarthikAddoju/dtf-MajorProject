interface CertificateCardProps {
  courseTitle: string
  cid: string
  issuedBy: string
  issueDate: string
  onView?: () => void
  variant?: "default" | "pending"
  studentAddress?: string
  onApprove?: () => void
  onReject?: () => void
}

export function CertificateCard({
  courseTitle,
  cid,
  issuedBy,
  issueDate,
  onView,
  variant = "default",
  studentAddress,
  onApprove,
  onReject,
}: CertificateCardProps) {
  return (
    <div className="bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-200 hover:scale-[1.02] hover:border-white/20 hover:bg-white/[0.07]">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center">
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
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
          </div>
          <div>
            <h4 className="font-semibold text-white text-balance">{courseTitle}</h4>
            {variant === "pending" && (
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-yellow-500/20 text-yellow-400 border border-yellow-500/30 mt-1">
                Pending Review
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-2 text-sm mb-4">
        {studentAddress && (
          <div className="flex items-center gap-2">
            <span className="text-slate-500">Student:</span>
            <span className="text-slate-300 font-mono text-xs">
              {studentAddress.slice(0, 8)}...{studentAddress.slice(-6)}
            </span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Proof CID:</span>
          <span className="text-slate-300 font-mono text-xs truncate max-w-[180px]">
            {cid}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Issued By:</span>
          <span className="text-slate-300">{issuedBy}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-slate-500">Date:</span>
          <span className="text-slate-300">{issueDate}</span>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => onView?.()}
          className="flex-1 px-4 py-2 text-sm font-medium text-white bg-white/10 border border-white/10 rounded-lg hover:bg-white/20 transition-colors duration-200"
        >
          View Certificate
        </button>
        {variant === "pending" && (
          <>
            <button
              onClick={() => onApprove?.()}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 rounded-lg hover:bg-green-500 transition-colors duration-200"
            >
              Approve
            </button>
            <button
              onClick={() => onReject?.()}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600/80 rounded-lg hover:bg-red-500 transition-colors duration-200"
            >
              Reject
            </button>
          </>
        )}
      </div>
    </div>
  )
}
