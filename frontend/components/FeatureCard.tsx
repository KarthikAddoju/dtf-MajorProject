import { ReactNode } from "react"

interface FeatureCardProps {
  title: string
  description: string
  icon: ReactNode
}

export function FeatureCard({ title, description, icon }: FeatureCardProps) {
  return (
    <div className="brand-panel group p-8 transition-all duration-300 hover:-translate-y-1">
      <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-[22px] border border-[#eedfce]/12 bg-[linear-gradient(145deg,rgba(210,91,54,0.16),rgba(131,188,217,0.14))] transition-transform duration-300 group-hover:scale-105">
        <div className="text-[#ffe0c5]">{icon}</div>
      </div>
      <div className="mb-4 h-px w-16 bg-gradient-to-r from-[#d25b36] to-[#8bbbd5]" />
      <h3 className="display-serif mb-3 text-[1.55rem] font-semibold text-[#f4efe5] text-balance">
        {title}
      </h3>
      <p className="leading-relaxed text-[#b4c0d1] text-pretty">{description}</p>
    </div>
  )
}
