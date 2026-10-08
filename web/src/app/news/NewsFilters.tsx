import Link from "next/link";
import { ArrowRight, ChevronDown, SlidersHorizontal } from "lucide-react";
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

// /news?view=all: every story as one list with the full filters, even on
// the first page -- where "More filters" in NewsBrowseAll leads.
export const NEWS_ALL_STORIES_HREF = "/news?view=all";

// Format, region and topic filters for /news. Three separate rows
// because they're separate fields (N1/N4): a story can be a "Video" about
// "Farm Tech" in "Kenya", and the filters combine. Plain links (the URL
// holds the filter state, like Education and Marketplace), so they work
// without JavaScript and can be shared. Filter pills follow the design
// system: Rain Sky Blue when active, Card Cream when idle, every row
// wrapping at 360px.
//
// Below sm, only Format shows straight away; Region and Topic fold into
// a native <details> ("More filters"), open when either is already
// active, so the filters don't push the stories a full screen down on a
// phone. From sm up all three rows show. The two copies of the Region
// and Topic rows are never visible together (hidden ones are
// display:none, so they're out of the tab order and the accessibility
// tree too).
export function NewsFilters({
  current,
  categories,
}: {
  current: NewsHrefParams;
  categories: NewsCategoryOption[];
}) {
  const activeMore = [current.region, current.category].filter(Boolean).length;

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
    <div className="flex flex-col gap-3">
      <FilterRow label="Format">
        <FormatPills current={current} />
      </FilterRow>

      <div className="hidden flex-col gap-3 sm:flex">
        {regionRow}
        {topicRow}
      </div>

      <details open={activeMore > 0} className="group sm:hidden">
        <summary className="relative inline-flex min-h-11 cursor-pointer list-none items-center gap-2 rounded-shamba font-sans text-sm font-semibold text-shamba-ink transition-colors hover:text-shamba-green-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-shamba-green [&::-webkit-details-marker]:hidden">
          <SlidersHorizontal className="size-4 text-shamba-ink-soft" aria-hidden="true" />
          More filters (region, topic)
          {activeMore > 0 && (
            <span className="rounded-full bg-shamba-blue px-2 py-0.5 font-mono text-xs font-semibold text-shamba-card">
              {activeMore} on
            </span>
          )}
          <ChevronDown className="size-4 transition-transform group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="mt-2 flex flex-col gap-3">
          {regionRow}
          {topicRow}
        </div>
      </details>
    </div>
  );
}

// The front page's stand-in for Latest when every story is already shown
// in the sections above: one compact row instead of the full filters and
// an empty list. Format pills lead straight to those stories; "More
// filters" opens the full list with every filter.
export function NewsBrowseAll({ olderHref }: { olderHref: string | null }) {
  return (
    <nav
      aria-label="Browse all stories"
      className="flex flex-col gap-3 rounded-shamba border border-shamba-line bg-shamba-card p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
        <h2 className="font-display text-lg font-bold text-shamba-ink">Browse all stories</h2>
        <p className="text-sm text-shamba-ink-soft">You&apos;re up to date with the stories above.</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <FormatPills current={{}} includeAll={false} keepScroll={false} />
        <Link
          href={NEWS_ALL_STORIES_HREF}
          className="relative touch-target inline-flex items-center gap-1.5 rounded-shamba px-2 py-1.5 font-sans text-sm font-semibold text-shamba-green transition-colors hover:text-shamba-green-deep"
        >
          <SlidersHorizontal className="size-4" aria-hidden="true" />
          More filters
        </Link>
        {olderHref && (
          <Link
            href={olderHref}
            className="relative touch-target inline-flex items-center gap-1.5 rounded-shamba px-2 py-1.5 font-sans text-sm font-semibold text-shamba-green transition-colors hover:text-shamba-green-deep"
          >
            Older stories
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
    </nav>
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
    <nav aria-label={`Filter news by ${label.toLowerCase()}`} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
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
