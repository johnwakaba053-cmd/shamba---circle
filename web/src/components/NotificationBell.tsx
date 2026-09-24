import Link from "next/link";
import { Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchMyUnreadNotificationCount } from "@/lib/notifications";

const MAX_DISPLAYED_COUNT = 99;

// A self-contained async Server Component, not a prop AppHeader has to
// thread through -- AppHeader itself stays a plain, non-async component,
// and any page that already renders AppHeader gets the bell for free.
// The existing "Alerts" text nav-link (Bell icon, pointing to /alerts)
// is untouched: that is the specific weather/pest/market-price system, a
// deliberately separate concept from this generic notification center,
// per the Phase 1 architecture decision to keep the two systems
// independent. Uses Inbox rather than Bell specifically so the two
// header icons never look like duplicates of each other -- Inbox reads
// as "everything that's happened" (the generic activity center this
// actually is), distinct from Alerts' own Bell, which stays the
// recognizable icon for that specific weather/pest/market-price system.
export async function NotificationBell() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // AppHeader (this component's only caller) is only ever rendered on
  // pages that have already redirected an unauthenticated visitor to
  // /sign-in -- this check exists so the bell degrades to "render
  // nothing" rather than crashing if that assumption is ever violated,
  // not because it expects to actually run unauthenticated in practice.
  if (!user) {
    return null;
  }

  const unreadCount = await fetchMyUnreadNotificationCount(supabase);
  const displayCount =
    unreadCount > MAX_DISPLAYED_COUNT ? `${MAX_DISPLAYED_COUNT}+` : String(unreadCount);

  return (
    <Link
      href="/notifications"
      aria-label={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
      className="relative inline-flex size-9 items-center justify-center rounded-full text-shamba-ink-soft transition-colors hover:bg-shamba-bg hover:text-shamba-ink focus:outline-none focus:ring-2 focus:ring-shamba-green"
    >
      <Inbox className="size-5" aria-hidden="true" />
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          className="absolute -right-0.5 -top-0.5 inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-shamba-rust px-1 py-0.5 font-mono text-[10px] font-bold leading-none text-shamba-card"
        >
          {displayCount}
        </span>
      )}
    </Link>
  );
}
