import Link from "next/link";
import { EllipsisVertical } from "lucide-react";
import {
  NEWS_FORMATS,
  NEWS_FORMAT_FILTER_LABELS,
  NEWS_FORMAT_ICON,
  NEWS_REGIONS,
  NEWS_REGION_LABELS,
  buildNewsHref,
  type NewsHrefParams,
} from "@/lib/news";

type NewsCategoryOption = { id: string; name: string };

// Format, region and topic filters for /news, folded behind a ⋮ button
// beside the news-feed heading (never in the site header). Three separate
// rows because they're separate fields (N1/N4): a story can be a "Video"
// about "Farm Tech" in "Kenya", and the filters combine. Plain links (the
// URL holds the filter state, like Education and Marketplace), so they
// work without JavaScript and can be shared. Filter pills follow the
// design system: Rain Sky Blue when active, Card Cream when idle.
//
// A native <details>: keyboard-operable, no JavaScript. Keyed on the
// current filters, so choosing one shows the new view with the menu
// closed again. The button shows how many filters are on.
export function NewsFilters({
  current,
  categories,
}: {
  current: NewsHrefParams;
  categories: NewsCategoryOption[];
}) {
  const active = [current.format, current.region, current.category].filter(Boolean).length;

  const regionRow = (
    <FilterRow label="Region">
      <FilterPill href={buildNewsHref(current, { region: undefined })} active={!current.region}>
        All regions
      </FilterPill>
      {NEWS_REGIONS.map((region) => (
        <FilterPill key={region} href={buildNewsHref(current, { region })} active={current.region === region}>
          {NEWS_REGION_LABELS[region]}
        </FilterPill>
      ))}
    </FilterRow>
  );

  const topicRow = (
    <FilterRow label="Topic">
      <FilterPill href={buildNewsHref(current, { category: undefined })} active={!current.category}>
        All topics
      </FilterPill>
      {categories.map((category) => (
        <FilterPill
          key={category.id}
          href={buildNewsHref(current, { category: category.id })}
          active={current.category === category.id}
        >
          {category.name}
        </FilterPill>
      ))}
    </FilterRow>
  );

  return (
    <details key={buildNewsHref(current, {})} className="group relative shrink-0">
      <summary className="relative flex size-11 cursor-pointer list-none items-center justify-center rounded-shamba border border-shamba-line bg-shamba-card text-shamba-ink transition-colors hover:border-shamba-green group-open:border-shamba-green focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-shamba-green [&::-webkit-details-marker]:hidden">
        <EllipsisVertical className="size-5" aria-hidden="true" />
        <span className="sr-only">
          Filter stories by format, region and topic{active > 0 ? ` (${active} on)` : ""}
        </span>
        {active > 0 && (
          <span
            aria-hidden="true"
            className="absolute -right-1.5 -top-1.5 flex size-5 items-center justify-center rounded-full bg-shamba-blue font-mono text-xs font-semibold text-shamba-card"
          >
            {active}
          </span>
        )}
      </summary>
      <div className="absolute right-0 top-full z-20 mt-2 flex w-[min(24rem,calc(100vw-3rem))] flex-col gap-4 rounded-shamba border border-shamba-line bg-shamba-card p-4 shadow-lg">
        <FilterRow label="Format">
          <FormatPills current={current} />
        </FilterRow>
        {regionRow}
        {topicRow}
      </div>
    </details>
  );
}

// keepScroll: in the filter rows a pill keeps the reader where they are
// (the list is right below); from the browse row it opens a new view, so
// it starts at the top.
function FormatPills({
  current,
  includeAll = true,
  keepScroll = true,
}: {
  current: NewsHrefParams;
  includeAll?: boolean;
  keepScroll?: boolean;
}) {
  return (
    <>
      {includeAll && (
        <FilterPill href={buildNewsHref(current, { format: undefined })} active={!current.format} keepScroll={keepScroll}>
          All formats
        </FilterPill>
      )}
      {NEWS_FORMATS.map((format) => {
        const Icon = NEWS_FORMAT_ICON[format];
        return (
          <FilterPill
            key={format}
            href={buildNewsHref(current, { format })}
            active={current.format === format}
            keepScroll={keepScroll}
          >
            <Icon className="size-4" aria-hidden="true" />
            {NEWS_FORMAT_FILTER_LABELS[format]}
          </FilterPill>
        );
      })}
    </>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <nav aria-label={`Filter news by ${label.toLowerCase()}`} className="flex flex-col gap-1.5">
      <span className="w-16 shrink-0 font-mono text-xs font-medium uppercase tracking-wide text-shamba-ink-soft">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </nav>
  );
}

function FilterPill({
  href,
  active,
  keepScroll = true,
  children,
}: {
  href: string;
  active: boolean;
  keepScroll?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      scroll={!keepScroll}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "relative touch-target inline-flex items-center gap-1.5 rounded-shamba bg-shamba-blue px-3 py-1.5 font-sans text-sm font-semibold text-shamba-card"
          : "relative touch-target inline-flex items-center gap-1.5 rounded-shamba border border-shamba-line bg-shamba-card px-3 py-1.5 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:border-shamba-blue hover:text-shamba-ink"
      }
    >
      {children}
    </Link>
  );
}
