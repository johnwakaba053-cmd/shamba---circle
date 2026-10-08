import Link from "next/link";
import { ExternalLink, ImageOff } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import {
  NEWS_REGIONS,
  NEWS_REGION_LABELS,
  isNewsRegion,
  newsArticlePath,
  safeExternalUrl,
  type NewsRegion,
} from "@/lib/news";
import { formatSourceTime } from "@/lib/newsAdmin";
import { requireAdmin } from "@/lib/staff";
import { isYouTubeVideoId } from "@/lib/youtube";
import { NewsCoverImage } from "@/app/news/NewsCoverImage";
import { NewsFormatBadge } from "@/app/news/NewsFormatBadge";
import { YouTubeFacade } from "@/app/news/YouTubeFacade";
import { DraftActions, type DraftForEdit } from "./DraftActions";

type DraftRow = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  region: NewsRegion;
  category_id: string;
  format: "article" | "photo_story" | "video" | "market_update";
  origin: string;
  source_id: string | null;
  external_url: string | null;
  county_id: string | null;
  cover_image_path: string | null;
  cover_image_alt: string | null;
  cover_image_credit: string | null;
  byline: string | null;
  source_published_at: string;
  news_sources: { name: string; image_policy: "none" | "link" } | null;
  news_categories: { name: string } | null;
};

// Imported drafts are the only drafts with a publisher time (N6c), so
// this lists exactly the stories the importer brought in. Readable by an
// admin through N1's admin policy; every column named here is granted.
const DRAFT_COLUMNS =
  "id, slug, title, summary, region, category_id, format, origin, source_id, external_url, county_id, cover_image_path, cover_image_alt, cover_image_credit, byline, source_published_at, news_sources(name, image_policy), news_categories(name)";

const DRAFT_LIMIT = 200;

type FormatFilter = "article" | "video";

