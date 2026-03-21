interface RoleBadgeProps {
  role: "student" | "admin" | "verifier"
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const styles = {
    student:
      "border border-[#8bbbd5]/20 bg-[#8bbbd5]/10 text-[#d8ebf5] before:bg-[#8bbbd5]",
    admin:
      "border border-[#d25b36]/25 bg-[#d25b36]/10 text-[#ffd7c8] before:bg-[#d25b36]",
    verifier:
      "border border-[#b8892d]/25 bg-[#b8892d]/10 text-[#f3d9a2] before:bg-[#b8892d]",
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] before:h-1.5 before:w-1.5 before:rounded-full ${styles[role]}`}
    >
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  )
}
