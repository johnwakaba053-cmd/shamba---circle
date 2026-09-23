import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.join(__dirname),
  },
  allowedDevOrigins: ["10.211.229.2"],
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
};

export default nextConfig;
