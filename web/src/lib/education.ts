import {
  Bird,
  Briefcase,
  Bug,
  CloudSun,
  HelpCircle,
  Layers,
  PawPrint,
  ShieldCheck,
  Warehouse,
  Wheat,
} from "lucide-react";

// One icon per category id, shared by the landing and detail pages so
// the mapping only needs to be kept in sync with the seeded
// education_categories rows in one place.
export const EDUCATION_CATEGORY_ICON: Record<string, typeof Wheat> = {
  "crop-farming": Wheat,
  livestock: PawPrint,
  poultry: Bird,
  "soil-fertility": Layers,
  "pest-disease": Bug,
  "farm-business": Briefcase,
  "agri-insurance": ShieldCheck,
  "climate-weather": CloudSun,
  "post-harvest": Warehouse,
  "general-farming": HelpCircle,
};

export const EDUCATION_CATEGORY_FALLBACK_ICON = HelpCircle;

// Learning category is a separate concept from education_categories: a
// category is a broad subject area (Crop Farming, Livestock...), a
// learning category is a stage of learning that applies across any
// topic (Getting Started, Pests & Diseases...). Enforced at the database
// level by a check constraint on education_resources.learning_category,
// so this list must stay in sync with that constraint.
export const LEARNING_CATEGORIES = [
  "getting_started",
  "crop_management",
  "pests_diseases",
  "harvest_post_harvest",
  "marketing",
  "general",
] as const;

export type LearningCategory = (typeof LEARNING_CATEGORIES)[number];

export function isLearningCategory(value: unknown): value is LearningCategory {
  return (
    typeof value === "string" &&
    (LEARNING_CATEGORIES as readonly string[]).includes(value)
  );
}

export const LEARNING_CATEGORY_LABELS: Record<LearningCategory, string> = {
  getting_started: "Getting Started",
  crop_management: "Crop Management",
  pests_diseases: "Pests & Diseases",
  harvest_post_harvest: "Harvest & Post-Harvest",
  marketing: "Marketing",
  general: "General",
};

// Education 2.1: resource type + rights-aware source foundation. These
// types describe education_resources.resource_type/origin and the new
// education_sources lookup table -- no content, upload or search UI is
// built on top of them yet.
export const RESOURCE_TYPES = ["article", "document", "video"] as const;

export type ResourceType = (typeof RESOURCE_TYPES)[number];

export function isResourceType(value: unknown): value is ResourceType {
  return typeof value === "string" && (RESOURCE_TYPES as readonly string[]).includes(value);
}

export const RESOURCE_TYPE_LABELS: Record<ResourceType, string> = {
  article: "Article",
  document: "PDF / Document",
  video: "Video",
};

export const RESOURCE_ORIGINS = [
  "external_linked",
  "external_redistributable",
  "shamba_original",
] as const;

export type ResourceOrigin = (typeof RESOURCE_ORIGINS)[number];

export type EducationSource = {
  id: string;
  name: string;
  url: string | null;
};

// The one legally load-bearing rule this foundation exists for: a
// resource whose origin is external_linked (or not yet classified at
// all) must never expose a Shamba-hosted download action, regardless of
// is_downloadable -- that content isn't ours to redistribute, only to
// link to. Any future "Download PDF" UI must be gated through this
// function rather than reading is_downloadable directly, so it's
// structurally impossible to show a download action for the wrong
// origin by forgetting one check.
export function canShowDownloadAction(
  origin: ResourceOrigin | null,
  isDownloadable: boolean,
): boolean {
  if (origin === "external_linked" || origin === null) {
    return false;
  }
  return isDownloadable;
}

// Merges a change into the Education page's own URL filter state
// (category / topic / learning) -- same "build the next href from the
// current one" shape as Marketplace's buildMarketplaceHref, minus a
// pagination cursor, since Education has none. A field explicitly set to
// undefined in `overrides` clears it; a field left out of `overrides`
// keeps its current value.
export type EducationFilterParams = {
  category?: string;
  topic?: string;
  learning?: string;
  type?: string;
};

export function buildEducationHref(
  current: EducationFilterParams,
  overrides: EducationFilterParams,
): string {
  const next = { ...current, ...overrides };
  const params = new URLSearchParams();
  if (next.category) params.set("category", next.category);
  if (next.topic) params.set("topic", next.topic);
  if (next.learning) params.set("learning", next.learning);
  if (next.type) params.set("type", next.type);
  const qs = params.toString();
  return qs ? `/education?${qs}` : "/education";
}

// Watch & Learn: formats education_resources.duration_seconds into a
// farmer-facing "1:05" / "12:34" / "1:00:00" label. Returns null (never an
// empty string) for a missing/invalid value, so callers can decide not to
// render a badge at all rather than rendering an empty one.
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

// Watch & Learn: YouTube URL handling. This is the one place allowed to
// turn a stored youtube_url into something rendered as a link or an iframe
// src -- every other call site goes through here rather than trusting the
// raw string, so a malformed or non-YouTube value (javascript:, data:, an
// arbitrary domain) can never reach an <iframe src> or <a href>.
//
// A real YouTube video ID is always 11 characters, but this pattern is
// deliberately a bit looser (6-20) so it doesn't reject a shorter
// placeholder/test ID outright -- length is a coarse sanity bound here,
// not the actual security boundary. The real boundary is upstream: only
// https://(www.)youtube.com/watch, youtu.be, and /shorts/ paths are ever
// inspected at all, so no other domain or scheme can produce a non-null
// result regardless of what's in the path or query string.
const YOUTUBE_ID_PATTERN = /^[a-zA-Z0-9_-]{6,20}$/;
const YOUTUBE_WATCH_HOSTNAMES = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
]);
const YOUTUBE_SHORT_HOSTNAMES = new Set(["youtu.be", "www.youtu.be"]);

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
// the player. videoId here must already be the output of
// getYouTubeVideoId, never a raw stored string.
export function getYouTubeEmbedUrl(videoId: string): string {
  return `https://www.youtube-nocookie.com/embed/${videoId}`;
}

// The canonical, normalized watch URL for a validated video ID -- used for
// the "Watch on YouTube" external link so it's always built from an ID
// that has already passed getYouTubeVideoId, never from the original
// stored string (which might be a youtu.be or /shorts/ link).
export function getYouTubeWatchUrl(videoId: string): string {
  return `https://www.youtube.com/watch?v=${videoId}`;
}
