import { ReactNode } from "react"
import { SpotlightCard } from "./SpotlightCard"

interface MetricCardProps {
  title: string
  value: string | ReactNode
  icon?: ReactNode
  accentColor?: "blue" | "purple" | "yellow" | "green"
}

const spotlightColors: Record<string, string> = {
  blue: "rgba(79, 126, 245, 0.10)",
  purple: "rgba(167, 139, 250, 0.10)",
  yellow: "rgba(245, 158, 11, 0.08)",
  green: "rgba(52, 211, 153, 0.08)",
}

export function MetricCard({ title, value, icon, accentColor = "blue" }: MetricCardProps) {
  const accentStyles = {
    blue: "from-[#4f7ef5]/12 via-[#4f7ef5]/4 to-transparent",
    purple: "from-[#a78bfa]/12 via-[#a78bfa]/4 to-transparent",
    yellow: "from-[#f59e0b]/10 via-[#f59e0b]/4 to-transparent",
    green: "from-[#34d399]/10 via-[#34d399]/4 to-transparent",
  }

  const iconStyles = {
    blue: "text-[#a5c0f8]",
    purple: "text-[#c4b5fd]",
    yellow: "text-amber-200",
    green: "text-emerald-300",
  }

  return (
    <SpotlightCard
      className="brand-panel brand-card-hover min-h-[172px] p-6"
      spotlightColor={spotlightColors[accentColor]}
    >
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accentStyles[accentColor]}`}
      />
      <div className="relative flex h-full flex-col justify-between gap-8">
        <div className="flex items-start justify-between gap-3">
          <span className="max-w-[12rem] text-[11px] text-[#666666]">
            {title}
          </span>
          {icon && <span className={iconStyles[accentColor]}>{icon}</span>}
        </div>
        <div>
          <div className="text-[2rem] font-semibold leading-none text-[#f0f0f0] sm:text-[2.25rem]">
            {value}
          </div>
          <div className="mt-5 h-px bg-gradient-to-r from-[#4f7ef5]/40 via-[#4f7ef5]/15 to-transparent" />
        </div>
      </div>
    </SpotlightCard>
  )
}
