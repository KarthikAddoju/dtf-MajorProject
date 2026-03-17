import { ReactNode } from "react"

interface MetricCardProps {
  title: string
  value: string | ReactNode
  icon?: ReactNode
  accentColor?: "blue" | "purple" | "yellow" | "green"
}

export function MetricCard({ title, value, icon, accentColor = "blue" }: MetricCardProps) {
  const accentStyles = {
    blue: "from-[#8bbbd5]/18 via-[#8bbbd5]/6 to-transparent",
    purple: "from-[#7b3448]/18 via-[#7b3448]/6 to-transparent",
    yellow: "from-[#f0c57f]/18 via-[#f0c57f]/6 to-transparent",
    green: "from-[#77997f]/18 via-[#77997f]/6 to-transparent",
  }

  const iconStyles = {
    blue: "text-[#c8e3f1]",
    purple: "text-[#efc3cf]",
    yellow: "text-[#ffe2af]",
    green: "text-[#d7ebd8]",
  }

  return (
    <div className="brand-panel min-h-[172px] p-6 transition-transform duration-200 hover:-translate-y-0.5">
      <div
        className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${accentStyles[accentColor]}`}
      />
      <div className="relative flex h-full flex-col justify-between gap-8">
        <div className="flex items-start justify-between gap-3">
          <span className="max-w-[12rem] text-[11px] uppercase tracking-[0.28em] text-[#90a1b9]">
            {title}
          </span>
          {icon && <span className={iconStyles[accentColor]}>{icon}</span>}
        </div>
        <div>
          <div className="display-serif text-[2rem] leading-none text-[#f4efe5] sm:text-[2.25rem]">
            {value}
          </div>
          <div className="mt-5 h-px bg-gradient-to-r from-[#d25b36]/50 via-[#8bbbd5]/35 to-transparent" />
        </div>
      </div>
    </div>
  )
}
