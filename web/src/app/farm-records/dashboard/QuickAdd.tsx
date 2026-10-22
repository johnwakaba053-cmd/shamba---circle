import Link from "next/link";
import { ChevronDown, Plus } from "lucide-react";

// Quick Add: shortcuts to the existing add forms. A native <details>
// menu, so it works without scripts. Plots, crops and livestock are
// added on a farm's own page, so with one farm in view the links jump
// straight to that section; with "All farms" they go to the farm list.
export function QuickAdd({ farm }: { farm: { id: string; name: string } | null }) {
  const itemClass =
    "flex min-h-11 flex-col justify-center rounded-xl px-3 py-1.5 font-sans text-sm text-shamba-ink hover:bg-shamba-bg";
  const target = (section: string) => (farm ? `/farm-records/${farm.id}#${section}` : "/farm-records");
  const where = farm ? `On ${farm.name}` : "Choose a farm first";

  return (
    <details className="group relative">
      <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 rounded-shamba bg-shamba-green px-4 font-sans text-sm font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep [&::-webkit-details-marker]:hidden">
        <Plus className="size-4" aria-hidden="true" />
        Quick Add
        <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
      </summary>
      <div className="absolute right-0 z-10 mt-2 w-64 rounded-2xl border border-shamba-line bg-shamba-card p-1.5 shadow-lg">
        <Link href="/farm-records/new" className={itemClass}>
          <span className="font-semibold">Add a farm</span>
        </Link>
        {(["plots", "crops", "livestock"] as const).map((section) => (
          <Link key={section} href={target(section)} className={itemClass}>
            <span className="font-semibold">
              {section === "plots" ? "Add a plot" : section === "crops" ? "Add a crop" : "Add livestock"}
            </span>
            <span className="text-xs text-shamba-ink-soft">{where}</span>
          </Link>
        ))}
      </div>
    </details>
  );
}
