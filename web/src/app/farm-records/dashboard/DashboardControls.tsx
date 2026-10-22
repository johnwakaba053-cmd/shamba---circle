"use client";

import Link from "next/link";
import { CalendarDays } from "lucide-react";
import { DASHBOARD_RANGES, type DashboardRange } from "@/lib/farmDashboard";

const SHORT_LABEL: Record<DashboardRange, string> = { "30": "30 days", "90": "90 days", "365": "12 months", all: "All time" };

// Farm picker and activity period. The farm picker is a plain GET form
// (works before scripts load; with scripts, choosing a farm applies it
// straight away, and the Apply button stays for keyboard and no-script
// use). The period is a row of links, so it needs no script at all.
export function DashboardControls({
  farms,
  farmId,
  range,
}: {
  farms: { id: string; name: string }[];
  farmId: string;
  range: DashboardRange;
}) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
      <form
        action="/farm-records/dashboard"
        method="get"
        onChange={(event) => event.currentTarget.requestSubmit()}
        className="flex items-center gap-2"
      >
        <label className="sr-only" htmlFor="dashboard-farm">
          Farm
        </label>
        <select
          id="dashboard-farm"
          name="farm"
          defaultValue={farmId}
          className="min-h-11 w-full rounded-shamba border border-shamba-line bg-shamba-card px-3 font-sans text-sm font-semibold text-shamba-ink focus:outline-none focus:ring-2 focus:ring-shamba-green sm:w-56"
        >
          {farms.length > 1 && <option value="all">All farms</option>}
          {farms.map((farm) => (
            <option key={farm.id} value={farm.id}>
              {farm.name}
            </option>
          ))}
        </select>
        <input type="hidden" name="range" value={range} />
        <button
          type="submit"
          className="sr-only focus:not-sr-only focus:min-h-11 focus:rounded-shamba focus:border focus:border-shamba-line focus:px-3 focus:text-sm focus:font-semibold"
        >
          Apply
        </button>
      </form>

      <nav aria-label="Activity period" className="flex items-center gap-2">
        <CalendarDays className="hidden size-4 shrink-0 text-shamba-ink-soft sm:block" aria-hidden="true" />
        <ul className="grid flex-1 grid-cols-4 rounded-full border border-shamba-line bg-shamba-card p-1 sm:flex sm:flex-none">
          {DASHBOARD_RANGES.map((option) => {
            const current = option.value === range;
            return (
              <li key={option.value}>
                <Link
                  href={`/farm-records/dashboard?farm=${encodeURIComponent(farmId)}&range=${option.value}`}
                  aria-current={current ? "page" : undefined}
                  className={`flex min-h-11 items-center justify-center whitespace-nowrap rounded-full px-3 font-sans text-xs font-semibold transition-colors ${
                    current ? "bg-shamba-green text-shamba-card" : "text-shamba-ink-soft hover:text-shamba-ink"
                  }`}
                >
                  {SHORT_LABEL[option.value]}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
