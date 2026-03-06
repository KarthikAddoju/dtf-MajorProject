import { ReactNode } from "react"

interface FeatureCardProps {
  title: string
  description: string
  icon: ReactNode
}

export function FeatureCard({ title, description, icon }: FeatureCardProps) {
  return (
    <div className="group bg-white/5 backdrop-blur-lg border border-white/10 rounded-2xl p-8 shadow-xl transition-all duration-300 hover:scale-[1.02] hover:border-white/20 hover:bg-white/[0.07]">
      <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500/20 to-purple-500/20 border border-white/10 flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300">
        <div className="text-blue-400">{icon}</div>
      </div>
      <h3 className="text-xl font-semibold text-white mb-3 text-balance">{title}</h3>
      <p className="text-slate-400 leading-relaxed text-pretty">{description}</p>
    </div>
  )
}
