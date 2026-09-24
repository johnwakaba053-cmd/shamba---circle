import { redirect } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { getMyConversations } from "@/lib/messaging";
import { ConversationListItem } from "./ConversationListItem";

const SIGNED_URL_EXPIRY_SECONDS = 3600;
const CONVERSATION_LIMIT = 50;

export default async function Messages() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // get_my_conversations() is the only source of data on this page --
  // a security-definer RPC scoped to auth.uid() internally, never a
  // direct .from("conversations") query and never a client-supplied
  // profile id.
  const { conversations, error } = await getMyConversations(supabase, CONVERSATION_LIMIT);

  // Signed URLs resolved server-side, one per conversation -- if the
  // other participant's profile is private, the avatars bucket's own
  // existing storage policy (can_view_profile_identity(), untouched by
  // this phase) will simply fail to mint a URL here, degrading
  // gracefully to the placeholder icon below rather than an error. The
  // RPC intentionally exposes their display_name/avatar_path as plain
  // values (an established-conversation exception, see the RPC's own
  // comments), but the actual avatar bytes stay behind the unmodified
  // privacy gate.
  const conversationsWithAvatar = await Promise.all(
    conversations.map(async (conversation) => {
      let avatarUrl: string | null = null;
      if (conversation.otherAvatarPath) {
        const { data: signedUrlData } = await supabase.storage
          .from("avatars")
          .createSignedUrl(conversation.otherAvatarPath, SIGNED_URL_EXPIRY_SECONDS);
        avatarUrl = signedUrlData?.signedUrl ?? null;
      }
      return { ...conversation, avatarUrl };
    }),
  );

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-6 px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-shamba-ink">
            Messages
          </h1>
          <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
            Private conversations with other farmers.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm font-semibold text-shamba-rust">
            We couldn&apos;t load your messages right now. Please try again later.
          </p>
        )}

        {!error && conversationsWithAvatar.length === 0 && (
          <div className="w-full max-w-sm rounded-shamba border border-shamba-line bg-shamba-card p-6">
            <MessageCircle className="size-7 text-shamba-ink-soft" aria-hidden="true" />
            <h2 className="mt-4 font-display text-lg font-semibold text-shamba-ink">
              Your farmer conversations will appear here.
            </h2>
            <p className="mt-2 text-sm leading-6 text-shamba-ink-soft">
              Connect with other farmers and start a private conversation.
            </p>
          </div>
        )}

        {!error && conversationsWithAvatar.length > 0 && (
          <div className="flex flex-col gap-2">
            {conversationsWithAvatar.map((conversation) => (
              <ConversationListItem key={conversation.conversationId} conversation={conversation} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
