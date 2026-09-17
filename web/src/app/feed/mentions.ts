import type { SupabaseClient } from "@supabase/supabase-js";

// A soft cap on mentions per Reel -- mirrors hashtags.ts's own
// MAX_HASHTAGS_PER_POST: not a hard product requirement, just a sane
// bound consistent with the rest of this composer.
export const MAX_MENTIONS_PER_POST = 10;

// One candidate returned by the search_public_profiles RPC (see the
// mentions foundation migration). display_name/roles are only ever
// populated for a public profile or the caller's own -- the RPC itself
// enforces that, this type doesn't add any filtering of its own.
export type MentionCandidate = {
  profileId: string;
  displayName: string;
  isPublic: boolean;
  roles: string[];
};

// Calls the existing search_public_profiles RPC -- never queries
// profiles directly. An empty query is valid and safe (the RPC's own
// WHERE clause degrades to "any public-or-self profile"), so "@" alone
// can show results immediately without waiting for a first character.
export async function searchMentionCandidates(
  supabase: SupabaseClient,
  query: string,
): Promise<MentionCandidate[]> {
  const { data, error } = await supabase.rpc("search_public_profiles", {
    p_query: query,
    p_limit: 10,
  });

  if (error || !data) {
    return [];
  }

  return (
    data as { profile_id: string; display_name: string; is_public: boolean; roles: string[] | null }[]
  ).map((row) => ({
    profileId: row.profile_id,
    displayName: row.display_name,
    isPublic: row.is_public,
    roles: row.roles ?? [],
  }));
}

export type ActiveMentionQuery = {
  query: string;
  // Index into the caption text where the triggering "@" sits -- used
  // to splice the selected candidate's name back into the caption at
  // the right spot.
  start: number;
};

// Finds the @query the caret is currently inside, if any. Deliberately
// simple: a single "word" (no whitespace) right after the last "@"
// before the caret, and that "@" must be at the start of the text or
// preceded by whitespace (so "user@example" mid-word text doesn't
// trigger it). Typing a space after the trigger closes it -- multi-word
// typed queries aren't supported, but search_public_profiles matches
// on the full display_name prefix, so a single word like "John" still
// finds "John Wakaba".
export function detectActiveMentionQuery(
  text: string,
  cursorPos: number,
): ActiveMentionQuery | null {
  const beforeCursor = text.slice(0, cursorPos);
  const atIndex = beforeCursor.lastIndexOf("@");

  if (atIndex === -1) {
    return null;
  }

  if (atIndex > 0 && !/\s/.test(beforeCursor[atIndex - 1])) {
    return null;
  }

  const candidate = beforeCursor.slice(atIndex + 1);
  if (/\s/.test(candidate)) {
    return null;
  }

  return { query: candidate, start: atIndex };
}

export type ReelMention = {
  profileId: string;
  // null when this viewer can no longer resolve the mentioned
  // profile's name (it's since gone private, and this viewer isn't
  // that profile) -- see fetchPostMentionsByPostId below.
  displayName: string | null;
};

export type PostMentionsMap = Map<string, ReelMention[]>;

// Shared by feed/page.tsx, mirroring fetchPostHashtagsByPostId's
// batched-query shape. Two passes: one query for every post -> profile
// link across the whole page, then one get_public_profile() call per
// DISTINCT mentioned profile (not per post, and not per mention) so a
// person mentioned across several Reels on the same page is only
// resolved once. get_public_profile is the same existing privacy
// boundary used everywhere else in this app -- it returns a null
// display_name for a profile that isn't public and isn't the viewer,
// which is exactly the "gracefully handle a now-private mention"
// behavior this needs, with no extra logic required here.
export async function fetchPostMentionsByPostId(
  supabase: SupabaseClient,
  postIds: string[],
): Promise<PostMentionsMap> {
  const result: PostMentionsMap = new Map();
  if (postIds.length === 0) {
    return result;
  }

  const { data: rows } = await supabase
    .from("post_mentions")
    .select("post_id, mentioned_profile_id")
    .in("post_id", postIds)
    .order("created_at", { ascending: true });

  if (!rows || rows.length === 0) {
    return result;
  }

  const distinctProfileIds = Array.from(new Set(rows.map((row) => row.mentioned_profile_id)));

  const profileResults = await Promise.all(
    distinctProfileIds.map((profileId) =>
      supabase.rpc("get_public_profile", { p_profile_id: profileId }),
    ),
  );

  const displayNameByProfileId = new Map<string, string | null>();
  distinctProfileIds.forEach((profileId, index) => {
    const row = (profileResults[index]?.data as { display_name: string | null }[] | null)?.[0];
    displayNameByProfileId.set(profileId, row?.display_name ?? null);
  });

  for (const row of rows) {
    const existing = result.get(row.post_id) ?? [];
    existing.push({
      profileId: row.mentioned_profile_id,
      displayName: displayNameByProfileId.get(row.mentioned_profile_id) ?? null,
    });
    result.set(row.post_id, existing);
  }

  return result;
}
