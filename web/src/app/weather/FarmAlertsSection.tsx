import Link from "next/link";
import { ArrowRight, Bell, CloudOff } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AlertCard, type Alert } from "@/components/AlertCard";

// Weather screen, Step 3: the farmer's alerts, below the forecast and in
// the same card style. Same data and cards as /alerts -- get_my_alerts()
// (the security-definer RPC that matches published, active alerts to the
// farmer's county/crops/livestock/settings) rendered with AlertCard -- so
// there is still only one alert system. Streams in behind <Suspense> and
// never depends on WeatherAPI, so a weather outage doesn't hide alerts.

export type FarmAlertsResult = { ok: true; alerts: Alert[] } | { ok: false };

// Never rejects (failures come back as { ok: false }), so the page can
// start it early and hand the promise down like the forecast.
export async function loadFarmAlerts(): Promise<FarmAlertsResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("get_my_alerts");
    if (error) {
      console.error("[weather] farm alerts unavailable:", error.message);
      return { ok: false };
    }
    return { ok: true, alerts: (data as Alert[] | null) ?? [] };
  } catch (err) {
    console.error("[weather] farm alerts unavailable:", err instanceof Error ? err.message : err);
    return { ok: false };
  }
}

const cardClass = "rounded-shamba border border-shamba-line bg-shamba-card p-5 sm:p-6";

function FarmAlertsHeading({ subtitle }: { subtitle: string }) {
  return (
    <div>
      <h2 id="farm-alerts-title" className="font-display text-lg font-bold leading-tight text-shamba-ink">
        Farm Alerts
      </h2>
      <p className="mt-1 text-sm text-shamba-ink-soft">{subtitle}</p>
    </div>
  );
}

export async function FarmAlertsSection({ alerts }: { alerts: Promise<FarmAlertsResult> }) {
  const result = await alerts;

  if (!result.ok) {
    return (
      <section aria-labelledby="farm-alerts-title" className={cardClass}>
        <FarmAlertsHeading subtitle="Weather, pest, disease and market alerts for your farm" />
        <div className="mt-4 flex flex-col items-center text-center">
          <CloudOff className="size-7 text-shamba-ink-soft" aria-hidden="true" />
          <p role="alert" className="mt-2 text-sm font-semibold text-shamba-ink">
            We couldn&apos;t load your farm alerts
          </p>
          <p className="mt-1 text-sm leading-6 text-shamba-ink-soft">Try again in a moment.</p>
          <Link
            href="/weather"
            className="mt-4 inline-flex items-center justify-center rounded-shamba border border-shamba-line px-6 py-3 font-sans text-base font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg"
          >
            Try again
          </Link>
        </div>
      </section>
    );
  }

  const unreadCount = result.alerts.filter((alert) => !alert.is_read).length;

  if (result.alerts.length === 0) {
    return (
      <section aria-labelledby="farm-alerts-title" className={cardClass}>
        <FarmAlertsHeading subtitle="Weather, pest, disease and market alerts for your farm" />
        <div className="mt-4 flex flex-col items-center rounded-shamba bg-shamba-bg p-5 text-center">
          <Bell className="size-7 text-shamba-ink-soft" aria-hidden="true" />
          <p className="mt-2 text-sm font-semibold text-shamba-ink">No alerts for your farm right now</p>
          <p className="mt-1 text-sm leading-6 text-shamba-ink-soft">
            Alerts are matched to the county, crops and livestock in your Profile.
          </p>
          <Link
            href="/profile"
            className="mt-3 inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-green transition-colors hover:text-shamba-green-deep relative touch-target"
          >
            Review your preferences
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </div>
      </section>
    );
  }

  // As on /alerts, the unread count reflects this page load; cards marked
  // read update themselves, the count updates on the next visit.
  return (
    <section aria-labelledby="farm-alerts-title" className={cardClass}>
      <FarmAlertsHeading
        subtitle={
          unreadCount > 0
            ? `${unreadCount} unread · matched to your county, crops and livestock`
            : "All caught up · matched to your county, crops and livestock"
        }
      />
      <div className="mt-4 flex flex-col gap-3">
        {result.alerts.map((alert) => (
          <AlertCard key={alert.id} alert={alert} />
        ))}
      </div>
    </section>
  );
}

// Placeholder in the same shape while the alerts stream in (also used by
// the route's loading.tsx).
export function FarmAlertsSkeleton() {
  return (
    <section role="status" aria-label="Loading farm alerts" className={cardClass}>
      <div className="h-5 w-28 animate-pulse rounded bg-shamba-line" />
      <div className="mt-2 h-4 w-56 max-w-full animate-pulse rounded bg-shamba-line" />
      <div className="mt-4 flex flex-col gap-3">
        {Array.from({ length: 2 }, (_, index) => (
          <div key={index} className="h-36 animate-pulse rounded-shamba bg-shamba-bg" />
        ))}
      </div>
    </section>
  );
}
