import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// Agriculture Today files (covers, photo-story photos) live in the
// PRIVATE 'news-media' bucket (20261009110000): there are no public
// URLs. A page asks for short-lived signed URLs with the reader's own
// session, so Storage's policies decide: a signed-in reader gets files
// of live stories only, an admin gets every file. One request per page,
// however many files.
const SIGNED_URL_SECONDS = 60 * 60;

// path -> signed URL. A path the reader may not see (or that has no
// file) is simply missing from the map.
export async function signNewsMediaPaths(
  supabase: ServerClient,
  paths: (string | null | undefined)[],
): Promise<Map<string, string>> {
  const unique = [...new Set(paths.filter((path): path is string => Boolean(path)))];
  const urls = new Map<string, string>();
  if (unique.length === 0) return urls;

  const { data } = await supabase.storage.from("news-media").createSignedUrls(unique, SIGNED_URL_SECONDS);
  for (const item of data ?? []) {
    if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
  }
  return urls;
}
