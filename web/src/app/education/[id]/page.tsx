import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import {
  EDUCATION_CATEGORY_ICON,
  EDUCATION_CATEGORY_FALLBACK_ICON,
  LEARNING_CATEGORY_LABELS,
  RESOURCE_TYPE_LABELS,
  formatVideoDuration,
  getYouTubeVideoId,
  getYouTubeEmbedUrl,
  getYouTubeWatchUrl,
  type LearningCategory,
  type ResourceType,
  type ResourceOrigin,
} from "@/lib/education";

type EducationResourceDetail = {
  id: string;
  category_id: string;
  topic_id: string | null;
  learning_category: LearningCategory | null;
  resource_type: ResourceType;
  origin: ResourceOrigin | null;
  external_url: string | null;
  storage_path: string | null;
  title: string;
  summary: string;
  content: string;
  source_name: string | null;
  source_url: string | null;
  published_at: string;
  // Watch & Learn -- populated only for resource_type = "video".
  youtube_url: string | null;
  duration_seconds: number | null;
  video_published_at: string | null;
  language: string | null;
  education_categories: { name: string } | null;
  education_topics: { name: string; emoji: string | null } | null;
  education_sources: { name: string; url: string | null } | null;
};

type RelatedResource = {
  id: string;
  title: string;
  summary: string;
};

