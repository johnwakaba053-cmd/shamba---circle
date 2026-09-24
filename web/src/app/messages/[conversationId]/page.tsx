import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { getMyConversations, getConversationMessages, markConversationAsRead } from "@/lib/messaging";
import { MessageThread } from "./MessageThread";

const SIGNED_URL_EXPIRY_SECONDS = 3600;
// get_my_conversations() has no single-conversation variant yet (adding
// one would need a new migration, out of scope for this phase) -- a
// generous limit here is the pragmatic V1 tradeoff so this page can
// still find any of this farmer's conversations by id. Acceptable at
// this product's current scale; worth a dedicated RPC later if a farmer
// ever has more open conversations than this.
const CONVERSATION_LOOKUP_LIMIT = 100;

export default async function ConversationPage({
  params,
}: {
  params: Promise<{ conversationId: string }>;
}) {
  const { conversationId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // get_my_conversations() only ever returns rows where auth.uid() is a
  // genuine participant -- finding this id in its result IS the
  // participant check. A conversation that doesn't exist and a
  // conversation that exists but belongs to someone else both look
  // identical here (absent from the list), and are deliberately never
  // distinguished to the caller -- the same "never reveal which case it
  // is" treatment this app's own profile-privacy pages already use.
  const { conversations, error: conversationsError } = await getMyConversations(
    supabase,
    CONVERSATION_LOOKUP_LIMIT,
  );

  const conversation = conversations.find((c) => c.conversationId === conversationId);

  if (!conversationsError && !conversation) {
    notFound();
  }

  let avatarUrl: string | null = null;
  if (conversation?.otherAvatarPath) {
    const { data: signedUrlData } = await supabase.storage
      .from("avatars")
      .createSignedUrl(conversation.otherAvatarPath, SIGNED_URL_EXPIRY_SECONDS);
    avatarUrl = signedUrlData?.signedUrl ?? null;
  }

  const { messages, error: messagesError } = conversation
    ? await getConversationMessages(supabase, conversationId)
    : { messages: [], error: false };

  // Only after the conversation has been loaded and confirmed to belong
  // to this farmer -- never before, and never for one that failed the
  // check above.
  if (conversation) {
    await markConversationAsRead(supabase, conversationId);
  }

  return (
    <div className="flex min-h-[100dvh] flex-col bg-shamba-bg">
      <AppHeader />

      {conversationsError || !conversation ? (
        <main className="mx-auto flex w-full max-w-sm flex-1 flex-col items-center px-6 pt-16 text-center">
          <p role="alert" className="text-sm font-semibold text-shamba-rust">
            We couldn&apos;t load this conversation right now. Please try again later.
          </p>
        </main>
      ) : (
        <>
          <header className="sticky top-0 z-10 w-full border-b border-shamba-line bg-shamba-card">
            <div className="mx-auto flex w-full max-w-sm items-center gap-3 px-4 py-3">
              <Link
                href="/messages"
                aria-label="Back to Messages"
                className="flex size-9 shrink-0 items-center justify-center rounded-full text-shamba-ink-soft transition-colors hover:bg-shamba-bg hover:text-shamba-ink"
              >
                <ArrowLeft className="size-5" aria-hidden="true" />
              </Link>
              <span className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full border border-shamba-line bg-shamba-green/10">
                {avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- private, signed-URL bucket, same convention used across this app.
                  <img src={avatarUrl} alt="" className="size-full object-cover" />
                ) : (
                  <UserRound className="size-4 text-shamba-green" aria-hidden="true" />
                )}
              </span>
              <h1 className="min-w-0 flex-1 truncate font-display text-lg font-bold leading-tight text-shamba-ink">
                {conversation.otherDisplayName ?? "A farmer"}
              </h1>
            </div>
          </header>

          <MessageThread
            conversationId={conversationId}
            currentUserId={user.id}
            initialMessages={messages}
            loadFailed={messagesError}
          />
        </>
      )}
    </div>
  );
}
