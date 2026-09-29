import { Clapperboard, CloudSun, Store, Users, type LucideIcon } from "lucide-react";

// The four product areas a first-time visitor is shown, in this order
// (the same order as AppHeader's nav), on the landing page and at the
// end of onboarding -- one shared list so the two first-impression
// surfaces always describe Shamba Space the same way. Everything else (market prices, education, messages, ...)
// is discovered once inside the app, deliberately not listed here.
//
// Weather links to the Weather screen (/weather). `tone` holds full
// class strings (not interpolated fragments) so Tailwind can see them.
export type ProductPillar = {
  key: string;
  icon: LucideIcon;
  label: string;
  description: string;
  href: string;
  tone: string;
};

export const PRODUCT_PILLARS: readonly ProductPillar[] = [
  {
    key: "communities",
    icon: Users,
    label: "Communities",
    description: "Farmers who grow what you grow",
    href: "/communities",
    tone: "bg-shamba-green/10 text-shamba-green",
  },
  {
    key: "reels",
    icon: Clapperboard,
    label: "Farming Reels",
    description: "Short videos from real farms",
    href: "/feed",
    tone: "bg-shamba-rust/10 text-shamba-rust",
  },
  {
    key: "weather",
    icon: CloudSun,
    label: "Weather",
    description: "Weather and farm alerts for your area",
    href: "/weather",
    tone: "bg-shamba-blue/10 text-shamba-blue",
  },
  {
    key: "marketplace",
    icon: Store,
    label: "Marketplace",
    description: "Buy and sell produce, inputs and services",
    href: "/marketplace",
    tone: "bg-shamba-ochre/15 text-shamba-ochre",
  },
];
