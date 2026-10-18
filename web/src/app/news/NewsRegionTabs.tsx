import Link from "next/link";
import { NEWS_REGIONS, NEWS_REGION_LABELS, buildNewsHref, type NewsRegion } from "@/lib/news";
import { NewsRegionMark } from "./NewsRegionMark";

// Latest / Kenya / Africa / Global under the banner. Plain links to
// /news and /news?region=… (a fresh view: any other filter is dropped),
// so they work without JavaScript and can be shared. "Latest" is current
// whenever no region is chosen. Four equal tabs on a phone (the marks
// show from sm up, where there's room).
export function NewsRegionTabs({ region }: { region: NewsRegion | undefined }) {
  const tabs: { key: string; label: string; href: string; active: boolean; region?: NewsRegion }[] = [
    { key: "latest", label: "Latest", href: "/news", active: !region },
    ...NEWS_REGIONS.map((value) => ({
      key: value,
      label: NEWS_REGION_LABELS[value],
      href: buildNewsHref({}, { region: value }),
      active: region === value,
      region: value,
    })),
  ];

  return (
    <nav aria-label="News by region" className="grid grid-cols-4 gap-1.5 sm:flex sm:gap-2">
      {tabs.map((tab) => (
        <Link
          key={tab.key}
          href={tab.href}
          aria-current={tab.active ? "page" : undefined}
          className={`inline-flex min-h-11 items-center justify-center gap-2 rounded-shamba border px-2 font-sans text-sm font-semibold transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-shamba-green sm:min-h-12 sm:min-w-32 sm:px-5 sm:text-base ${
            tab.active
              ? "border-shamba-green bg-shamba-green text-shamba-card"
              : "border-shamba-line bg-shamba-card text-shamba-ink hover:border-shamba-green hover:text-shamba-green-deep"
          }`}
        >
          {tab.region && <NewsRegionMark region={tab.region} className="hidden h-4 w-6 sm:block" />}
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}
