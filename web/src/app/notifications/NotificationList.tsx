"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { NotificationRow } from "@/lib/notifications";
import { NotificationCard } from "./NotificationCard";

const PAGE_SIZE = 20;

export function NotificationList({
  initialNotifications,
  initialNextCursor,
  initialUnreadCount,
}: {
  initialNotifications: NotificationRow[];
  initialNextCursor: string | null;
  initialUnreadCount: number;
}) {
  const [notifications, setNotifications] = useState(initialNotifications);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [unreadCount, setUnreadCount] = useState(initialUnreadCount);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const [loadMoreFailed, setLoadMoreFailed] = useState(false);
  const [markAllFailed, setMarkAllFailed] = useState(false);

  // Optimistic, then fire-and-forget the RPC in the background -- same
  // pattern AlertCard's own "mark as read" already uses. Idempotent
  // server-side (mark_notification_as_read no-ops on an already-read or
  // foreign id), so a failure here just means the read state reverts on
  // the next full page load rather than corrupting anything.
  async function handleOpen(notification: NotificationRow) {
    if (notification.read_at) return;

    const readAt = new Date().toISOString();
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read_at: readAt } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));

    const supabase = createClient();
    const { error } = await supabase.rpc("mark_notification_as_read", {
      p_notification_id: notification.id,
    });

    if (error) {
      console.error("mark_notification_as_read failed", notification.id, error);
    }
  }

  async function handleMarkAll() {
    if (isMarkingAll || unreadCount === 0) return;

    setIsMarkingAll(true);
    setMarkAllFailed(false);

    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("mark_all_notifications_as_read");

      if (error) {
        console.error("mark_all_notifications_as_read failed", error);
        setMarkAllFailed(true);
        return;
      }

      const readAt = new Date().toISOString();
      setNotifications((prev) => prev.map((n) => (n.read_at ? n : { ...n, read_at: readAt })));
      setUnreadCount(0);
    } finally {
      setIsMarkingAll(false);
    }
  }

  async function handleLoadMore() {
    if (isLoadingMore || !nextCursor) return;

    setIsLoadingMore(true);
    setLoadMoreFailed(false);

    try {
      const supabase = createClient();
      const { data, error } = await supabase.rpc("get_my_notifications", {
        p_limit: PAGE_SIZE + 1,
        p_before: nextCursor,
      });

      if (error || !data) {
        console.error("get_my_notifications failed", error);
        setLoadMoreFailed(true);
        return;
      }

      const rows = data as NotificationRow[];
      const hasMore = rows.length > PAGE_SIZE;
      const page = rows.slice(0, PAGE_SIZE);

      setNotifications((prev) => [...prev, ...page]);
      setNextCursor(hasMore ? (page[page.length - 1]?.created_at ?? null) : null);
    } finally {
      setIsLoadingMore(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {unreadCount > 0 && (
        <div className="flex items-center justify-between gap-2">
          <p className="font-mono text-sm font-semibold text-shamba-green">{unreadCount} unread</p>
          <button
            type="button"
            onClick={handleMarkAll}
            disabled={isMarkingAll}
            className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-green transition-colors hover:text-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isMarkingAll && <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />}
            {isMarkingAll ? "Marking all as read…" : "Mark all as read"}
          </button>
        </div>
      )}

      {markAllFailed && (
        <p role="alert" className="text-sm font-semibold text-shamba-rust">
          Couldn&apos;t mark everything as read. Please try again.
        </p>
      )}

      <div className="flex flex-col gap-3">
        {notifications.map((notification) => (
          <NotificationCard
            key={notification.id}
            notification={notification}
            onOpen={() => handleOpen(notification)}
          />
        ))}
      </div>

      {nextCursor && (
        <button
          type="button"
          onClick={handleLoadMore}
          disabled={isLoadingMore}
          className="inline-flex w-fit items-center gap-2 self-center rounded-shamba border border-shamba-line px-6 py-3 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:border-shamba-green disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoadingMore && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isLoadingMore ? "Loading…" : "Load more"}
        </button>
      )}

      {loadMoreFailed && (
        <p role="alert" className="text-center text-sm font-semibold text-shamba-rust">
          Couldn&apos;t load more notifications. Please try again.
        </p>
      )}
    </div>
  );
}
