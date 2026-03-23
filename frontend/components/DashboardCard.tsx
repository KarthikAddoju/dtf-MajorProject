import { ReactNode } from "react"

interface DashboardCardProps {
  title?: string
  children: ReactNode
  className?: string
}

export function DashboardCard({ title, children, className = "" }: DashboardCardProps) {
  return (
    <div className={`brand-panel brand-card-hover ${className}`}>
      {title && (
        <div className="border-b border-white/[0.06] px-6 py-5">
          <div className="mb-1 text-[11px] text-[#666666]">
            Workspace
          </div>
          <h3 className="text-[1.3rem] font-semibold tracking-tight text-[#f0f0f0]">
            {title}
          </h3>
        </div>
      )}
      <div className="relative p-6">{children}</div>
    </div>
  )
}
