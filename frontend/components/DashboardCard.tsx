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
        <div className="border-b border-[#eedfce]/10 px-6 py-5">
          <div className="mb-2 text-[11px] uppercase tracking-[0.28em] text-[#8ea0b8]">
            Workspace
          </div>
          <h3 className="display-serif text-[1.5rem] font-semibold tracking-[-0.03em] text-[#f4efe5]">
            {title}
          </h3>
        </div>
      )}
      <div className="relative p-6">{children}</div>
    </div>
  )
}
