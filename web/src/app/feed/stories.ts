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
