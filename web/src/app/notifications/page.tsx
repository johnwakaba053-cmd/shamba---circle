import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { fetchMyNotifications, fetchMyUnreadNotificationCount } from "@/lib/notifications";
import { NotificationList } from "./NotificationList";

const PAGE_SIZE = 20;

export default async function Notifications() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // get_my_notifications()/get_my_notification_unread_count() are the
  // only source of data on this page -- both are security-definer RPCs
  // scoped to auth.uid() internally, never a direct
  // .from("notifications") query and never a client-supplied profile id.
  const [{ notifications, nextCursor, error }, unreadCount] = await Promise.all([
    fetchMyNotifications(supabase, { limit: PAGE_SIZE }),
    fetchMyUnreadNotificationCount(supabase),
  ]);

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-shamba-ink">
            Notifications
          </h1>
          <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
            Activity from across Shamba Space, in one place.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm font-semibold text-shamba-rust">
            We couldn&apos;t load your notifications right now. Please try again later.
          </p>
        )}

        {!error && notifications.length === 0 && (
          <div className="w-full max-w-sm rounded-shamba border border-shamba-line bg-shamba-card p-6">
            <Bell className="size-7 text-shamba-ink-soft" aria-hidden="true" />
            <h2 className="mt-4 font-display text-lg font-semibold text-shamba-ink">
              No new notifications
            </h2>
            <p className="mt-2 text-sm leading-6 text-shamba-ink-soft">
              When activity happens on Shamba Space, you&apos;ll see it here.
            </p>
          </div>
        )}

        {!error && notifications.length > 0 && (
          <NotificationList
            initialNotifications={notifications}
            initialNextCursor={nextCursor}
            initialUnreadCount={unreadCount}
          />
        )}
      </main>
    </div>
  );
}
