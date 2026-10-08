import { XMLParser } from "fast-xml-parser";
import { FEED_MAX_ITEMS } from "./config";

// One item as found in a feed, before any checks. Text is still raw
// (may contain HTML/entities); see text.ts.
export type RawFeedItem = {
  title: string;
  link: string | null;
  published: string | null;
  description: string;
  // YouTube channel feeds only.
  videoId: string | null;
};

export type ParsedFeed =
  | { ok: true; format: "rss" | "rdf" | "atom"; items: RawFeedItem[] }
  | { ok: false; error: string };

// Entity expansion is capped (fast-xml-parser's own limits, tightened),
// so a hostile feed can't blow up memory through entity tricks. Tags keep
// their namespace prefixes ("media:group", "yt:videoId", "dc:date").
const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  parseTagValue: false,
  parseAttributeValue: false,
  trimValues: true,
  ignoreDeclaration: true,
  ignorePiTags: true,
  processEntities: {
    enabled: true,
    maxEntitySize: 1_000,
    maxTotalExpansions: 500,
    maxExpandedLength: 50_000,
    maxEntityCount: 50,
  },
  isArray: (tagName) => tagName === "item" || tagName === "entry" || tagName === "link",
});

type Node = Record<string, unknown>;

function asNode(value: unknown): Node | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Node) : null;
}

// A tag's text whether it parsed as a plain string, a { "#text" } object
// (tag with attributes) or an array of either.
function textOf(value: unknown): string {
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value)) return textOf(value[0]);
  const node = asNode(value);
  if (node && "#text" in node) return textOf(node["#text"]);
  return "";
}

// RSS: <link>url</link>. Atom: <link href rel="alternate"/> (rel is
// optional and defaults to alternate).
function linkOf(value: unknown): string | null {
  const links = Array.isArray(value) ? value : value === undefined ? [] : [value];
  for (const link of links) {
    if (typeof link === "string" && link.trim()) return link.trim();
    const node = asNode(link);
    if (!node) continue;
    const rel = typeof node["@_rel"] === "string" ? node["@_rel"] : "alternate";
    if (rel === "alternate" && typeof node["@_href"] === "string") return node["@_href"];
    if (typeof node["#text"] === "string" && node["#text"].trim()) return node["#text"].trim();
  }
  return null;
}

function rssItem(item: Node): RawFeedItem {
  return {
    title: textOf(item.title),
    link: linkOf(item.link) ?? (textOf(item.guid).startsWith("http") ? textOf(item.guid) : null),
    published: textOf(item.pubDate) || textOf(item["dc:date"]) || null,
    description: textOf(item.description) || textOf(item["content:encoded"]),
    videoId: null,
  };
}

function atomEntry(entry: Node): RawFeedItem {
  const media = asNode(entry["media:group"]);
  return {
    title: textOf(entry.title),
    link: linkOf(entry.link),
    published: textOf(entry.published) || textOf(entry.updated) || null,
    description: textOf(media?.["media:description"]) || textOf(entry.summary) || textOf(entry.content),
    videoId: textOf(entry["yt:videoId"]) || null,
  };
}

export function parseFeed(xml: string): ParsedFeed {
  let doc: Node;
  try {
    doc = parser.parse(xml) as Node;
  } catch {
    return { ok: false, error: "malformed_xml" };
  }

  const rss = asNode(asNode(doc.rss)?.channel);
  if (rss) {
    const items = (Array.isArray(rss.item) ? rss.item : []).slice(0, FEED_MAX_ITEMS);
    return { ok: true, format: "rss", items: items.map((item) => rssItem(asNode(item) ?? {})) };
  }

  const rdf = asNode(doc["rdf:RDF"]);
  if (rdf) {
    const items = (Array.isArray(rdf.item) ? rdf.item : []).slice(0, FEED_MAX_ITEMS);
    return { ok: true, format: "rdf", items: items.map((item) => rssItem(asNode(item) ?? {})) };
  }

  const atom = asNode(doc.feed);
  if (atom) {
    const entries = (Array.isArray(atom.entry) ? atom.entry : []).slice(0, FEED_MAX_ITEMS);
    return { ok: true, format: "atom", items: entries.map((entry) => atomEntry(asNode(entry) ?? {})) };
  }

  return { ok: false, error: "not_a_feed" };
}
