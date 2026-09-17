import type { SupabaseClient } from "@supabase/supabase-js";

const STORY_MEDIA_SIGNED_URL_EXPIRY_SECONDS = 3600;

export type ActiveStory = {
  id: string;
  profileId: string;
  // null when this viewer can't resolve the creator's name (matches
  // the same get_public_profile-gated pattern used for post/Reel
  // mentions) -- rendered as a generic fallback, never a stale name.
  displayName: string | null;
  mediaType: "image" | "video";
  // Only ever populated for an image Story -- video thumbnails would
  // need frame extraction, which is out of scope this stage (no video
  // playback is being built at all yet).
  thumbnailUrl: string | null;
};

type StoryRow = {
  id: string;
  profile_id: string;
  media_type: string;
  media_path: string;
  created_at: string;
};

// Fetches the most recent active Story per distinct creator -- one
// bubble per person, not one per Story. Showing several bubbles for the
// same creator would look broken rather than "a future feature isn't
// built yet"; grouping for *display* is a basic correctness need here,
// separate from the future "progression through a creator's own
// multiple Stories" viewer feature.
//
// expires_at is filtered explicitly here on top of RLS: the stories
// SELECT policy also lets a caller see their own *expired* Stories (so
// a future management view can work), which is correct for RLS but
// wrong for this row -- only genuinely active Stories should ever
// render in the Feed's Stories strip, including the caller's own.
export async function fetchActiveStories(supabase: SupabaseClient): Promise<ActiveStory[]> {
  const { data: rows } = await supabase
    .from("stories")
    .select("id, profile_id, media_type, media_path, created_at")
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: false });

  const typedRows = (rows ?? []) as StoryRow[];
  if (typedRows.length === 0) {
    return [];
  }

  const latestByProfileId = new Map<string, StoryRow>();
  for (const row of typedRows) {
    if (!latestByProfileId.has(row.profile_id)) {
      latestByProfileId.set(row.profile_id, row);
    }
  }
  const latestStories = Array.from(latestByProfileId.values());

  // Same distinct-profile + get_public_profile() resolution pattern as
  // fetchPostMentionsByPostId (mentions.ts) -- never queries profiles
  // directly, and a private creator simply resolves to a null name.
  const profileResults = await Promise.all(
    latestStories.map((story) =>
      supabase.rpc("get_public_profile", { p_profile_id: story.profile_id }),
    ),
  );

  const displayNameByProfileId = new Map<string, string | null>();
  latestStories.forEach((story, index) => {
    const row = (profileResults[index]?.data as { display_name: string | null }[] | null)?.[0];
    displayNameByProfileId.set(story.profile_id, row?.display_name ?? null);
  });

  // Same batched signed-URL pattern as lib/postMedia.ts -- story-media
  // is a private bucket, never a public/CDN-style URL.
  const imageStories = latestStories.filter((story) => story.media_type === "image");
  const signedUrlResults = await Promise.all(
    imageStories.map((story) =>
      supabase.storage
        .from("story-media")
        .createSignedUrl(story.media_path, STORY_MEDIA_SIGNED_URL_EXPIRY_SECONDS),
    ),
  );
  const thumbnailByStoryId = new Map<string, string>();
  imageStories.forEach((story, index) => {
    const url = signedUrlResults[index]?.data?.signedUrl;
    if (url) thumbnailByStoryId.set(story.id, url);
  });

  return latestStories.map((story) => ({
    id: story.id,
    profileId: story.profile_id,
    displayName: displayNameByProfileId.get(story.profile_id) ?? null,
    mediaType: story.media_type === "video" ? "video" : "image",
    thumbnailUrl: thumbnailByStoryId.get(story.id) ?? null,
  }));
}

// === viewer support (Step 71C) =============================================
//
// fetchActiveStories above stays exactly as it was -- it's the "one
// bubble per creator" fetch StoriesRow needs, and nothing here changes
// its behavior or shape. The viewer needs something fetchActiveStories
// deliberately doesn't provide: a specific creator's *entire* active
// sequence, with full per-Story detail (caption/topic/hashtags/mentions
// and a playable signed URL for video too, not just an image
// thumbnail). Rather than bolt that onto the row's lighter fetch (which
// would make every page load resolve full detail for every creator,
// most of whom will never actually be opened), this is a second,
// narrower function called on demand, client-side, only once a specific
// creator's bubble (or "Your Story") is actually tapped.

export type StoryMention = {
  profileId: string;
  displayName: string | null;
};

