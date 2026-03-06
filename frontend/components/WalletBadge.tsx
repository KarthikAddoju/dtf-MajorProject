interface WalletBadgeProps {
  address: string
}

export function WalletBadge({ address }: WalletBadgeProps) {
  const truncatedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 backdrop-blur-sm border border-white/10 rounded-full">
      <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
      <span className="text-sm font-mono text-slate-300">{truncatedAddress}</span>
    </div>
  )
}
