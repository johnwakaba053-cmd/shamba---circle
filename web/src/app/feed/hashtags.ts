import type { SupabaseClient } from "@supabase/supabase-js";

// Same character class as the hashtags_normalized_name_check CHECK
// constraint in the matching migration -- keep the two in sync.
const HASHTAG_PATTERN = /^[a-z0-9_]{1,50}$/;

// A soft cap on hashtags per Reel -- mirrors FeedComposer.tsx's own
// MAX_MEDIA_FILES cap on media: not a hard product requirement, just a
// sane bound so a pasted wall of text can't silently attach dozens of
// tags to one post.
export const MAX_HASHTAGS_PER_POST = 10;

// Strips a leading "#" (one or more, in case of a stray double-hash)
// and lowercases -- so #Avocado, #avocado and "avocado" all normalize
// to the same term and reuse the same hashtags row instead of creating
// separate duplicates.
function normalize(token: string): string | null {
  const stripped = token.trim().replace(/^#+/, "").toLowerCase();
  return HASHTAG_PATTERN.test(stripped) ? stripped : null;
}

export type ParsedHashtag = {
  // As the farmer typed it (# stripped, whitespace trimmed) -- used
  // for the hashtags.name display value and the composer's live
  // preview pills.
  display: string;
  // The normalized form -- used for hashtags.normalized_name, for
  // dedup within one Reel, and for the get-or-create lookup.
  normalized: string;
};

// Splits free-typed text on whitespace/commas into individual terms,
// normalizes each, and drops duplicates (by normalized form) and
// anything that fails the pattern. Used by both FeedComposer's live
// preview and its submit handler off the exact same input string, so
// what the user sees previewed is exactly what gets saved.
export function parseHashtagInput(raw: string): ParsedHashtag[] {
  const seen = new Set<string>();
  const result: ParsedHashtag[] = [];

  for (const token of raw.split(/[\s,]+/)) {
    if (token.length === 0) continue;
    const display = token.trim().replace(/^#+/, "");
    const normalized = normalize(display);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push({ display, normalized });
  }

  return result.slice(0, MAX_HASHTAGS_PER_POST);
}

export type PostHashtagsMap = Map<string, string[]>;

// Shared by feed/page.tsx, mirroring lib/postMedia.ts's
// fetchPostMediaByPostId: one batched query per Feed page load rather
// than one per post. Relies entirely on post_hashtags' own RLS (same
// community_id IS NULL / membership shape as post_media) to scope
// results -- no extra filtering needed here.
export async function fetchPostHashtagsByPostId(
  supabase: SupabaseClient,
  postIds: string[],
): Promise<PostHashtagsMap> {
  const result: PostHashtagsMap = new Map();
  if (postIds.length === 0) {
    return result;
  }

  const { data: rows } = await supabase
    .from("post_hashtags")
    .select("post_id, hashtags (name)")
    .in("post_id", postIds)
    .order("created_at", { ascending: true });

  // PostgREST returns a single nested object for this embed (post_hashtags
  // -> hashtags is many-to-one), but supabase-js's inferred type widens it
  // to an array without generated Database types -- cast through unknown
  // to the shape it actually returns at runtime.
  const typedRows = (rows ?? []) as unknown as {
    post_id: string;
    hashtags: { name: string } | null;
  }[];

  for (const row of typedRows) {
    const name = row.hashtags?.name;
    if (!name) continue;
    const existing = result.get(row.post_id) ?? [];
    existing.push(name);
    result.set(row.post_id, existing);
  }

  return result;
}
