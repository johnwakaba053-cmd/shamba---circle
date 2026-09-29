import type { NextConfig } from "next";
import os from "os";
import path from "path";

// Dev-only: Next.js blocks dev assets (JS chunks, HMR) for any origin
// other than localhost, so a phone opening http://<laptop-LAN-IP>:3000
// would get HTML with no working JavaScript. Rather than hard-coding an
// IP that DHCP changes (the old entry was a stale 10.211.229.2), this
// reads the laptop's current IPv4 addresses each time `next dev` starts.
// Skips loopback and 169.254.x.x link-local addresses (unconnected
// adapters). Extra hosts can be added with DEV_ALLOWED_ORIGINS, e.g.
// DEV_ALLOWED_ORIGINS=192.168.43.10,my-laptop.local
function detectLanHosts(): string[] {
  const hosts = new Set<string>();

  for (const addresses of Object.values(os.networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.family !== "IPv4" || address.internal) continue;
      if (address.address.startsWith("169.254.")) continue;
      hosts.add(address.address);
    }
  }

  for (const host of (process.env.DEV_ALLOWED_ORIGINS ?? "").split(",")) {
    if (host.trim()) hosts.add(host.trim());
  }

  return [...hosts];
}

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  allowedDevOrigins: detectLanHosts(),
  images: {
    // Scoped to exactly the one host Watch & Learn needs for YouTube
    // thumbnails (education_resources.thumbnail_url) -- not a general
    // allowance for arbitrary remote images. User-uploaded media
    // (marketplace listings, posts, stories) is served from private,
    // signed Supabase Storage URLs and intentionally rendered with plain
    // <img>, not next/image, elsewhere in the app.
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.ytimg.com",
      },
    ],
  },
  async headers() {
    return [
      {
        // The PWA service worker must never be served from an HTTP
        // cache, or phones would keep running an old version of it.
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
