interface RoleBadgeProps {
  role: "student" | "admin" | "verifier"
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const styles = {
    student:
      "border border-[#4f7ef5]/25 bg-[#4f7ef5]/10 text-[#a5c0f8] before:bg-[#4f7ef5]",
    admin:
      "border border-rose-500/25 bg-rose-500/10 text-rose-300 before:bg-rose-400",
    verifier:
      "border border-amber-500/25 bg-amber-500/10 text-amber-200 before:bg-amber-400",
  }

  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-xs font-medium before:h-1.5 before:w-1.5 before:rounded-full ${styles[role]}`}
    >
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  )
}
