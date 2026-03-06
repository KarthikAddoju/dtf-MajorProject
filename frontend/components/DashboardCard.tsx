import { ReactNode } from "react"

interface DashboardCardProps {
  title?: string
  children: ReactNode
  className?: string
}

export function DashboardCard({ title, children, className = "" }: DashboardCardProps) {
  return (
    <div
      className={`bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl shadow-xl ${className}`}
    >
      {title && (
        <div className="px-6 py-4 border-b border-white/10">
          <h3 className="text-lg font-semibold text-white">{title}</h3>
        </div>
      )}
      <div className="p-6">{children}</div>
    </div>
  )
}
