import { Earth, Globe } from "lucide-react";
import type { NewsRegion } from "@/lib/news";

// Each region's colours on /news: the tag on a story's picture, and the
// panel that stands in for a picture when a story has none (imported
// stories never carry the publisher's images). Full class strings so
// Tailwind can see them. Africa's tag uses dark text: white on ochre is
// too faint for small text.
export const NEWS_REGION_TONE: Record<NewsRegion, { tag: string; panel: string; soft: string }> = {
  kenya: {
    tag: "bg-shamba-green text-shamba-card",
    panel: "from-shamba-green to-shamba-green-deep",
    soft: "bg-shamba-green/10 text-shamba-green",
  },
  africa: {
    tag: "bg-shamba-ochre text-shamba-ink",
    panel: "from-shamba-ochre to-shamba-rust",
    soft: "bg-shamba-ochre/15 text-shamba-ochre",
  },
  global: {
    tag: "bg-shamba-blue text-shamba-card",
    panel: "from-shamba-blue to-shamba-green-deep",
    soft: "bg-shamba-blue/10 text-shamba-blue",
  },
};

// Kenya's flag, Africa as the Earth, Global as a globe -- decorative:
// the region's name is always written next to it.
export function NewsRegionMark({ region, className = "size-5" }: { region: NewsRegion; className?: string }) {
  if (region === "kenya") return <KenyaFlag className={className} />;
  if (region === "africa") return <Earth className={className} aria-hidden="true" />;
  return <Globe className={className} aria-hidden="true" />;
}

// A simplified Kenyan flag: black, red and green bands with white edges
// and the red shield. Flag colours are the flag's own, not theme tokens.
function KenyaFlag({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 30 20" className={`${className} overflow-hidden rounded-[3px]`} aria-hidden="true">
      <rect width="30" height="20" fill="#ffffff" />
      <rect width="30" height="6" fill="#000000" />
      <rect y="7" width="30" height="6" fill="#bb0000" />
      <rect y="14" width="30" height="6" fill="#006600" />
      <ellipse cx="15" cy="10" rx="3.4" ry="7.4" fill="#ffffff" />
      <ellipse cx="15" cy="10" rx="2.7" ry="6.8" fill="#bb0000" />
      <ellipse cx="15" cy="10" rx="0.9" ry="2.6" fill="#ffffff" />
    </svg>
  );
}
