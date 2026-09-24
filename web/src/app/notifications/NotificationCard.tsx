"use client";

import Link from "next/link";
import {
  AtSign,
  Bell,
  BookOpen,
  Check,
  Heart,
  MessageCircle,
  Store,
  UserPlus,
} from "lucide-react";
import { getNotificationHref, type NotificationRow, type NotificationType } from "@/lib/notifications";

// Same icon vocabulary already established elsewhere in this app for
// the same concepts -- Bell for the generic alert type (matches the
// existing /alerts page and AppHeader's own Alerts link, per the
// product requirement that this visually fit the existing alerts
// system), UserPlus for follow (ReelFollowControl), MessageCircle for
// comments (ReelInteractionRail), Heart for reactions (ReelLikeControl),
// Store/BookOpen for marketplace/education (AppHeader's own nav icons).
// AtSign for mentions has no prior icon in this app, so this is the one
// new choice -- the standard, unambiguous symbol for the concept.
// private_message reuses MessageCircle too, matching the icon this app
// already established for private messaging specifically (AppHeader's
// "Messages" nav link, MessageActionButton) -- the same glyph already
// doing double duty for post_comment here is an accepted, pre-existing
// overlap, not something this change introduces or resolves.
const TYPE_ICON: Record<NotificationType, typeof Bell> = {
  alert: Bell,
  new_follower: UserPlus,
  post_comment: MessageCircle,
  post_reaction: Heart,
  mention: AtSign,
  marketplace: Store,
  education: BookOpen,
  private_message: MessageCircle,
};

const TYPE_LABELS: Record<NotificationType, string> = {
  alert: "Alert",
  new_follower: "New follower",
  post_comment: "Comment",
  post_reaction: "Reaction",
  mention: "Mention",
  marketplace: "Marketplace",
  education: "Education",
  private_message: "Message",
};

function formatNotificationTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function NotificationCard({
  notification,
  onOpen,
}: {
  notification: NotificationRow;
  onOpen: () => void;
}) {
  const isRead = Boolean(notification.read_at);
  const TypeIcon = TYPE_ICON[notification.type] ?? Bell;
  const typeLabel = TYPE_LABELS[notification.type] ?? notification.type;
  const href = getNotificationHref(notification);

  const content = (
    <>
      <span
        className={`flex size-9 shrink-0 items-center justify-center rounded-full ${
          isRead ? "bg-shamba-bg text-shamba-ink-soft" : "bg-shamba-green/10 text-shamba-green"
        }`}
      >
        <TypeIcon className="size-4" aria-hidden="true" />
      </span>

      <span className="flex min-w-0 flex-1 flex-col gap-0.5 text-left">
        <span className="flex items-center gap-2">
          <span className="font-mono text-xs font-semibold uppercase tracking-wide text-shamba-ink-soft">
            {typeLabel}
          </span>
          {!isRead && (
            <span
              className="size-1.5 shrink-0 rounded-full bg-shamba-green"
              aria-hidden="true"
            />
          )}
        </span>
        <span
          className={`text-base leading-snug text-shamba-ink ${isRead ? "font-medium" : "font-bold"}`}
        >
          {notification.title}
        </span>
        {notification.body && (
          <span className="text-sm leading-5 text-shamba-ink-soft">{notification.body}</span>
        )}
        <span className="mt-1 text-xs text-shamba-ink-soft">
          {formatNotificationTime(notification.created_at)}
        </span>
      </span>

      {isRead && (
        <span className="flex shrink-0 items-center gap-1 self-start text-xs text-shamba-ink-soft">
          <Check className="size-3.5" aria-hidden="true" />
          <span className="sr-only">Read</span>
        </span>
      )}
      {!isRead && <span className="sr-only">Unread</span>}
    </>
  );

  const sharedClassName = `flex w-full items-start gap-3 rounded-shamba border p-4 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-shamba-green ${
    isRead ? "border-shamba-line bg-shamba-card" : "border-shamba-green bg-shamba-card"
  } ${href ? "hover:border-shamba-green-deep" : ""}`;

  // Three distinct semantic shapes, chosen by what this card can
  // actually do -- never a clickable div standing in for a real
  // control. A destination -> a real <Link> (opening it also marks the
  // notification read). No destination but still unread -> a real
  // <button> (the only action left is "acknowledge/mark read"). No
  // destination and already read -> a plain, non-interactive wrapper,
  // since at that point there is genuinely nothing left to click.
  if (href) {
    return (
      <Link href={href} onClick={onOpen} className={sharedClassName}>
        {content}
      </Link>
    );
  }

  if (!isRead) {
    return (
      <button type="button" onClick={onOpen} className={sharedClassName}>
        {content}
      </button>
    );
  }

  return <div className={sharedClassName}>{content}</div>;
}
