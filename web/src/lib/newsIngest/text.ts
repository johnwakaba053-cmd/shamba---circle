import { createHash } from "node:crypto";

// Turning feed text into safe plain text and feed links into stable
// identities. Nothing here ever produces HTML.

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  hellip: "…",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  laquo: "«",
  raquo: "»",
  middot: "·",
  bull: "•",
  copy: "©",
  reg: "®",
  trade: "™",
  deg: "°",
};

export function decodeEntities(value: string): string {
  return value.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === "#") {
      const code = entity[1] === "x" || entity[1] === "X" ? parseInt(entity.slice(2), 16) : parseInt(entity.slice(1), 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : "";
    }
    return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
  });
}

// Feed descriptions are often HTML (sometimes HTML that was itself
// entity-encoded). Decode, drop every tag, collapse whitespace, and remove
// WordPress's "The post ... appeared first on ..." footer.
export function toPlainText(value: unknown): string {
  if (typeof value !== "string") return "";
  let text = decodeEntities(value);
  text = text.replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ");
  text = text.replace(/<[^>]*>/g, " ");
  text = decodeEntities(text);
  text = text.replace(/The post .{1,300}? appeared first on .{1,200}?\.?\s*$/i, "");
  text = text.replace(/\[(?:…|\.\.\.|&hellip;)\]\s*$/u, "…");
  return text.replace(/\s+/g, " ").trim();
}

export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max - 1);
  const lastSpace = cut.lastIndexOf(" ");
  return `${(lastSpace > max * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

const TRACKING_PARAM = /^(utm_[a-z]+|fbclid|gclid|mc_cid|mc_eid|ref|ref_src|cmpid|ito|spm|igshid)$/i;

// The article's https URL without tracking parameters or fragment, or
// null if the link is missing, malformed or not https.
export function canonicalArticleUrl(value: unknown): string | null {
  if (typeof value !== "string" || !value.trim()) return null;
  let url: URL;
  try {
    url = new URL(decodeEntities(value.trim()));
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  url.hash = "";
  url.hostname = url.hostname.toLowerCase();
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAM.test(key)) url.searchParams.delete(key);
  }
  return url.toString();
}

// news_articles.external_ref for an imported item: stable across runs, so
// the same story is never imported twice.
export function articleExternalRef(canonicalUrl: string): string {
  return `url:${createHash("sha256").update(canonicalUrl).digest("hex")}`;
}

export function videoExternalRef(videoId: string): string {
  return `youtube:${videoId}`;
}

// For spotting the same headline from two feeds in one run.
export function titleKey(title: string): string {
  return title
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

// Whether two headlines (titleKey form) are the same story told almost
// the same way: identical, one containing the other ("... SUMMIT 2026" /
// "... SUMMIT 2026 #AFSS"), or sharing at least 80% of their words. Used
// to hold a new item for review, never to drop it.
export function similarHeadline(a: string, b: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const [shorter, longer] = a.length <= b.length ? [a, b] : [b, a];
  if (shorter.length >= 20 && longer.includes(shorter)) return true;
  const wordsA = new Set(a.split(" "));
  const wordsB = new Set(b.split(" "));
  if (wordsA.size < 4 || wordsB.size < 4) return false;
  let shared = 0;
  for (const word of wordsA) if (wordsB.has(word)) shared += 1;
  return shared / (wordsA.size + wordsB.size - shared) >= 0.8;
}

export function parseFeedDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const time = Date.parse(value.trim());
  return Number.isNaN(time) ? null : new Date(time);
}
