// YouTube handling shared by Education (Watch & Learn) and News
// (Agriculture Today video stories). Moved here unchanged from
// lib/education.ts, which re-exports these names so Education's imports
// keep working.
//
// This is the one place allowed to turn a stored YouTube URL or ID into
// something rendered as a link, an iframe src or a thumbnail -- every
// other call site goes through here rather than trusting a raw string, so
// a malformed or non-YouTube value (javascript:, data:, an arbitrary
// domain) can never reach an <iframe src>, <img src> or <a href>.

// Formats a duration in seconds into a "1:05" / "12:34" / "1:00:00"
// label. Returns null (never an empty string) for a missing/invalid
// value, so callers can decide not to render a badge at all rather than
// rendering an empty one.
export function formatVideoDuration(
  durationSeconds: number | null | undefined,
): string | null {
  if (
    durationSeconds === null ||
    durationSeconds === undefined ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds < 0
  ) {
    return null;
  }

  const totalSeconds = Math.floor(durationSeconds);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const paddedSeconds = String(seconds).padStart(2, "0");

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${paddedSeconds}`;
  }
  return `${minutes}:${paddedSeconds}`;
}

// A real YouTube video ID is always 11 characters, but this pattern is
// deliberately a bit looser (6-20) so it doesn't reject a shorter
// placeholder/test ID outright -- length is a coarse sanity bound here,
// not the actual security boundary. The real boundary is upstream: only
// https://(www.)youtube.com/watch, youtu.be, and /shorts/ paths are ever
// inspected at all, so no other domain or scheme can produce a non-null
// result regardless of what's in the path or query string. News N4's
// news_media.embed_id check constraint uses the same pattern.
const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{6,20}$/;
const YOUTUBE_WATCH_HOSTNAMES = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
]);
const YOUTUBE_SHORT_HOSTNAMES = new Set(["youtu.be", "www.youtu.be"]);

export function isYouTubeVideoId(value: string | null | undefined): value is string {
  return typeof value === "string" && YOUTUBE_ID_PATTERN.test(value);
}

export function getYouTubeVideoId(
  url: string | null | undefined,
): string | null {
  if (!url) return null;

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  // Only ever https -- rules out javascript:, data:, and plain http.
  if (parsed.protocol !== "https:") return null;

  const hostname = parsed.hostname.toLowerCase();

  if (YOUTUBE_SHORT_HOSTNAMES.has(hostname)) {
    const id = parsed.pathname.slice(1).split("/")[0];
    return YOUTUBE_ID_PATTERN.test(id) ? id : null;
  }

  if (YOUTUBE_WATCH_HOSTNAMES.has(hostname)) {
    if (parsed.pathname === "/watch") {
      const id = parsed.searchParams.get("v");
      return id && YOUTUBE_ID_PATTERN.test(id) ? id : null;
    }
    if (parsed.pathname.startsWith("/shorts/")) {
      const id = parsed.pathname.slice("/shorts/".length).split("/")[0];
      return YOUTUBE_ID_PATTERN.test(id) ? id : null;
    }
  }

  return null;
}

export function isValidYouTubeUrl(url: string | null | undefined): boolean {
  return getYouTubeVideoId(url) !== null;
}

// youtube-nocookie.com is YouTube's own privacy-enhanced embed domain --
// it doesn't set tracking cookies until the viewer actually interacts with
// the player. videoId here must already be validated (getYouTubeVideoId
// or isYouTubeVideoId), never a raw stored string.
export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

// The canonical, normalized watch URL for a validated video ID -- used for
// the "Watch on YouTube" external link so it's always built from an ID
// that has already been validated, never from an original stored string
// (which might be a youtu.be or /shorts/ link).
export function getYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

// YouTube's own still for a validated video ID, from i.ytimg.com (the one
// remote image host next.config.ts allows). hqdefault exists for every
// video, unlike maxresdefault.
export function getYouTubeThumbnailUrl(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}
