interface RoleBadgeProps {
  role: "student" | "admin"
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const styles = {
    student: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    admin: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  }

  return (
    <span
      className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border ${styles[role]}`}
    >
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  )
}