export type StoryDetail = {
  id: string;
  profileId: string;
  displayName: string | null;
  mediaType: "image" | "video";
  mediaUrl: string | null;
  // The raw storage object path (not the signed mediaUrl above) -- the
  // only thing StoryViewer's delete control needs it for is passing it
  // straight to storage.remove(), which takes a path, not a URL.
  mediaPath: string;
  caption: string | null;
  topic: string | null;
  hashtags: string[];
  mentions: StoryMention[];
  createdAt: string;
};

type StoryDetailRow = {
  id: string;
  profile_id: string;
  media_type: string;
  media_path: string;
  caption: string | null;
  topic: string | null;
  created_at: string;
};

// Fetches one creator's full active Story sequence, oldest first (the
// order the viewer progresses through). expires_at is re-checked fresh
// here -- this is the authoritative "is this still active" read the
// viewer relies on, never the (potentially stale, fetched at page-load
// time) StoriesRow data.
export async function fetchCreatorActiveStories(
  supabase: SupabaseClient,
  profileId: string,
): Promise<StoryDetail[]> {
  const { data: rows } = await supabase
    .from("stories")
    .select("id, profile_id, media_type, media_path, caption, topic, created_at")
    .eq("profile_id", profileId)
    .gt("expires_at", new Date().toISOString())
    .order("created_at", { ascending: true });

  const typedRows = (rows ?? []) as StoryDetailRow[];
  if (typedRows.length === 0) {
    return [];
  }

  const storyIds = typedRows.map((row) => row.id);

  const [profileResult, hashtagRowsResult, mentionRowsResult, signedUrlResults] =
    await Promise.all([
      supabase.rpc("get_public_profile", { p_profile_id: profileId }),
      supabase.from("story_hashtags").select("story_id, hashtags (name)").in("story_id", storyIds),
      supabase.from("story_mentions").select("story_id, mentioned_profile_id").in("story_id", storyIds),
      Promise.all(
        typedRows.map((row) =>
          supabase.storage
            .from("story-media")
            .createSignedUrl(row.media_path, STORY_MEDIA_SIGNED_URL_EXPIRY_SECONDS),
        ),
      ),
    ]);

  const displayName =
    (profileResult.data as { display_name: string | null }[] | null)?.[0]?.display_name ?? null;

  // Same embed-shape caveat as fetchPostHashtagsByPostId (hashtags.ts):
  // PostgREST returns a single nested object for this to-one embed, but
  // supabase-js widens the inferred type to an array without generated
  // Database types.
  const hashtagRows = (hashtagRowsResult.data ?? []) as unknown as {
    story_id: string;
    hashtags: { name: string } | null;
  }[];
  const hashtagsByStoryId = new Map<string, string[]>();
  for (const row of hashtagRows) {
    const name = row.hashtags?.name;
    if (!name) continue;
    const existing = hashtagsByStoryId.get(row.story_id) ?? [];
    existing.push(name);
    hashtagsByStoryId.set(row.story_id, existing);
  }

  // Mentions need their own distinct-profile resolution pass, same
  // shape as fetchPostMentionsByPostId (mentions.ts).
  const mentionRows = (mentionRowsResult.data ?? []) as {
    story_id: string;
    mentioned_profile_id: string;
  }[];
  const distinctMentionedIds = Array.from(new Set(mentionRows.map((row) => row.mentioned_profile_id)));
  const mentionProfileResults = await Promise.all(
    distinctMentionedIds.map((id) => supabase.rpc("get_public_profile", { p_profile_id: id })),
  );
  const mentionNameById = new Map<string, string | null>();
  distinctMentionedIds.forEach((id, index) => {
    const row = (mentionProfileResults[index]?.data as { display_name: string | null }[] | null)?.[0];
    mentionNameById.set(id, row?.display_name ?? null);
  });
  const mentionsByStoryId = new Map<string, StoryMention[]>();
  for (const row of mentionRows) {
    const existing = mentionsByStoryId.get(row.story_id) ?? [];
    existing.push({
      profileId: row.mentioned_profile_id,
      displayName: mentionNameById.get(row.mentioned_profile_id) ?? null,
    });
    mentionsByStoryId.set(row.story_id, existing);
  }

  const urlByStoryId = new Map<string, string>();
  typedRows.forEach((row, index) => {
    const url = signedUrlResults[index]?.data?.signedUrl;
    if (url) urlByStoryId.set(row.id, url);
  });

  return typedRows.map((row) => ({
    id: row.id,
    profileId: row.profile_id,
    displayName,
    mediaType: row.media_type === "video" ? "video" : "image",
    mediaUrl: urlByStoryId.get(row.id) ?? null,
    mediaPath: row.media_path,
    caption: row.caption,
    topic: row.topic,
    hashtags: hashtagsByStoryId.get(row.id) ?? [],
    mentions: mentionsByStoryId.get(row.id) ?? [],
    createdAt: row.created_at,
  }));
}
