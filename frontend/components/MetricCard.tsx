import { ReactNode } from "react"

interface MetricCardProps {
  title: string
  value: string | ReactNode
  icon?: ReactNode
  accentColor?: "blue" | "purple" | "yellow" | "green"
}

export function MetricCard({ title, value, icon, accentColor = "blue" }: MetricCardProps) {
  const accentStyles = {
    blue: "from-blue-500/20 to-transparent border-blue-500/20",
    purple: "from-purple-500/20 to-transparent border-purple-500/20",
    yellow: "from-yellow-500/20 to-transparent border-yellow-500/20",
    green: "from-green-500/20 to-transparent border-green-500/20",
  }

  const iconStyles = {
    blue: "text-blue-400",
    purple: "text-purple-400",
    yellow: "text-yellow-400",
    green: "text-green-400",
  }

  return (
    <div
      className={`relative overflow-hidden bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-6 shadow-xl transition-all duration-200 hover:scale-[1.02] hover:border-white/20`}
    >
      <div className={`absolute inset-0 bg-gradient-to-br ${accentStyles[accentColor]} opacity-50`} />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-slate-400">{title}</span>
          {icon && <span className={iconStyles[accentColor]}>{icon}</span>}
        </div>
        <div className="text-2xl font-bold text-white">{value}</div>
      </div>
    </div>
  )
}
