"use client";

import { useState } from "react";
import { Loader2, Send, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { formatDaySeparator, formatMessageTime, isSameDay } from "@/lib/formatMessageTime";
import type { MessageRow } from "@/lib/messaging";
import { CommunityConversation } from "@/app/communities/[id]/CommunityConversation";

const MAX_BODY_LENGTH = 2000;

type DayGroup = { key: string; dateLabel: string; messages: MessageRow[] };

// Groups messages by Nairobi calendar day for a date-separator line --
// no author grouping needed (unlike Communities' burst logic), since
// this is always exactly two people and every message already shows
// who sent it via left/right alignment.
function groupByDay(messages: MessageRow[]): DayGroup[] {
  const groups: DayGroup[] = [];

  for (const message of messages) {
    const prevGroup = groups.at(-1);
    const prevMessage = prevGroup?.messages.at(-1);

    if (prevGroup && prevMessage && isSameDay(prevMessage.createdAt, message.createdAt)) {
      prevGroup.messages.push(message);
      continue;
    }

    groups.push({
      key: message.id,
      dateLabel: formatDaySeparator(message.createdAt),
      messages: [message],
    });
  }

  return groups;
}

// CommunityConversation.tsx (the fixed-bottom-composer + auto-scroll
// shell) is reused completely unmodified -- it has no community-specific
// logic at all, it only takes children/composer/scrollKey. Everything
// below it -- the messages table, its RLS, the RPCs -- is entirely
// separate from Communities' own posts/post_comments architecture.
export function MessageThread({
  conversationId,
  currentUserId,
  initialMessages,
  loadFailed,
}: {
  conversationId: string;
  currentUserId: string;
  initialMessages: MessageRow[];
  loadFailed: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [body, setBody] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const scrollKey = `${messages.length}:${messages.at(-1)?.id ?? "empty"}`;
  const dayGroups = groupByDay(messages);

  async function handleSend(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (isSending) return;

    const trimmed = body.trim();
    if (trimmed.length === 0) {
      setSendError("Write something before sending.");
      return;
    }

    setIsSending(true);
    setSendError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setSendError("Please sign in again.");
        return;
      }

      // Direct insert, RLS-protected (sender_profile_id = auth.uid() AND
      // caller is a participant) -- never trusted from anywhere else.
      const { data: newMessage, error } = await supabase
        .from("messages")
        .insert({ conversation_id: conversationId, sender_profile_id: user.id, body: trimmed })
        .select("id, conversation_id, sender_profile_id, body, created_at")
        .single();

      if (error || !newMessage) {
        setSendError("We couldn't send that. Please try again.");
        return;
      }

      setMessages((prev) => [
        ...prev,
        {
          id: newMessage.id,
          conversationId: newMessage.conversation_id,
          senderProfileId: newMessage.sender_profile_id,
          body: newMessage.body,
          createdAt: newMessage.created_at,
        },
      ]);
      setBody("");
    } catch {
      setSendError("Something went wrong. Please try again in a moment.");
    } finally {
      setIsSending(false);
    }
  }

  async function handleDelete(messageId: string) {
    if (deletingId) return;
    if (!window.confirm("Delete this message? This cannot be undone.")) return;

    setDeletingId(messageId);
    setDeleteError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setDeleteError("Please sign in again.");
        return;
      }

      const { error } = await supabase
        .from("messages")
        .delete()
        .eq("id", messageId)
        .eq("sender_profile_id", user.id);

      if (error) {
        setDeleteError("We couldn't delete that message. Please try again.");
        return;
      }

      setMessages((prev) => prev.filter((message) => message.id !== messageId));
    } catch {
      setDeleteError("Something went wrong. Please try again in a moment.");
    } finally {
      setDeletingId(null);
    }
  }

  const composer = (
    <form onSubmit={handleSend} className="flex flex-col gap-1.5">
      <div className="flex items-end gap-1.5">
        <label htmlFor="message-body" className="sr-only">
          Message
        </label>
        <textarea
          id="message-body"
          value={body}
          onChange={(event) => setBody(event.target.value.slice(0, MAX_BODY_LENGTH))}
          disabled={isSending}
          rows={1}
          maxLength={MAX_BODY_LENGTH}
          placeholder="Type a message…"
          className="min-h-11 max-h-32 flex-1 resize-none overflow-y-auto rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-2.5 font-sans text-base leading-6 text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
        />
        <button
          type="submit"
          disabled={isSending || body.trim().length === 0}
          aria-label="Send message"
          title="Send"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-shamba-green text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isSending ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {sendError && (
        <p role="alert" className="text-xs font-semibold text-shamba-rust">
          {sendError}
        </p>
      )}
    </form>
  );

  return (
    <CommunityConversation composer={composer} scrollKey={scrollKey}>
      {loadFailed && (
        <p role="alert" className="text-sm font-semibold text-shamba-rust">
          We couldn&apos;t load this conversation right now. Please try again later.
        </p>
      )}

      {!loadFailed && messages.length === 0 && (
        <p className="text-sm text-shamba-ink-soft">
          No messages yet. Say hello to start the conversation.
        </p>
      )}

      {!loadFailed && messages.length > 0 && (
        <div className="flex flex-col gap-5">
          {dayGroups.map((group) => (
            <div key={group.key}>
              <div className="mb-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-shamba-line" aria-hidden="true" />
                <span className="shrink-0 font-mono text-xs font-semibold tracking-wide text-shamba-ink-soft">
                  {group.dateLabel}
                </span>
                <div className="h-px flex-1 bg-shamba-line" aria-hidden="true" />
              </div>

              <div className="flex flex-col gap-2">
                {group.messages.map((message) => {
                  const isMine = message.senderProfileId === currentUserId;

                  return (
                    <div key={message.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[80%] rounded-shamba px-4 py-2.5 ${
                          isMine
                            ? "bg-shamba-green text-shamba-card"
                            : "border border-shamba-line bg-shamba-card text-shamba-ink"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words text-base leading-6">
                          {message.body}
                        </p>
                        <div className="mt-1 flex items-center justify-end gap-2">
                          <span
                            className={`font-mono text-[11px] ${
                              isMine ? "text-shamba-card/70" : "text-shamba-ink-soft"
                            }`}
                          >
                            {formatMessageTime(message.createdAt)}
                          </span>
                          {isMine && (
                            <button
                              type="button"
                              onClick={() => handleDelete(message.id)}
                              disabled={deletingId === message.id}
                              aria-label="Delete message"
                              className="text-shamba-card/70 transition-colors hover:text-shamba-card disabled:cursor-not-allowed disabled:opacity-60"
                            >
                              {deletingId === message.id ? (
                                <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                              ) : (
                                <Trash2 className="size-3.5" aria-hidden="true" />
                              )}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {deleteError && (
        <p role="alert" className="mt-2 text-sm font-semibold text-shamba-rust">
          {deleteError}
        </p>
      )}
    </CommunityConversation>
  );
}
