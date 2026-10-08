import net from "node:net";
import { FEED_MAX_BYTES, FEED_TIMEOUT_MS, USER_AGENT } from "./config";

// When a host has both IPv4 and IPv6 addresses, Node tries one address,
// gives up on it after 250ms by default, and moves to the next. On
// networks with a slow-but-working path and a dead one (seen on a NAT64
// network: IPv4 connected in ~550ms, IPv6 hung), that abandons the
// working path, and the feed times out. Give each address 2.5s first.
// Process-wide, but it only changes how long a connection attempt waits
// before trying another address.
net.setDefaultAutoSelectFamilyAttemptTimeout(2_500);

export type FetchedFeed =
  | { ok: true; status: number; body: string; finalUrl: string }
  | { ok: false; status: number | null; error: string };

// Fetches one feed with a hard time limit and a hard size limit: the body
// is read as a stream and abandoned as soon as it passes FEED_MAX_BYTES,
// so a huge or endless response can't exhaust memory. Redirects are
// followed (fetch's own limit applies) but the final URL must still be
// https. Never throws: every failure comes back as { ok: false }.
export async function fetchFeed(url: string): Promise<FetchedFeed> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FEED_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      redirect: "follow",
      cache: "no-store",
      headers: {
        "User-Agent": USER_AGENT,
        Accept: "application/rss+xml, application/atom+xml, application/rdf+xml, application/xml;q=0.9, text/xml;q=0.8",
      },
    });

    if (!response.url.startsWith("https://")) {
      return { ok: false, status: response.status, error: "redirected_to_non_https" };
    }
    if (!response.ok) {
      return { ok: false, status: response.status, error: `http_${response.status}` };
    }

    const declared = Number(response.headers.get("content-length"));
    if (Number.isFinite(declared) && declared > FEED_MAX_BYTES) {
      return { ok: false, status: response.status, error: "too_large" };
    }

    if (!response.body) {
      return { ok: false, status: response.status, error: "empty_body" };
    }

    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > FEED_MAX_BYTES) {
        await reader.cancel();
        return { ok: false, status: response.status, error: "too_large" };
      }
      chunks.push(value);
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }

    return { ok: true, status: response.status, body: new TextDecoder("utf-8").decode(bytes), finalUrl: response.url };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    if (aborted) return { ok: false, status: null, error: "timeout" };
    // Keep the low-level code (e.g. a TLS certificate failure such as
    // SELF_SIGNED_CERT_IN_CHAIN) so the run log says why. Certificate
    // checks are never relaxed: such a feed simply fails.
    const cause = error instanceof Error ? (error.cause as { code?: unknown } | undefined) : undefined;
    const code = typeof cause?.code === "string" ? cause.code.replace(/[^A-Z0-9_]/gi, "").slice(0, 60) : "";
    return { ok: false, status: null, error: code ? `network_error:${code}` : "network_error" };
  } finally {
    clearTimeout(timer);
  }
}
