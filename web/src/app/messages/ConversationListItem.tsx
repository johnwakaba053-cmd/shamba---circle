import Link from "next/link";
import { UserRound } from "lucide-react";
import type { ConversationSummary } from "@/lib/messaging";
import { formatConversationTimestamp } from "@/lib/messaging";

const MAX_DISPLAYED_UNREAD = 99;

// Plain presentational Server Component (no "use client" needed -- a
// <Link> renders fine without client JS) -- avatarUrl is resolved
// server-side by the page, the same "resolve once, pass a plain string"
// split already used for post/listing/story/profile media. Deliberately
// shows no last-message preview text: get_my_conversations() doesn't
// return message bodies, by design, so there is nothing to show here
// even if this component wanted to.
export function ConversationListItem({
  conversation,
}: {
  conversation: ConversationSummary & { avatarUrl: string | null };
}) {
  const hasUnread = conversation.unreadCount > 0;
  const displayUnread =
    conversation.unreadCount > MAX_DISPLAYED_UNREAD ? `${MAX_DISPLAYED_UNREAD}+` : conversation.unreadCount;

  return (
    <Link
      href={`/messages/${conversation.conversationId}`}
      className={`flex items-center gap-3 rounded-shamba border p-4 transition-colors focus:outline-none focus:ring-2 focus:ring-shamba-green ${
        hasUnread
          ? "border-shamba-green bg-shamba-card"
          : "border-shamba-line bg-shamba-card hover:border-shamba-green-deep"
      }`}
    >
      <span className="flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-full border border-shamba-line bg-shamba-green/10">
        {conversation.avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, signed-URL bucket, same convention used across this app.
          <img src={conversation.avatarUrl} alt="" className="size-full object-cover" />
        ) : (
          <UserRound className="size-6 text-shamba-green" aria-hidden="true" />
        )}
      </span>

      <span className="flex min-w-0 flex-1 items-center justify-between gap-2">
        <span
          className={`min-w-0 truncate font-sans text-base text-shamba-ink ${
            hasUnread ? "font-bold" : "font-semibold"
          }`}
        >
          {conversation.otherDisplayName ?? "A farmer"}
        </span>

        {conversation.lastMessageAt && (
          <span className="shrink-0 font-mono text-xs text-shamba-ink-soft">
            {formatConversationTimestamp(conversation.lastMessageAt)}
          </span>
        )}
      </span>

      {hasUnread && (
        <span
          aria-label={`${conversation.unreadCount} unread`}
          className="flex size-6 shrink-0 items-center justify-center rounded-full bg-shamba-green px-1.5 font-mono text-xs font-bold leading-none text-shamba-card"
        >
          {displayUnread}
        </span>
      )}
    </Link>
  );
}
