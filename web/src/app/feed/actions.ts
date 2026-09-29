"use server";

import { createClient } from "@/lib/supabase/server";
import { fetchFeedPage } from "./feedData";
import type { Reel } from "./types";

export type LoadMoreReelsResult =
  | { ok: true; reels: Reel[]; nextCursor: string | null }
  | { ok: false };

// The next page of Farming Reels, loaded in place as a farmer nears the
// end of what's on screen (see ReelFeed.tsx) -- the same keyset cursor
// (`before` = the last loaded Reel's created_at) the old
// /feed?before=... link used, and the same fetchFeedPage() the page
// itself renders with, so pagination rules and every RLS boundary are
// identical. The caller is re-derived from the session here, never
// trusted from the client; a malformed cursor or signed-out caller gets
// { ok: false } rather than an exception, so the feed can offer Retry.
export async function loadMoreReels(before: string): Promise<LoadMoreReelsResult> {
  if (typeof before !== "string" || Number.isNaN(Date.parse(before))) {
    return { ok: false };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false };
    }

    const page = await fetchFeedPage(supabase, user.id, before);

    if (page.hasError) {
      return { ok: false };
    }

    return { ok: true, reels: page.reels, nextCursor: page.nextCursor };
  } catch {
    return { ok: false };
  }
}
