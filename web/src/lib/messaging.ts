import type { SupabaseClient } from "@supabase/supabase-js";
import { formatDaySeparator, formatMessageTime, isSameDay } from "@/lib/formatMessageTime";

export type ConversationSummary = {
  conversationId: string;
  otherProfileId: string;
  otherDisplayName: string | null;
  otherAvatarPath: string | null;
  lastMessageAt: string | null;
  myLastReadAt: string | null;
  unreadCount: number;
};

export type MessageRow = {
  id: string;
  conversationId: string;
  senderProfileId: string;
  body: string;
  createdAt: string;
};

const DEFAULT_CONVERSATION_LIMIT = 50;

// Every conversation-level read/write goes through the existing
// SECURITY DEFINER RPCs (get_my_conversations/get_or_create_conversation/
// mark_conversation_as_read) -- never a direct .from("conversations")
// query, since that table intentionally has no client-facing INSERT/
// UPDATE policy and its SELECT policy alone doesn't compute unread
// counts or resolve the other participant's identity. Message rows
// themselves (list/send/delete) are the one place this file does query
// public.messages directly -- that table's own RLS (participant-only
// SELECT, sender-only INSERT/DELETE, no UPDATE) is the entire security
// boundary there, exactly like every other plain-insert table in this
// app (post_comments, post_likes, follows, ...).
export async function getMyConversations(
  supabase: SupabaseClient,
  limit: number = DEFAULT_CONVERSATION_LIMIT,
): Promise<{ conversations: ConversationSummary[]; error: boolean }> {
  const { data, error } = await supabase.rpc("get_my_conversations", { p_limit: limit });

  if (error || !data) {
    return { conversations: [], error: Boolean(error) };
  }

  const rows = data as {
    conversation_id: string;
    other_profile_id: string;
    other_display_name: string | null;
    other_avatar_path: string | null;
    last_message_at: string | null;
    my_last_read_at: string | null;
    unread_count: number | string;
  }[];

  return {
    conversations: rows.map((row) => ({
      conversationId: row.conversation_id,
      otherProfileId: row.other_profile_id,
      otherDisplayName: row.other_display_name,
      otherAvatarPath: row.other_avatar_path,
      lastMessageAt: row.last_message_at,
      myLastReadAt: row.my_last_read_at,
      unreadCount: Number(row.unread_count),
    })),
    error: false,
  };
}

// The sole path to creating/finding a conversation -- the RPC itself
// derives the caller from auth.uid() and rejects self-messaging /
// nonexistent profiles server-side; this wrapper never second-guesses
// that, it only shapes the result. Returns `error: true` for any
// failure (unauthenticated, self-message, not found, or a genuine
// failure) -- the caller owns its own farmer-friendly copy for that,
// matching how every other lib helper in this app (postMedia.ts,
// notifications.ts) returns booleans/data rather than raw error text.
export async function getOrCreateConversation(
  supabase: SupabaseClient,
  otherProfileId: string,
): Promise<{ conversationId: string | null; error: boolean }> {
  const { data, error } = await supabase.rpc("get_or_create_conversation", {
    p_other_profile_id: otherProfileId,
  });

  if (error || !data) {
    return { conversationId: null, error: true };
  }

  return { conversationId: data as string, error: false };
}

// Advances only the caller's own read state, via the RPC -- never a
// direct update to conversations.participant_one_last_read_at/
// participant_two_last_read_at, which authenticated has no policy to
// write anyway. Returns false (not an error) if the caller isn't
// actually a participant -- fails safely, same as the RPC itself.
export async function markConversationAsRead(
  supabase: SupabaseClient,
  conversationId: string,
): Promise<boolean> {
  const { data, error } = await supabase.rpc("mark_conversation_as_read", {
    p_conversation_id: conversationId,
  });

  if (error) return false;
  return Boolean(data);
}

// Relies entirely on messages' own participant-only SELECT policy --
// never a client-side filter. A conversation the caller doesn't belong
// to (or a bogus id) returns zero rows here, not an error, exactly like
// every other RLS-protected read in this app degrades for an
// unauthorized id.
export async function getConversationMessages(
  supabase: SupabaseClient,
  conversationId: string,
  limit: number = 200,
): Promise<{ messages: MessageRow[]; error: boolean }> {
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_profile_id, body, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (error) {
    return { messages: [], error: true };
  }

  return {
    messages: (data ?? []).map((row) => ({
      id: row.id,
      conversationId: row.conversation_id,
      senderProfileId: row.sender_profile_id,
      body: row.body,
      createdAt: row.created_at,
    })),
    error: false,
  };
}

// senderProfileId must be the caller's own id (the composer derives it
// fresh from supabase.auth.getUser() right before calling this) -- but
// the real authorization boundary is messages' own INSERT policy
// (`with check (sender_profile_id = auth.uid() and <participant>)`),
// not this function: a forged senderProfileId would simply be rejected
// by Postgres regardless of what this wrapper does.
export async function sendMessage(
  supabase: SupabaseClient,
  conversationId: string,
  senderProfileId: string,
  body: string,
): Promise<{ message: MessageRow | null; error: boolean }> {
  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_profile_id: senderProfileId, body })
    .select("id, conversation_id, sender_profile_id, body, created_at")
    .single();

  if (error || !data) {
    return { message: null, error: true };
  }

  return {
    message: {
      id: data.id,
      conversationId: data.conversation_id,
      senderProfileId: data.sender_profile_id,
      body: data.body,
      createdAt: data.created_at,
    },
    error: false,
  };
}

// Belt-and-suspenders own-row filter (senderProfileId), matching
// PostDeleteControl/ReelDeleteControl's own exact convention -- the real
// enforcement is messages' "Senders can delete their own messages" RLS
// policy, which would reject this regardless of the extra .eq() here.
export async function deleteMessage(
  supabase: SupabaseClient,
  messageId: string,
  senderProfileId: string,
): Promise<boolean> {
  const { error } = await supabase
    .from("messages")
    .delete()
    .eq("id", messageId)
    .eq("sender_profile_id", senderProfileId);

  return !error;
}

// Inbox-only formatting: today's conversations show a bare time
// ("14:07", via formatMessageTime), anything older shows
// formatDaySeparator's own "YESTERDAY"/"22 SEPTEMBER" form -- reusing
// both existing helpers rather than adding a third date-formatting
// convention to this codebase.
export function formatConversationTimestamp(iso: string): string {
  const now = new Date().toISOString();
  return isSameDay(iso, now) ? formatMessageTime(iso) : formatDaySeparator(iso);
}
