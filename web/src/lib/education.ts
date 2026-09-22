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
  const qs = params.toString();
  return qs ? `/education?${qs}` : "/education";
}
