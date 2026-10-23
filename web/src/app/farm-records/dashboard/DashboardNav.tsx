import Link from "next/link";
import {
  BarChart3,
  BookOpen,
  Boxes,
  ChevronRight,
  History,
  LayoutDashboard,
  PawPrint,
  Settings,
  Sprout,
  Users,
  Wallet,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

type Module = {
  label: string;
  description: string;
  icon: LucideIcon;
  href: string | null;
  tone: string;
};

// Farm Records modules. Only parts that exist are links; the rest are
// shown as "Not built yet" so nothing leads to a page that isn't there.
// Plots, crops, livestock and settings open the selected farm (or the
// farm list when "All farms" is chosen).
function modules(farmId: string | null): Module[] {
  const farm = farmId ? `/farm-records/${farmId}` : null;
  return [
    { label: "Farms", description: "Your farms and locations", icon: Warehouse, href: "/farm-records", tone: "bg-shamba-green/10 text-shamba-green" },
    { label: "Plots & Crops", description: "Land and crop seasons", icon: Sprout, href: farm ? `${farm}#plots` : "/farm-records", tone: "bg-shamba-green/10 text-shamba-green" },
    { label: "Livestock", description: "Herds, flocks and head counts", icon: PawPrint, href: farm ? `${farm}#livestock` : "/farm-records", tone: "bg-shamba-ochre/15 text-shamba-ochre" },
    { label: "Farm Diary", description: "Daily activities", icon: BookOpen, href: null, tone: "bg-shamba-blue/15 text-shamba-blue" },
    { label: "Inventory", description: "Supplies and stock levels", icon: Boxes, href: null, tone: "bg-shamba-ochre/15 text-shamba-ochre" },
    { label: "Finances", description: "Income and expenses", icon: Wallet, href: null, tone: "bg-shamba-rust/10 text-shamba-rust" },
    { label: "People & Work", description: "Staff, roles and tasks", icon: Users, href: null, tone: "bg-shamba-blue/15 text-shamba-blue" },
    { label: "Reports", description: "Farm snapshot and PDF", icon: BarChart3, href: farm ? `/farm-records/reports?farm=${encodeURIComponent(farmId ?? "")}` : "/farm-records/reports", tone: "bg-shamba-blue/15 text-shamba-blue" },
  ];
}

// Desktop: a dark green panel, as in the Farm Records reference.
export function DashboardSidebar({ farmId }: { farmId: string | null }) {
  const items = [
    { label: "Dashboard", icon: LayoutDashboard, href: "/farm-records/dashboard", current: true },
    ...modules(farmId).map((module) => ({ label: module.label, icon: module.icon, href: module.href, current: false })),
    { label: "Settings", icon: Settings, href: farmId ? `/farm-records/${farmId}/edit` : null, current: false },
  ];
  return (
    <nav aria-label="Farm Records" className="hidden lg:block">
      <ul className="sticky top-6 flex flex-col gap-0.5 rounded-2xl bg-shamba-green-deep p-2.5">
        {items.map((item) => (
          <li key={item.label}>
            {item.href ? (
              <Link
                href={item.href}
                aria-current={item.current ? "page" : undefined}
                className={`flex min-h-11 items-center gap-3 whitespace-nowrap rounded-xl px-3 font-sans text-sm font-semibold transition-colors ${
                  item.current ? "bg-shamba-card text-shamba-green-deep" : "text-shamba-card hover:bg-white/10"
                }`}
              >
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                {item.label}
              </Link>
            ) : (
              <span className="flex min-h-11 items-center gap-3 whitespace-nowrap px-3 font-sans text-sm text-shamba-card/60">
                <item.icon className="size-4 shrink-0" aria-hidden="true" />
                {item.label}
                <span className="ml-auto shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-shamba-card/80">
                  Not built yet
                </span>
              </span>
            )}
          </li>
        ))}
      </ul>
    </nav>
  );
}

// Desktop: module shortcut tiles under the dashboard.
export function ModuleShortcuts({ farmId }: { farmId: string | null }) {
  return (
    <section aria-labelledby="modules-heading" className="hidden lg:block">
      <h2 id="modules-heading" className="sr-only">
        Farm Records modules
      </h2>
      <ul className="grid grid-cols-4 gap-3 xl:grid-cols-8">
        {modules(farmId).map((module) => {
          const body = (
            <>
              <span className={`inline-flex size-10 items-center justify-center rounded-xl ${module.tone}`}>
                <module.icon className="size-5" aria-hidden="true" />
              </span>
              <span className="mt-2 font-display text-sm font-semibold text-shamba-ink">{module.label}</span>
              <span className="text-xs leading-4 text-shamba-ink-soft">{module.href ? module.description : "Not built yet"}</span>
            </>
          );
          return (
            <li key={module.label}>
              {module.href ? (
                <Link
                  href={module.href}
                  className="flex h-full flex-col items-center rounded-2xl border border-shamba-line bg-shamba-card p-3 text-center transition-colors hover:border-shamba-green"
                >
                  {body}
                </Link>
              ) : (
                <div className="flex h-full flex-col items-center rounded-2xl border border-dashed border-shamba-line bg-shamba-card/50 p-3 text-center opacity-70">
                  {body}
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// Phones: the farm at a glance -- what exists, with real counts, each
// opening the place it is managed.
export function FarmSummaryList({
  farmId,
  plots,
  seasons,
  groups,
}: {
  farmId: string | null;
  plots: number | null;
  seasons: number | null;
  groups: number | null;
}) {
  const farm = farmId ? `/farm-records/${farmId}` : "/farm-records";
  const rows = [
    { label: farmId ? "Farm details" : "Farms", icon: Warehouse, href: farmId ? `${farm}/edit` : farm, count: null },
    { label: "Plots", icon: Sprout, href: farmId ? `${farm}#plots` : farm, count: plots },
    { label: "Crop seasons", icon: Sprout, href: farmId ? `${farm}#crops` : farm, count: seasons },
    { label: "Livestock groups", icon: PawPrint, href: farmId ? `${farm}#livestock` : farm, count: groups },
    { label: "Recent activity", icon: History, href: "#recent-activity", count: null },
  ];
  return (
    <section aria-labelledby="farm-summary-heading" className="rounded-2xl border border-shamba-line bg-shamba-card p-2 lg:hidden">
      <h2 id="farm-summary-heading" className="px-2.5 pb-1 pt-2 font-display text-base font-semibold text-shamba-ink">
        Farm summary
      </h2>
      <ul className="flex flex-col divide-y divide-shamba-line">
        {rows.map((row) => (
          <li key={row.label}>
            <Link href={row.href} className="flex min-h-12 items-center gap-3 px-2.5 text-sm text-shamba-ink">
              <row.icon className="size-4 shrink-0 text-shamba-green" aria-hidden="true" />
              <span className="flex-1">
                {row.label}
                {row.count !== null && <span className="text-shamba-ink-soft"> ({row.count})</span>}
              </span>
              <ChevronRight className="size-4 text-shamba-ink-soft" aria-hidden="true" />
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
