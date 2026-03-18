interface WalletBadgeProps {
  address: string
  label?: string
}

export function WalletBadge({ address, label = "Wallet" }: WalletBadgeProps) {
  const truncatedAddress = `${address.slice(0, 6)}...${address.slice(-4)}`

  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-[#eedfce]/12 bg-[#111a2a]/82 px-3.5 py-2 shadow-[0_12px_28px_rgba(4,8,16,0.22)] backdrop-blur-sm">
      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[#f2e7d7] text-[10px] font-semibold uppercase tracking-[0.22em] text-[#101828]">
        W
      </div>
      <div className="leading-none">
        <div className="brand-status-dot text-[10px] uppercase tracking-[0.24em] text-[#9eabbc]">
          {label}
        </div>
        <div className="mt-1 font-mono text-sm text-[#f3ecdf]">{truncatedAddress}</div>
      </div>
    </div>
  )
}
