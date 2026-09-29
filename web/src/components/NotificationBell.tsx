import { Inbox } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchMyUnreadNotificationCount } from "@/lib/notifications";
import { NavLink } from "./NavLink";

const MAX_DISPLAYED_COUNT = 99;

// A self-contained async Server Component, not a prop AppHeader has to
// thread through -- AppHeader itself stays a plain, non-async component,
// and any page that already renders AppHeader gets the bell for free.
// The "Weather & Alerts" nav-link (pointing to /alerts) is the specific
// weather/pest/market-price system, a deliberately separate concept from
// this generic notification center, per the Phase 1 architecture
// decision to keep the two systems independent. Rendered as a labelled
// "Notifications" nav item (not an icon-only button) so a first-time
// farmer never has to guess what the Inbox icon means; the unread count
// sits beside the label.
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
    <NavLink
      href="/notifications"
      ariaLabel={unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications"}
    >
      <Inbox className="size-4" aria-hidden="true" />
      Notifications
      {unreadCount > 0 && (
        <span
          aria-hidden="true"
          className="inline-flex min-w-[1.1rem] items-center justify-center rounded-full bg-shamba-rust px-1 py-0.5 font-mono text-[10px] font-bold leading-none text-shamba-card"
        >
          {displayCount}
        </span>
      )}
    </NavLink>
  );
}
