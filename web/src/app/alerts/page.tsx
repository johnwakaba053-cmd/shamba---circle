import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { AlertCard, type Alert } from "@/components/AlertCard";

export default async function Alerts() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // get_my_alerts() is the only source of alert data for this page: a
  // security-definer RPC that matches published, currently-active
  // alerts against this farmer's own county/crop/livestock/notification
  // preferences server-side. Nothing here queries alerts, its scope
  // tables, or any farmer_* preference table directly -- the RPC is the
  // security boundary, not row-level filtering in this component.
  const { data, error } = await supabase.rpc("get_my_alerts");
  const alerts = data as Alert[] | null;

  // Computed once from this same fetch, not a live cross-component
  // count -- consistent with how the rest of this app already works
  // (e.g. like/comment counts are per-card, not page-level aggregates).
  // It reflects state as of this page load; a farmer sees it update on
  // their next visit/refresh, same as everything else here.
  const unreadCount = (alerts ?? []).filter((alert) => !alert.is_read).length;

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-shamba-ink">
            Alerts
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-6 text-shamba-ink-soft">
            Matched to the county, crops, and livestock you&apos;ve set in
            your farmer preferences. This is a preview of Shamba Circle&apos;s
            alert system, not a live, real-time feed yet.
          </p>

          {!error && (alerts?.length ?? 0) > 0 && (
            <p className="mt-2 font-mono text-sm font-semibold text-shamba-green">
              {unreadCount > 0
                ? `${unreadCount} unread`
                : "All caught up — no unread alerts"}
            </p>
          )}
        </div>

        {error && (
          <p role="alert" className="text-sm font-semibold text-shamba-rust">
            We couldn&apos;t load your alerts right now. Please try again
            later.
          </p>
        )}

        {!error && (alerts?.length ?? 0) === 0 && (
          <div className="w-full max-w-sm rounded-shamba border border-shamba-line bg-shamba-card p-6">
            <Bell className="size-7 text-shamba-ink-soft" aria-hidden="true" />
            <h2 className="mt-4 font-display text-lg font-semibold text-shamba-ink">
              No alerts matching your current preferences
            </h2>
            <p className="mt-2 text-sm leading-6 text-shamba-ink-soft">
              This list is personalized to your county, crops, livestock, and
              alert settings. Review or update them to see what you might be
              missing.
            </p>
            <Link
              href="/profile"
              className="mt-4 inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-green transition-colors hover:text-shamba-green-deep"
            >
              Review your preferences
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </div>
        )}

        {!error && alerts && alerts.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {alerts.map((alert) => (
              <AlertCard key={alert.id} alert={alert} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
