import Link from "next/link";
import { Bell, BellRing, ChevronRight, CircleCheck } from "lucide-react";
import type { FarmAlertsResult } from "@/app/weather/FarmAlertsSection";
import { DashboardCard, EmptyLine } from "./DashboardCard";

// My Farm's alerts line: the unread count and the newest unread alert's
// title, from the same get_my_alerts() load the Weather screen uses
// (loadFarmAlerts), so there is still only one alert system. The full
// alerts, with read/unread controls, stay on /alerts.
export async function AlertsSummarySection({ alerts }: { alerts: Promise<FarmAlertsResult> }) {
  return <AlertsSummaryCard result={await alerts} />;
}

export function AlertsSummaryCard({ result }: { result: FarmAlertsResult }) {
  const unread = result.ok
    ? result.alerts
        .filter((alert) => !alert.is_read)
        .sort((a, b) => b.starts_at.localeCompare(a.starts_at))
    : [];

  return (
    <DashboardCard
      icon={Bell}
      tone="bg-shamba-rust/10 text-shamba-rust"
      title="Farm Alerts"
      subtitle="For your county, crops and livestock"
      href="/alerts"
      linkLabel="All alerts"
    >
      {!result.ok ? (
        <EmptyLine>We couldn&apos;t load your alerts right now.</EmptyLine>
      ) : unread.length === 0 ? (
        <div className="flex items-start gap-3 rounded-xl bg-shamba-green/[0.07] px-3.5 py-3">
          <CircleCheck className="mt-0.5 size-5 shrink-0 text-shamba-green" aria-hidden="true" />
          <p className="text-sm leading-6 text-shamba-ink">
            {result.alerts.length === 0
              ? "No alerts for your county, crops or livestock right now."
              : "All caught up. No unread alerts."}{" "}
            <Link
              href="/profile"
              className="relative rounded-shamba font-semibold text-shamba-green underline-offset-2 hover:underline touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shamba-green"
            >
              Check your alert settings
            </Link>
          </p>
        </div>
      ) : (
        <Link
          href="/alerts"
          className="group flex items-center gap-3 rounded-xl border border-shamba-rust/20 bg-shamba-rust/[0.06] p-3.5 transition-colors hover:bg-shamba-rust/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shamba-green"
        >
          <span className="inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-shamba-rust text-white">
            <BellRing className="size-4" aria-hidden="true" />
          </span>
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="font-mono text-xs font-semibold uppercase tracking-wide text-shamba-rust">
              {unread.length} unread
            </span>
            <span className="line-clamp-2 text-sm font-semibold leading-5 text-shamba-ink">{unread[0].title}</span>
          </span>
          <ChevronRight
            className="size-5 shrink-0 text-shamba-rust transition-transform group-hover:translate-x-0.5"
            aria-hidden="true"
          />
        </Link>
      )}
    </DashboardCard>
  );
}