export default async function EducationResource({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // is_published = true is enforced twice on purpose: RLS already blocks
  // unpublished rows from ever being returned, and this filter keeps that
  // same rule explicit here so the page can't accidentally start showing
  // draft content if the policy ever changes.
  const { data, error } = await supabase
    .from("education_resources")
    .select(
      "id, category_id, topic_id, learning_category, resource_type, origin, external_url, storage_path, title, summary, content, source_name, source_url, published_at, youtube_url, duration_seconds, video_published_at, language, education_categories(name), education_topics(name, emoji), education_sources(name, url)",
    )
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();

  const resource = data as EducationResourceDetail | null;

  if (!error && !resource) {
    notFound();
  }

  const paragraphs = resource?.content.split("\n\n") ?? [];

  // Only ever passed to an <iframe src> or <a href> after this validation
  // -- getYouTubeVideoId rejects any non-YouTube domain, non-https scheme
  // (javascript:, data:, ...), or malformed URL, regardless of what's
  // stored in youtube_url. A null result here means "Video unavailable",
  // never a broken/omitted iframe rendered with the raw string.
  const videoId =
    resource?.resource_type === "video"
      ? getYouTubeVideoId(resource.youtube_url)
      : null;
  const videoDuration =
    resource?.resource_type === "video"
      ? formatVideoDuration(resource.duration_seconds)
      : null;

  // Related resources prefer the same topic (when this resource has one)
  // over the existing category relationship, but only ever fall back to
  // the original category-based query -- unchanged -- when there's no
  // topic, or the topic has no other published resources yet.
  let related: RelatedResource[] | null = null;

  if (resource) {
    if (resource.topic_id) {
      const { data: topicRelated } = await supabase
        .from("education_resources")
        .select("id, title, summary")
        .eq("topic_id", resource.topic_id)
        .eq("is_published", true)
        .neq("id", resource.id)
        .order("published_at", { ascending: false })
        .limit(3);
      related = topicRelated ?? null;
    }

    if (!related || related.length === 0) {
      const { data: categoryRelated } = await supabase
        .from("education_resources")
        .select("id, title, summary")
        .eq("category_id", resource.category_id)
        .eq("is_published", true)
        .neq("id", resource.id)
        .order("published_at", { ascending: false })
        .limit(3);
      related = categoryRelated ?? null;
    }
  }

  const Icon = resource
    ? (EDUCATION_CATEGORY_ICON[resource.category_id] ??
      EDUCATION_CATEGORY_FALLBACK_ICON)
    : EDUCATION_CATEGORY_FALLBACK_ICON;

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        {error && (
          <p
            role="alert"
            className="w-full max-w-2xl text-sm font-semibold text-shamba-rust"
          >
            We couldn&apos;t load this resource right now. Please try again
            later.
          </p>
        )}

        {!error && resource && (
          <article className="w-full max-w-2xl rounded-shamba border border-shamba-line bg-shamba-card p-6 sm:p-8">
            {/* Shown only for origin = shamba_original -- same distinct
                green-filled badge as the Learning Library cards, so it's
                obvious this is Shamba Space's own written guide rather
                than a linked external resource. */}
            {resource.origin === "shamba_original" && (
              <span className="mb-1.5 inline-block w-fit rounded-shamba bg-shamba-green px-2 py-0.5 font-mono text-xs font-semibold text-shamba-card">
                Shamba Space Original
              </span>
            )}

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="rounded-shamba bg-shamba-bg px-2 py-0.5 font-mono text-xs font-semibold text-shamba-ink-soft">
                {RESOURCE_TYPE_LABELS[resource.resource_type]}
              </span>
              {resource.education_topics && (
                <span className="rounded-shamba bg-shamba-bg px-2 py-0.5 font-mono text-xs font-semibold text-shamba-ink-soft">
                  {resource.education_topics.emoji ? `${resource.education_topics.emoji} ` : ""}
                  {resource.education_topics.name}
                </span>
              )}
              {resource.learning_category && (
                <span className="rounded-shamba bg-shamba-bg px-2 py-0.5 font-mono text-xs font-semibold text-shamba-ink-soft">
                  {LEARNING_CATEGORY_LABELS[resource.learning_category]}
                </span>
              )}
              {resource.resource_type === "video" && resource.language && (
                <span className="rounded-shamba bg-shamba-bg px-2 py-0.5 font-mono text-xs font-semibold text-shamba-ink-soft">
                  {resource.language}
                </span>
              )}
            </div>

            {resource.education_categories && (
              <Link
                href={`/education?category=${resource.category_id}`}
                className="mt-2 inline-flex items-center gap-2 font-mono text-xs font-semibold text-shamba-green transition-colors hover:text-shamba-green-deep"
              >
                <Icon className="size-4" aria-hidden="true" />
                {resource.education_categories.name}
              </Link>
            )}

            <h1 className="mt-3 font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink sm:text-3xl">
              {resource.title}
            </h1>

            <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
              {resource.summary}
            </p>

            <p className="mt-2 font-mono text-xs text-shamba-ink-soft">
              Published {new Date(resource.published_at).toLocaleDateString()}
            </p>

            {resource.resource_type === "video" &&
              (videoDuration || resource.video_published_at) && (
                <p className="mt-1 font-mono text-xs text-shamba-ink-soft">
                  {videoDuration && <>Duration: {videoDuration}</>}
                  {videoDuration && resource.video_published_at && " · "}
                  {resource.video_published_at && (
                    <>
                      Published on YouTube{" "}
                      {new Date(resource.video_published_at).toLocaleDateString()}
                    </>
                  )}
                </p>
              )}

            {resource.resource_type === "video" && (
              <div className="mt-4">
                {videoId ? (
                  <div className="relative aspect-video w-full overflow-hidden rounded-shamba border border-shamba-line bg-black">
                    <iframe
                      src={getYouTubeEmbedUrl(videoId)}
                      title={`YouTube video player — ${resource.title}`}
                      className="absolute inset-0 h-full w-full"
                      loading="lazy"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                    />
                  </div>
                ) : (
                  // No usable video ID -- youtube_url is missing or failed
                  // validation. Never render an iframe pointed at an
                  // unvalidated string; show a plain, honest fallback
                  // instead. There is deliberately no external link here,
                  // since we were never able to confirm this is a genuine
                  // YouTube URL in the first place.
                  <div className="flex aspect-video w-full items-center justify-center rounded-shamba border border-dashed border-shamba-line bg-shamba-bg">
                    <p className="px-4 text-center text-sm font-semibold text-shamba-ink-soft">
                      Video unavailable
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="mt-6 flex flex-col gap-4 border-t border-shamba-line pt-6">
              {/* A "## " prefix marks a section heading -- a plain
                  rendering convention, not a schema change, that lets a
                  long-form original guide (like the Avocado guide) read as
                  short, scannable sections on a phone instead of one wall
                  of text. Existing content with no "## " lines (all
                  external resources today) renders exactly as before. */}
              {paragraphs.map((paragraph, index) =>
                paragraph.startsWith("## ") ? (
                  <h2
                    key={index}
                    className="font-display text-lg font-semibold text-shamba-ink"
                  >
                    {paragraph.slice(3)}
                  </h2>
                ) : (
                  <p
                    key={index}
                    className="whitespace-pre-wrap text-base leading-7 text-shamba-ink"
                  >
                    {paragraph}
                  </p>
                ),
              )}
            </div>

            {resource.resource_type === "video" && videoId && (
              // Reconstructed from the already-validated video ID, never
              // from the raw stored youtube_url -- see getYouTubeVideoId.
              <a
                href={getYouTubeWatchUrl(videoId)}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-shamba border border-shamba-line px-4 py-2 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg"
              >
                Watch on YouTube
                <ExternalLink className="size-4" aria-hidden="true" />
              </a>
            )}

            {/* Shown whenever there's an external URL and nothing has
                actually been re-hosted in our own Storage yet (storage_path
                is null) -- true for every resource today, regardless of
                origin, since this batch classifies rights but rehosts
                nothing. This is deliberately NOT a download action: it
                only ever opens the source's own page/PDF in a new tab.
                Once a resource is genuinely rehosted (storage_path set),
                this condition naturally stops applying to it and a future
                "Read Online"/"Download" action (gated by
                canShowDownloadAction) can take over instead. */}
            {resource.resource_type !== "video" &&
              resource.external_url &&
              !resource.storage_path && (
                <a
                  href={resource.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-6 inline-flex items-center gap-2 rounded-shamba border border-shamba-line px-4 py-2 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg"
                >
                  {resource.education_sources?.name
                    ? `Read on ${resource.education_sources.name}`
                    : "View Resource"}
                  <ExternalLink className="size-4" aria-hidden="true" />
                </a>
              )}

            {(resource.source_name || resource.source_url) && (
              <p className="mt-6 border-t border-shamba-line pt-4 text-sm text-shamba-ink-soft">
                Source:{" "}
                {resource.source_url ? (
                  <a
                    href={resource.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-semibold text-shamba-blue transition-colors hover:text-shamba-green-deep"
                  >
                    {resource.source_name ?? resource.source_url}
                  </a>
                ) : (
                  <span className="font-semibold">{resource.source_name}</span>
                )}
              </p>
            )}
          </article>
        )}

        {!error && resource && related && related.length > 0 && (
          <section className="mt-8 w-full max-w-2xl">
            {/* Reuses the exact same topic-first related-resources query
                above -- no separate "Go Deeper" fetch exists. For an
                original Shamba Space guide, its topic-matched related
                resources are, by construction, the verified external
                research on the same topic (e.g. the KALRO avocado
                course) -- exactly what "Go Deeper" means. An external
                resource's own page keeps the unchanged "Related
                resources" heading, since that framing doesn't apply
                there. */}
            <h2 className="font-display text-lg font-semibold text-shamba-ink">
              {resource.origin === "shamba_original" ? "Go Deeper" : "Related resources"}
            </h2>
            {resource.origin === "shamba_original" && (
              <p className="mt-1 text-sm text-shamba-ink-soft">
                Verified research from KALRO, FAO and other authoritative sources on this topic.
              </p>
            )}
            <div className="mt-4 flex flex-col gap-3">
              {(related as RelatedResource[]).map((item) => (
                <Link
                  key={item.id}
                  href={`/education/${item.id}`}
                  className="rounded-shamba border border-shamba-line bg-shamba-card p-4 transition-colors hover:border-shamba-green"
                >
                  <h3 className="font-display text-sm font-semibold text-shamba-ink">
                    {item.title}
                  </h3>
                  <p className="mt-1 text-sm leading-6 text-shamba-ink-soft">
                    {item.summary}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        )}

        <Link
          href="/education"
          className="mt-8 inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Education
        </Link>
      </main>
    </div>
  );
}
