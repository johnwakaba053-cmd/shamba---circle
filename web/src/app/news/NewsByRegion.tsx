import Link from "next/link";
import { Globe } from "lucide-react";
import { NEWS_REGIONS, NEWS_REGION_LABELS, buildNewsHref } from "@/lib/news";
import { NEWS_REGION_TONE, NewsRegionMark } from "./NewsRegionMark";

// By Region, at the foot of the /news sidebar: one card per region, each
// a link to that region's latest stories (the same view as its tab).
// The tiles are the region's colours and mark -- no photos.
export function NewsByRegion() {
  return (
    <section
      aria-labelledby="news-regions-heading"
      className="rounded-shamba border border-shamba-line bg-shamba-card p-4 sm:p-5"
    >
      <h2 id="news-regions-heading" className="flex items-center gap-2 font-display text-xl font-bold text-shamba-ink">
        <Globe className="size-5 text-shamba-blue" aria-hidden="true" />
        By Region
      </h2>

      <ul className="mt-3 grid grid-cols-3 gap-2">
        {NEWS_REGIONS.map((region) => (
          <li key={region}>
            <Link
              href={buildNewsHref({}, { region })}
              className="group flex h-full flex-col overflow-hidden rounded-shamba border border-shamba-line bg-shamba-card transition-colors hover:border-shamba-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-shamba-green"
            >
              <span
                aria-hidden="true"
                className={`relative flex aspect-[4/3] items-center justify-center bg-linear-to-br text-shamba-card ${NEWS_REGION_TONE[region].panel}`}
              >
                <NewsRegionMark region={region} className="h-7 w-10" />
              </span>
              <span className="flex flex-1 flex-col items-center gap-0.5 px-1 py-2 text-center">
                <span className="font-display text-base font-bold text-shamba-ink">{NEWS_REGION_LABELS[region]}</span>
                <span className="whitespace-nowrap font-sans text-xs font-semibold text-shamba-green group-hover:text-shamba-green-deep">
                  View latest
                </span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
