import type { SupabaseClient } from "@supabase/supabase-js";

// Mirrors the exact vocabulary the notifications foundation migration's
// CHECK constraints enforce -- kept as a plain union, not re-derived from
// anywhere else, since the database is the single source of truth for
// which values are actually valid.
export type NotificationType =
  | "alert"
  | "new_follower"
  | "post_comment"
  | "post_reaction"
  | "mention"
  | "marketplace"
  | "education";

export type NotificationEntityType =
  | "alert"
  | "profile"
  | "post"
  | "post_comment"
  | "listing"
  | "education_resource";

export type NotificationRow = {
  id: string;
  type: NotificationType;
  entity_type: NotificationEntityType | null;
  entity_id: string | null;
  actor_profile_id: string | null;
  title: string;
  body: string | null;
  payload: Record<string, unknown>;
  created_at: string;
  read_at: string | null;
};

// Same keyset-pagination shape Feed already uses (fetch one extra row to
// detect "is there more", then slice it back off) -- get_my_notifications()
// has no separate "has more" signal of its own, so this is computed here
// rather than adding one to the RPC.
export async function fetchMyNotifications(
  supabase: SupabaseClient,
  options?: { limit?: number; before?: string | null },
): Promise<{ notifications: NotificationRow[]; nextCursor: string | null; error: boolean }> {
  const limit = options?.limit ?? 20;

  const { data, error } = await supabase.rpc("get_my_notifications", {
    p_limit: limit + 1,
    p_before: options?.before ?? null,
  });

  if (error || !data) {
    return { notifications: [], nextCursor: null, error: Boolean(error) };
  }

  const rows = data as NotificationRow[];
  const hasMore = rows.length > limit;
  const notifications = rows.slice(0, limit);
  const nextCursor = hasMore ? (notifications[notifications.length - 1]?.created_at ?? null) : null;

  return { notifications, nextCursor, error: false };
}

export async function fetchMyUnreadNotificationCount(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc("get_my_notification_unread_count");
  if (error || data == null) {
    return 0;
  }
  return Number(data);
}

// The only place a notification's destination is decided -- never
// invented per entity_type. "post" and "post_comment" deliberately
// return null: Feed has no single-post route and Communities has no
// comment-level deep link, so there is no existing, safe destination to
// send a farmer to yet. A notification with no href still renders (see
// NotificationCard), it just isn't a link.
export function getNotificationHref(
  notification: Pick<NotificationRow, "entity_type" | "entity_id">,
): string | null {
  switch (notification.entity_type) {
    case "alert":
      // Alerts have no single-alert route -- the personalized list at
      // /alerts is the existing, safe destination.
      return "/alerts";
    case "profile":
      return notification.entity_id ? `/profile/${notification.entity_id}` : null;
    case "listing":
      return notification.entity_id ? `/marketplace/${notification.entity_id}` : null;
    case "education_resource":
      return notification.entity_id ? `/education/${notification.entity_id}` : null;
    default:
      return null;
  }
}
