interface WalletBadgeProps {
  address: string
  label?: string
}

export function WalletBadge({ address, label = "Wallet" }: WalletBadgeProps) {
  const truncatedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`

  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-white/[0.10] bg-[#1a1a1a] px-3.5 py-2">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#1d2b4a] text-[10px] font-semibold uppercase tracking-[0.14em] text-[#a5c0f8]">
        W
      </div>
      <div className="leading-none">
        <div className="brand-status-dot text-[10px] text-[#666666]">
          {label}
        </div>
        <div className="mt-1 font-mono text-sm text-[#f0f0f0]">{truncatedAddress}</div>
      </div>
    </div>
  )
}