// /admin/news: Agriculture Today draft review (N6c). Admins only --
// everyone else gets a 404 (requireAdmin). Not in the main navigation.
// Nothing here publishes on its own: an admin edits, publishes or rejects
// each draft through the existing admin functions (DraftActions).
export default async function NewsDraftReview({
  searchParams,
}: {
  searchParams: Promise<{ region?: string; format?: string }>;
}) {
  const { supabase } = await requireAdmin();
  const params = await searchParams;
  const region = isNewsRegion(params.region) ? params.region : undefined;
  const format: FormatFilter | undefined =
    params.format === "article" || params.format === "video" ? params.format : undefined;

  let query = supabase
    .from("news_articles")
    .select(DRAFT_COLUMNS)
    .eq("status", "draft")
    .not("source_published_at", "is", null)
    .order("source_published_at", { ascending: false })
    .limit(DRAFT_LIMIT);
  if (region) query = query.eq("region", region);
  if (format) query = query.eq("format", format);

  const [{ data, error }, { data: categoryRows }, { data: countRows }] = await Promise.all([
    query,
    supabase.from("news_categories").select("id, name").eq("is_active", true).order("sort_order"),
    supabase
      .from("news_articles")
      .select("region, format")
      .eq("status", "draft")
      .not("source_published_at", "is", null)
      .limit(1000),
  ]);

  const drafts = (data ?? []) as unknown as DraftRow[];
  const categories = categoryRows ?? [];
  const counts = new Map<string, number>();
  for (const row of countRows ?? []) {
    const key = `${row.region}:${row.format === "video" ? "video" : "article"}`;
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const total = countRows?.length ?? 0;

  // One query for every video draft's YouTube ID.
  const videoIds = new Map<string, string>();
  const videoDraftIds = drafts.filter((draft) => draft.format === "video").map((draft) => draft.id);
  if (videoDraftIds.length > 0) {
    const { data: media } = await supabase
      .from("news_media")
      .select("article_id, embed_id")
      .eq("kind", "video_embed")
      .in("article_id", videoDraftIds);
    for (const row of media ?? []) {
      if (isYouTubeVideoId(row.embed_id as string)) videoIds.set(row.article_id as string, row.embed_id as string);
    }
  }

  const href = (next: { region?: NewsRegion; format?: FormatFilter }) => {
    const search = new URLSearchParams();
    if (next.region) search.set("region", next.region);
    if (next.format) search.set("format", next.format);
    const qs = search.toString();
    return qs ? `/admin/news?${qs}` : "/admin/news";
  };

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 pb-20 pt-6 sm:px-10 sm:pt-12">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-wide text-shamba-ochre">Admin</p>
          <h1 className="mt-1 font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink sm:text-3xl">
            Agriculture Today drafts
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-6 text-shamba-ink-soft">
            Stories and videos brought in from approved sources. Nothing appears on Agriculture Today until you
            publish it. Rewrite each summary in your own words, check the original, then publish or reject.
          </p>
        </div>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="All drafts" value={total} />
          {NEWS_REGIONS.map((value) => (
            <Stat
              key={value}
              label={NEWS_REGION_LABELS[value]}
              value={(counts.get(`${value}:article`) ?? 0) + (counts.get(`${value}:video`) ?? 0)}
              detail={`${counts.get(`${value}:article`) ?? 0} articles · ${counts.get(`${value}:video`) ?? 0} videos`}
            />
          ))}
        </dl>

        <div className="flex flex-col gap-3">
          <FilterRow label="Region">
            <Pill href={href({ format })} active={!region}>All regions</Pill>
            {NEWS_REGIONS.map((value) => (
              <Pill key={value} href={href({ region: value, format })} active={region === value}>
                {NEWS_REGION_LABELS[value]}
              </Pill>
            ))}
          </FilterRow>
          <FilterRow label="Format">
            <Pill href={href({ region })} active={!format}>All formats</Pill>
            <Pill href={href({ region, format: "article" })} active={format === "article"}>Articles</Pill>
            <Pill href={href({ region, format: "video" })} active={format === "video"}>Videos</Pill>
          </FilterRow>
        </div>

        {error && (
          <p role="alert" className="rounded-shamba border border-shamba-line bg-shamba-card p-4 text-sm font-semibold text-shamba-rust">
            We couldn&apos;t load the drafts. Check your connection and reload the page.
          </p>
        )}

        {!error && drafts.length === 0 && (
          <div className="rounded-shamba border border-dashed border-shamba-line bg-shamba-card p-6 text-center">
            <p className="font-display text-base font-bold text-shamba-ink">No drafts here</p>
            <p className="mt-1 text-sm leading-6 text-shamba-ink-soft">
              New stories from the approved sources appear here after each import.
            </p>
          </div>
        )}

        <ol className="flex flex-col gap-4">
          {drafts.map((draft) => {
            const originalUrl = safeExternalUrl(draft.external_url);
            const videoId = videoIds.get(draft.id) ?? null;
            const sourceName = draft.news_sources?.name ?? "Unknown source";
            const forEdit: DraftForEdit = {
              id: draft.id,
              slug: draft.slug,
              title: draft.title,
              summary: draft.summary,
              region: draft.region,
              categoryId: draft.category_id,
              origin: draft.origin,
              sourceId: draft.source_id,
              externalUrl: draft.external_url,
              countyId: draft.county_id,
              coverImagePath: draft.cover_image_path,
              coverImageAlt: draft.cover_image_alt,
              coverImageCredit: draft.cover_image_credit,
              format: draft.format,
              byline: draft.byline,
            };

            return (
              <li key={draft.id}>
                <article className="flex flex-col gap-4 rounded-shamba border border-shamba-line bg-shamba-card p-4 sm:p-5">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 font-mono text-xs">
                    <span className="font-semibold text-shamba-ink">{sourceName}</span>
                    <span className="text-shamba-ink-soft">{NEWS_REGION_LABELS[draft.region]}</span>
                    <span className="text-shamba-ink-soft">{draft.news_categories?.name ?? draft.category_id}</span>
                    <NewsFormatBadge format={draft.format} />
                    <time dateTime={draft.source_published_at} className="text-shamba-ink-soft">
                      Source: {formatSourceTime(draft.source_published_at)}
                    </time>
                  </div>

                  <div className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,18rem)]">
                    <div className="flex min-w-0 flex-col gap-2">
                      <h2 className="font-display text-lg font-bold leading-snug text-shamba-ink">{draft.title}</h2>
                      <p className="text-sm leading-6 text-shamba-ink">
                        <span className="font-mono text-xs uppercase tracking-wide text-shamba-ink-soft">Summary </span>
                        {draft.summary}
                      </p>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                        {originalUrl && (
                          <a
                            href={originalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="relative touch-target inline-flex items-center gap-1.5 rounded-shamba font-sans text-sm font-semibold text-shamba-green transition-colors hover:text-shamba-green-deep"
                          >
                            Open original on {sourceName}
                            <ExternalLink className="size-4" aria-hidden="true" />
                            <span className="sr-only">(opens in a new tab)</span>
                          </a>
                        )}
                        <Link
                          href={newsArticlePath(draft.slug)}
                          className="relative touch-target rounded-shamba font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink"
                        >
                          Preview story page
                        </Link>
                      </div>
                    </div>

                    <div className="min-w-0">
                      {draft.format === "video" && videoId ? (
                        <YouTubeFacade videoId={videoId} title={draft.title} durationLabel={null} />
                      ) : draft.cover_image_path ? (
                        <NewsCoverImage path={draft.cover_image_path} alt={draft.cover_image_alt} />
                      ) : (
                        <p className="flex items-start gap-2 rounded-shamba border border-dashed border-shamba-line p-3 text-xs leading-5 text-shamba-ink-soft">
                          <ImageOff className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
                          {draft.news_sources?.image_policy === "link"
                            ? "This source allows its images, but none came with this story."
                            : `No image: ${sourceName} hasn't given permission to show its photos.`}
                        </p>
                      )}
                    </div>
                  </div>

                  <DraftActions draft={forEdit} categories={categories} />
                </article>
              </li>
            );
          })}
        </ol>
      </main>
    </div>
  );
}

function Stat({ label, value, detail }: { label: string; value: number; detail?: string }) {
  return (
    <div className="rounded-shamba border border-shamba-line bg-shamba-card p-3">
      <dt className="font-mono text-xs uppercase tracking-wide text-shamba-ink-soft">{label}</dt>
      <dd className="mt-1 font-display text-2xl font-bold text-shamba-ink">{value}</dd>
      {detail && <dd className="font-mono text-xs text-shamba-ink-soft">{detail}</dd>}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <nav aria-label={`Filter drafts by ${label.toLowerCase()}`} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
      <span className="w-16 shrink-0 font-mono text-xs font-medium uppercase tracking-wide text-shamba-ink-soft">{label}</span>
      <div className="flex flex-wrap gap-2">{children}</div>
    </nav>
  );
}

function Pill({ href, active, children }: { href: string; active: boolean; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={
        active
          ? "relative touch-target inline-flex items-center rounded-shamba bg-shamba-blue px-3 py-1.5 font-sans text-sm font-semibold text-shamba-card"
          : "relative touch-target inline-flex items-center rounded-shamba border border-shamba-line bg-shamba-card px-3 py-1.5 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:border-shamba-blue hover:text-shamba-ink"
      }
    >
      {children}
    </Link>
  );
}
