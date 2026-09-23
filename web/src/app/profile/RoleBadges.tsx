import { ROLE_LABELS } from "@/lib/roles";

// Small, subtle role indicators -- only ever shows roles the user actually
// has (no invented statistics, no placeholder badges). Renders nothing at
// all for an empty role list, matching how the public profile page
// already only renders its own badge row when `roles.length > 0`.
export function RoleBadges({ roles }: { roles: string[] }) {
  if (roles.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {roles.map((role) => (
        <span
          key={role}
          className="rounded-shamba border border-shamba-line bg-shamba-bg px-2 py-1 font-mono text-xs font-semibold text-shamba-ink-soft"
        >
          {ROLE_LABELS[role] ?? role}
        </span>
      ))}
    </div>
  );
}
