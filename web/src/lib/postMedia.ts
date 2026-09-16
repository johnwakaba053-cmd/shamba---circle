import type { SupabaseClient } from "@supabase/supabase-js";

export type PostMediaItem = {
  id: string;
  mediaType: "image" | "video";
  url: string;
};

const SIGNED_URL_EXPIRY_SECONDS = 3600;

// Shared by both the community page and the feed, since both need the
// identical "look up this post's attached media, then mint a short-lived
// signed URL per file" logic against the private post-media bucket. Kept
// as one helper (unlike most small per-page constants in this codebase)
// because a bug here would otherwise need fixing in two places.
export async function fetchPostMediaByPostId(
  supabase: SupabaseClient,
  postIds: string[],
): Promise<Map<string, PostMediaItem[]>> {
  const result = new Map<string, PostMediaItem[]>();
  if (postIds.length === 0) {
    return result;
  }

  const { data: mediaRows } = await supabase
    .from("post_media")
    .select("id, post_id, storage_path, media_type")
    .in("post_id", postIds)
    .order("created_at", { ascending: true });

  if (!mediaRows || mediaRows.length === 0) {
    return result;
  }

  const signedUrlResults = await Promise.all(
    mediaRows.map((row) =>
      supabase.storage.from("post-media").createSignedUrl(row.storage_path, SIGNED_URL_EXPIRY_SECONDS),
    ),
  );

  mediaRows.forEach((row, index) => {
    const url = signedUrlResults[index]?.data?.signedUrl;
    if (!url) return;

    const existing = result.get(row.post_id) ?? [];
    existing.push({
      id: row.id,
      mediaType: row.media_type === "video" ? "video" : "image",
      url,
    });
    result.set(row.post_id, existing);
  });

  return result;
}
