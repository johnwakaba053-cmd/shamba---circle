"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MessageCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { getOrCreateConversation } from "@/lib/messaging";

// Deliberately generic (takes only a profileId, no display context) so
// it can be dropped in anywhere the existing profile-privacy
// architecture already safely renders another farmer's identity --
// today that's only the visible branch of /profile/[id] (public or
// owner), matching ProfileFollowControl's own placement exactly. This
// component does not itself decide whether messaging should be allowed
// here -- get_or_create_conversation() is the actual authorization
// boundary (any authenticated farmer, per the approved V1 rule), so
// this can be reused unchanged if a future phase extends where a
// farmer's identity is safely visible.
export function MessageActionButton({ profileId }: { profileId: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleClick() {
    if (isLoading) return;
    setIsLoading(true);
    setErrorMessage(null);

    try {
      const supabase = createClient();
      const { conversationId, error } = await getOrCreateConversation(supabase, profileId);

      if (error || !conversationId) {
        setErrorMessage("We couldn't start that conversation. Please try again.");
        return;
      }

      router.push(`/messages/${conversationId}`);
    } catch {
      setErrorMessage("Something went wrong. Please try again in a moment.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleClick}
        disabled={isLoading}
        className="inline-flex items-center justify-center gap-2 rounded-shamba border border-shamba-line px-6 py-2.5 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading ? (
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
        ) : (
          <MessageCircle className="size-4" aria-hidden="true" />
        )}
        {isLoading ? "Opening…" : "Message"}
      </button>

      {errorMessage && (
        <p role="alert" className="text-xs font-semibold text-shamba-rust">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
