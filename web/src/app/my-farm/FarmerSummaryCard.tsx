import Link from "next/link";
import {
  BookOpen,
  ClipboardList,
  CloudSun,
  MapPin,
  Newspaper,
  PawPrint,
  Settings2,
  Sprout,
  TrendingUp,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NamedItem = { id: string; name: string };

// Shortcuts into the existing features My Farm summarises, in the same
// order as the cards below. Navigation only -- no counts or data.
const SHORTCUTS: { href: string; label: string; icon: LucideIcon }[] = [
  { href: "/weather", label: "Weather", icon: CloudSun },
  { href: "/farm-records", label: "Records", icon: ClipboardList },
  { href: "/market-prices", label: "Prices", icon: TrendingUp },
  { href: "/education", label: "Learn", icon: BookOpen },
  { href: "/news", label: "News", icon: Newspaper },
  { href: "/communities", label: "Communities", icon: Users },
];

// The top of My Farm: who and where, and what they farm, all from the
// preferences the farmer set in Profile (where every one of them is
// edited). Missing preferences get one plain line saying what to add; if
// they couldn't be read at all, it says so instead of asking the farmer
// to add what they may already have set.
export function FarmerSummaryCard({
  firstName,
  todayLabel,
  countyName,
  crops,
  livestock,
  loadFailed = false,
}: {
  firstName: string;
  todayLabel: string;
  countyName: string | null;
  crops: NamedItem[];
  livestock: NamedItem[];
  loadFailed?: boolean;
}) {
  const missing = loadFailed ? [] : [
    !countyName && "your county",
    crops.length === 0 && livestock.length === 0 && "what you grow or keep",
  ].filter(Boolean) as string[];

  return (
    <section className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-shamba-green-deep via-shamba-green-deep to-shamba-green p-5 text-shamba-card shadow-[0_12px_32px_-16px_rgb(42_74_40/0.6)] sm:p-7">
      {/* Decorative leaf mark, purely visual. */}
      <Sprout
        className="pointer-events-none absolute -right-6 -top-4 size-40 rotate-12 text-white/[0.06] sm:size-56"
        aria-hidden="true"
      />

      <div className="relative flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-mono text-xs font-medium uppercase tracking-wider text-white/70">{todayLabel}</p>
          <h1 className="mt-1.5 font-display text-3xl font-bold leading-tight tracking-tight sm:text-4xl">
            {firstName ? `Habari, ${firstName}` : "My Farm"}
          </h1>
          <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-sm font-medium text-white/90">
            <MapPin className="size-4 shrink-0" aria-hidden="true" />
            {countyName ? `${countyName} County` : loadFailed ? "County unavailable" : "No county set"}
          </p>
        </div>
        <Link
          href="/profile"
          className="relative inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-1.5 font-sans text-sm font-semibold text-shamba-card transition-colors hover:bg-white/20 touch-target"
        >
          <Settings2 className="size-4" aria-hidden="true" />
          Edit in Profile
        </Link>
      </div>

      {(crops.length > 0 || livestock.length > 0) && (
        <div className="relative mt-5">
          <h2 className="font-mono text-[11px] font-medium uppercase tracking-wider text-white/60">What you farm</h2>
          <ul aria-label="What you farm" className="mt-2 flex flex-wrap gap-1.5">
            {crops.map((crop) => (
              <li
                key={`crop-${crop.id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-sm font-semibold text-shamba-green-deep"
              >
                <Sprout className="size-3.5 text-shamba-green" aria-hidden="true" />
                {crop.name}
              </li>
            ))}
            {livestock.map((animal) => (
              <li
                key={`livestock-${animal.id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-shamba-ochre px-3 py-1 text-sm font-semibold text-white"
              >
                <PawPrint className="size-3.5" aria-hidden="true" />
                {animal.name}
              </li>
            ))}
          </ul>
        </div>
      )}

      {loadFailed && (
        <p role="alert" className="relative mt-4 rounded-xl bg-white p-3 text-sm leading-6 text-shamba-rust">
          We couldn&apos;t load your county, crops and livestock right now, so weather, prices and
          guides are hidden. Please try again later.
        </p>
      )}

      {missing.length > 0 && (
        <p className="relative mt-4 rounded-xl bg-white/10 p-3 text-sm leading-6 text-white">
          Add {missing.join(" and ")} in your{" "}
          <Link href="/profile" className="font-semibold underline underline-offset-2">
            Profile settings
          </Link>{" "}
          so My Farm can show weather, prices and guides that match your shamba.
        </p>
      )}

      <nav aria-label="My Farm shortcuts" className="relative mt-5 border-t border-white/15 pt-4">
        <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
          {SHORTCUTS.map(({ href, label, icon: Icon }) => (
            <li key={href}>
              <Link
                href={href}
                className="flex min-h-16 flex-col items-center justify-center gap-1.5 rounded-xl bg-white/10 px-1 py-2 font-sans text-xs font-semibold text-shamba-card transition-colors hover:bg-white/20"
              >
                <Icon className="size-5" aria-hidden="true" />
                {label}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </section>
  );
}
