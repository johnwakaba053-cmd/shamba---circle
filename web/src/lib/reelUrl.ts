// The canonical address of a Farming Reel is /reels/<posts.id> -- the
// same page a shared link opens. Used both server-side (page metadata)
// and client-side (the Share button), so it only reads NEXT_PUBLIC_*
// variables, which Next.js inlines into the browser bundle.
//
// The absolute origin is never hard-coded (no localhost / LAN IP):
//   1. NEXT_PUBLIC_SITE_URL, if set (e.g. a custom domain later);
//   2. NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL -- set automatically by
//      Vercel to the production domain (shamba-circle.vercel.app), so
//      links shared from any deployment point at production;
//   3. otherwise the origin of the current request/page (local dev).
export function reelPath(reelId: string): string {
  return `/reels/${reelId}`;
}

export function configuredSiteOrigin(): string | null {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }

  const vercelProduction = process.env.NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProduction) {
    return `https://${vercelProduction.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  }

  return null;
}

// Returning to a shared Reel after sign-in. The destination travels as
// ?next=<path> through /sign-in and /onboarding, and this allow-list is
// the ONLY thing that turns it back into a redirect target: it accepts
// exactly "/reels/<uuid>" and nothing else. Full URLs ("https://..."),
// protocol-relative "//host", backslashes, encoded characters, query
// strings, fragments or any other path all return null, so the caller
// falls back to its normal destination -- there is no open redirect.
const REEL_RETURN_PATH = /^\/reels\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const RETURN_TO_PARAM = "next";

export function safeReelReturnPath(value: unknown): string | null {
  return typeof value === "string" && REEL_RETURN_PATH.test(value) ? value : null;
}

// "/sign-in" or "/onboarding", carrying a safe Reel destination if any.
export function withReturnTo(path: string, returnTo: string | null): string {
  const safe = safeReelReturnPath(returnTo);
  return safe ? `${path}?${RETURN_TO_PARAM}=${encodeURIComponent(safe)}` : path;
}

export function reelShareUrl(reelId: string, fallbackOrigin: string): string {
  return `${configuredSiteOrigin() ?? fallbackOrigin.replace(/\/+$/, "")}${reelPath(reelId)}`;
}
