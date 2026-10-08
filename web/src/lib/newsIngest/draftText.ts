import { createHash } from "node:crypto";
import { isInstitutionTerm } from "./relevance";

// The words Shamba Space writes for an imported draft. Never the source's
// own text: the summary is built only from facts about the item (region,
// source, the farming topics the relevance check found), so it can't
// copy the article -- and N6c's readiness check refuses to publish a
// summary that matches the source excerpt anyway. Admins are expected to
// improve it before publishing.

type Region = "kenya" | "africa" | "global";

const REGION_ADJECTIVE: Record<Region, string> = {
  kenya: "Kenyan",
  africa: "African",
  global: "global",
};

// Too broad to say what a story is about.
const GENERIC_TERMS = new Set([
  "agriculture", "agricultural", "farm", "farms", "farmer", "farmers", "farming",
  "crop", "crops", "kilimo", "mkulima", "wakulima", "shamba",
]);

function topicPhrase(terms: string[]): string {
  const topics = terms.filter((term) => !GENERIC_TERMS.has(term) && !isInstitutionTerm(term)).slice(0, 2);
  if (topics.length === 0) return "farming";
  return topics.length === 1 ? topics[0] : `${topics[0]} and ${topics[1]}`;
}

// AllAfrica excerpts start with the original outlet in brackets
// ("[Capital FM] Nairobi -- ..."): credit it in the summary.
export function originalOutlet(excerpt: string): string | null {
  const match = /^\[([^\]]{2,60})\]/.exec(excerpt.trim());
  return match ? match[1].trim() : null;
}

function articleOrAn(word: string): string {
  return /^[aeiou]/i.test(word) ? "An" : "A";
}

export function draftSummary(item: {
  kind: "article" | "video";
  region: Region;
  sourceName: string;
  excerpt: string;
  matchedTerms: string[];
}): string {
  const topic = topicPhrase(item.matchedTerms);
  const adjective = REGION_ADJECTIVE[item.region];

  if (item.kind === "video") {
    return `${articleOrAn(adjective)} ${adjective} farming video from ${item.sourceName} on ${topic}. Watch it here through YouTube's player.`;
  }

  const outlet = originalOutlet(item.excerpt);
  const from = outlet ? `${outlet}, via ${item.sourceName}` : item.sourceName;
  return `${articleOrAn(adjective)} ${adjective} farming story from ${from} on ${topic}. Read the full report on ${item.sourceName}.`;
}

// A readable, unique slug: the headline in ASCII (at most ~70 characters,
// cut at a word) plus 8 characters of the external_ref's hash, so the
// same headline from two sources can't collide.
export function draftSlug(title: string, externalRef: string): string {
  const base = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  let cut = base.slice(0, 70);
  if (base.length > 70 && cut.includes("-")) cut = cut.slice(0, cut.lastIndexOf("-"));
  const suffix = createHash("sha256").update(externalRef).digest("hex").slice(0, 8);
  return `${cut.replace(/-+$/g, "") || "story"}-${suffix}`;
}
