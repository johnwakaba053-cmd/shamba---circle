import type { MetadataRoute } from "next";

// Served by Next.js at /manifest.webmanifest and linked from every page
// automatically. Colors are the existing design tokens in globals.css:
// --shamba-bg for the splash/status bar (so the installed app's chrome
// blends into the cream app surface) and the icons use --shamba-green
// with the same lucide Sprout mark AppHeader renders.
//
// start_url is the landing page ("/"): a signed-out first-time user
// opening the installed app sees what Shamba Space is before being asked
// for a phone number, and app/page.tsx redirects a signed-in farmer
// straight on to /communities (the same page sign-in lands on). Not
// /feed: the Reels feed has no AppHeader by design, so opening the
// installed app there would leave no in-app way to reach the rest of
// Shamba Space.
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Shamba Space",
    short_name: "Shamba Space",
    description:
      "Everything farming. In one space. Learn from farmers, share your farm, and get weather insights, communities, farming guides and a marketplace.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f3eedc",
    theme_color: "#f3eedc",
    categories: ["social", "education", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
