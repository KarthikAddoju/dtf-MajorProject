import { ReactNode } from "react"

interface FeatureCardProps {
  title: string
  description: string
  icon: ReactNode
}

export function FeatureCard({ title, description, icon }: FeatureCardProps) {
  return (
    <div className="brand-panel brand-card-hover group p-8">
      <div className="mb-6 flex h-14 w-14 items-center justify-center rounded-xl border border-white/[0.10] bg-[#1d2b4a] transition-transform duration-300 group-hover:scale-105">
        <div className="text-[#a5c0f8]">{icon}</div>
      </div>
      <div className="mb-4 h-px w-16 bg-gradient-to-r from-[#4f7ef5]/50 to-transparent" />
      <h3 className="mb-3 text-[1.3rem] font-semibold tracking-tight text-[#f0f0f0] text-balance">
        {title}
      </h3>
      <p className="leading-relaxed text-[#a0a0a0] text-pretty">{description}</p>
    </div>
  )
}
