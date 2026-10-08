import { headers } from "next/headers";
import { configuredSiteOrigin } from "@/lib/reelUrl";

// Shared by the /news pages' generateMetadata. News is public, so --
// unlike Reels -- link previews (WhatsApp, Facebook, X) show the real
// story: they're fetched signed-out, and RLS gives a signed-out request
// exactly the published articles.

export const NEWS_SITE_NAME = "Shamba Space";

// Used when an article has no cover, and for /news itself.
export const NEWS_FALLBACK_IMAGE = {
  url: "/icons/icon-512.png",
  width: 512,
  height: 512,
  alt: NEWS_SITE_NAME,
};

// The absolute origin for canonical and Open Graph URLs: the configured
// production origin (lib/reelUrl.ts), else this request's own host --
// the same rule the Reel page uses.
export async function newsSiteOrigin(): Promise<string> {
  const configured = configuredSiteOrigin();
  if (configured) return configured;

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const proto = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Link-preview text: one line, at most 160 characters.
export function previewText(text: string): string {
  const flat = text.replace(/\s+/g, " ").trim();
  return flat.length > 160 ? `${flat.slice(0, 157)}…` : flat;
}
