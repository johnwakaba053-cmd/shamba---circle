import type { SupabaseClient } from "@supabase/supabase-js";
import { reelPath } from "@/lib/reelUrl";

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
  | "education"
  | "private_message";

export type NotificationEntityType =
  | "alert"
  | "profile"
  | "post"
  | "post_comment"
  | "listing"
  | "education_resource"
  | "conversation";

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
): Promise<{ notifications: NotificationItem[]; nextCursor: string | null; error: boolean }> {
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
  const page = rows.slice(0, limit);
  const nextCursor = hasMore ? (page[page.length - 1]?.created_at ?? null) : null;
  const notifications = await attachNotificationReelIds(supabase, page);

  return { notifications, nextCursor, error: false };
}

export async function fetchMyUnreadNotificationCount(supabase: SupabaseClient): Promise<number> {
  const { data, error } = await supabase.rpc("get_my_notification_unread_count");
  if (error || data == null) {
    return 0;
  }
  return Number(data);
}

// A notification plus the Reel (posts.id) it is about, when it is about
// one. The notification triggers store:
//   - likes and mentions:            entity_type "post",         entity_id = the post (Reel) id;
//   - comments and comment reactions: entity_type "post_comment", entity_id = the COMMENT id,
// so for comments the Reel id is looked up (see attachNotificationReelIds).
export type NotificationItem = NotificationRow & { reelId: string | null };

// Resolves each notification's Reel id, with ONE batched post_comments
// lookup per page (never one per notification). post_comments is
// readable by any signed-in farmer under its existing RLS, so this reads
// nothing the recipient couldn't already read. A comment that has since
// been deleted simply resolves to null -- the card then isn't a link,
// exactly as before. Opening the Reel is still gated by /reels/[reelId]
// itself (Feed-level vs community membership), never by this link.
export async function attachNotificationReelIds(
  supabase: SupabaseClient,
  notifications: NotificationRow[],
): Promise<NotificationItem[]> {
  const commentIds = Array.from(
    new Set(
      notifications
        .filter((n) => n.entity_type === "post_comment" && n.entity_id)
        .map((n) => n.entity_id as string),
    ),
  );

  const postIdByCommentId = new Map<string, string>();
  if (commentIds.length > 0) {
    const { data } = await supabase.from("post_comments").select("id, post_id").in("id", commentIds);
    for (const row of (data ?? []) as { id: string; post_id: string }[]) {
      postIdByCommentId.set(row.id, row.post_id);
    }
  }

  return notifications.map((n) => ({
    ...n,
    reelId:
      n.entity_type === "post"
        ? n.entity_id
        : n.entity_type === "post_comment" && n.entity_id
          ? (postIdByCommentId.get(n.entity_id) ?? null)
          : null,
  }));
}

// The only place a notification's destination is decided -- never
// invented per entity_type. Reel notifications (likes, comments, comment
// reactions, mentions) open the Reel's canonical page, /reels/<id>, which
// itself enforces who may see it (members-only state for community Reels
// the recipient isn't a member of, not-found for a deleted Reel). A
// notification with no href still renders (see NotificationCard), it
// just isn't a link.
export function getNotificationHref(
  notification: Pick<NotificationRow, "entity_type" | "entity_id"> & { reelId?: string | null },
): string | null {
  switch (notification.entity_type) {
    case "post":
    case "post_comment":
      return notification.reelId ? reelPath(notification.reelId) : null;
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
    case "conversation":
      // /messages/[conversationId] already re-validates participant
      // access itself on every load (via get_my_conversations()) --
      // this link is never the security boundary, just a destination.
      return notification.entity_id ? `/messages/${notification.entity_id}` : null;
    default:
      return null;
  }
}
