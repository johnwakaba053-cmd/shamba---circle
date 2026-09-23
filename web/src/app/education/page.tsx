import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import {
  LEARNING_CATEGORIES,
  LEARNING_CATEGORY_LABELS,
  RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
  isLearningCategory,
  isResourceType,
  buildEducationHref,
} from "@/lib/education";
import { ResourceCard, type EducationResourceCardData } from "./ResourceCard";

type EducationCategory = {
  id: string;
  name: string;
};

type EducationTopic = {
  id: string;
  name: string;
  topic_type: "crop" | "livestock";
  crop_type_id: string | null;
  livestock_type_id: string | null;
  emoji: string | null;
};

// The Learning Library grid and the Watch & Learn section both fetch this
// same shape -- see ResourceCard.tsx, which is the single source of truth
// for what a card needs. published_at is only used for sort order here,
// not by the card itself.
type EducationResourceListItem = EducationResourceCardData & {
  published_at: string;
};

export default async function Education({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; topic?: string; learning?: string; type?: string }>;
}) {
  const { category, topic, learning, type } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const [
    { data: categories, error: categoriesError },
    { data: topics, error: topicsError },
    { data: cropPreferences },
    { data: livestockPreferences },
    { data: watchAndLearnVideos },
  ] = await Promise.all([
    supabase.from("education_categories").select("id, name").order("name"),
    // Topics are keyed off the existing canonical crop_types/livestock_types
    // (never communities -- their ids don't consistently align, per the
    // Education audit). Only active topics are shown or filterable, the
    // same is_active convention marketplace_categories already uses.
    supabase
      .from("education_topics")
      .select("id, name, topic_type, crop_type_id, livestock_type_id, emoji")
      .eq("is_active", true)
      .order("sort_order", { ascending: true }),
    supabase.from("farmer_crop_preferences").select("crop_type_id"),
    supabase.from("farmer_livestock_preferences").select("livestock_type_id"),
    // Watch & Learn is a fixed "featured" selection, independent of
    // whatever category/topic/learning/type filter the Learning Library
    // grid below is currently applying -- so it's its own query, not a
    // slice of resourcesQuery's results.
    supabase
      .from("education_resources")
      .select(
        "id, category_id, topic_id, learning_category, resource_type, origin, title, summary, source_name, education_sources(name), thumbnail_url, duration_seconds",
      )
      .eq("is_published", true)
      .eq("resource_type", "video")
      .order("published_at", { ascending: false })
      .limit(6),
  ]);

  // Only trust filter values that match something real -- an unrecognised
  // category/topic/learning value in the query string is treated the same
  // as no filter, rather than passed straight into the resources query.
  const activeCategory = (categories ?? []).find((c) => c.id === category)
    ? category
    : undefined;
  const activeTopic = (topics ?? []).find((t) => t.id === topic) ? topic : undefined;
  const activeLearning = isLearningCategory(learning) ? learning : undefined;
  const activeType = isResourceType(type) ? type : undefined;

  const currentParams = {
    category: activeCategory,
    topic: activeTopic,
    learning: activeLearning,
    type: activeType,
  };

  let resourcesQuery = supabase
    .from("education_resources")
    .select(
      "id, category_id, topic_id, learning_category, resource_type, origin, title, summary, source_name, education_sources(name), thumbnail_url, duration_seconds, published_at",
    )
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  if (activeCategory) {
    resourcesQuery = resourcesQuery.eq("category_id", activeCategory);
  }
  if (activeTopic) {
    resourcesQuery = resourcesQuery.eq("topic_id", activeTopic);
  }
  if (activeLearning) {
    resourcesQuery = resourcesQuery.eq("learning_category", activeLearning);
  }
  if (activeType) {
    resourcesQuery = resourcesQuery.eq("resource_type", activeType);
  }

  const { data: resources, error: resourcesError } = await resourcesQuery;

  const hasError = Boolean(categoriesError || resourcesError || topicsError);
  const activeCategoryName = (categories as EducationCategory[] | null)?.find(
    (c) => c.id === activeCategory,
  )?.name;

  const allTopics = (topics as EducationTopic[] | null) ?? [];
  const topicsById = new Map(allTopics.map((t) => [t.id, t]));
  const cropTopics = allTopics.filter((t) => t.topic_type === "crop");
  const livestockTopics = allTopics.filter((t) => t.topic_type === "livestock");

  // "Your Farm" -- the farmer's own selected crops/livestock (set on
  // /profile), matched against the seeded topics by the same canonical
  // crop_type_id/livestock_type_id both sides already share. A farmer
  // with no preferences, or preferences that don't match any seeded
  // topic yet, simply sees no section here -- never an empty one.
  const cropPreferenceIds = new Set(
    (cropPreferences ?? []).map((row) => row.crop_type_id),
  );
  const livestockPreferenceIds = new Set(
    (livestockPreferences ?? []).map((row) => row.livestock_type_id),
  );
  const yourFarmTopics = allTopics.filter(
    (t) =>
      (t.topic_type === "crop" && t.crop_type_id && cropPreferenceIds.has(t.crop_type_id)) ||
      (t.topic_type === "livestock" &&
        t.livestock_type_id &&
        livestockPreferenceIds.has(t.livestock_type_id)),
  );

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        <div>
          <p className="font-mono text-xs font-semibold uppercase tracking-wide text-shamba-green">
            Shamba Space Academy
          </p>
          <h1 className="mt-1 font-display text-3xl font-bold leading-tight tracking-tight text-shamba-ink">
            Education &amp; Resources
          </h1>
          <p className="mt-2 max-w-2xl text-base leading-6 text-shamba-ink-soft">
            Practical guidance on crops, livestock, soil, pests, business and
            more -- written to help you make better decisions on your farm.
          </p>
        </div>

        {hasError && (
          <p role="alert" className="text-sm font-semibold text-shamba-rust">
            We couldn&apos;t load Education &amp; Resources right now. Please
            try again later.
          </p>
        )}

        {!hasError && yourFarmTopics.length > 0 && (
          <section>
            <h2 className="font-display text-lg font-semibold text-shamba-ink">
              Your Farm
            </h2>
            <div className="mt-3 flex flex-wrap gap-2">
              {yourFarmTopics.map((t) => (
                <Link
                  key={t.id}
                  href={buildEducationHref(currentParams, { topic: t.id })}
                  aria-current={t.id === activeTopic ? "page" : undefined}
                  className={
                    t.id === activeTopic
                      ? "rounded-shamba bg-shamba-green px-4 py-2 font-sans text-sm font-semibold text-shamba-card"
                      : "rounded-shamba border border-shamba-line bg-shamba-card px-4 py-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:border-shamba-green hover:text-shamba-ink"
                  }
                >
                  {t.emoji ? `${t.emoji} ` : ""}
                  {t.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {!hasError && (cropTopics.length > 0 || livestockTopics.length > 0) && (
          <section className="flex flex-col gap-4">
            {cropTopics.length > 0 && (
              <div>
                <h2 className="font-display text-lg font-semibold text-shamba-ink">
                  🌱 Crop School
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {cropTopics.map((t) => (
                    <Link
                      key={t.id}
                      href={buildEducationHref(currentParams, { topic: t.id })}
                      aria-current={t.id === activeTopic ? "page" : undefined}
                      className={
                        t.id === activeTopic
                          ? "rounded-shamba bg-shamba-green px-4 py-2 font-sans text-sm font-semibold text-shamba-card"
                          : "rounded-shamba border border-shamba-line bg-shamba-card px-4 py-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:border-shamba-green hover:text-shamba-ink"
                      }
                    >
                      {t.emoji ? `${t.emoji} ` : ""}
                      {t.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {livestockTopics.length > 0 && (
              <div>
                <h2 className="font-display text-lg font-semibold text-shamba-ink">
                  🐄 Livestock School
                </h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  {livestockTopics.map((t) => (
                    <Link
                      key={t.id}
                      href={buildEducationHref(currentParams, { topic: t.id })}
                      aria-current={t.id === activeTopic ? "page" : undefined}
                      className={
                        t.id === activeTopic
                          ? "rounded-shamba bg-shamba-green px-4 py-2 font-sans text-sm font-semibold text-shamba-card"
                          : "rounded-shamba border border-shamba-line bg-shamba-card px-4 py-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:border-shamba-green hover:text-shamba-ink"
                      }
                    >
                      {t.emoji ? `${t.emoji} ` : ""}
                      {t.name}
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {activeTopic && (
              <Link
                href={buildEducationHref(currentParams, { topic: undefined })}
                className="inline-flex w-fit items-center font-sans text-xs font-semibold text-shamba-ink-soft underline transition-colors hover:text-shamba-ink"
              >
                Clear topic filter
              </Link>
            )}
          </section>
        )}

        {!hasError && (
          <section>
            <h2 className="font-display text-lg font-semibold text-shamba-ink">
              📺 Watch & Learn
            </h2>
            <p className="mt-1 text-sm text-shamba-ink-soft">
              Learn farming through carefully selected agricultural videos.
            </p>

            {watchAndLearnVideos && watchAndLearnVideos.length > 0 ? (
              <>
                <div className="mt-3 grid w-full grid-cols-2 gap-3 lg:grid-cols-3">
                  {(watchAndLearnVideos as unknown as EducationResourceCardData[]).map(
                    (video) => (
                      <ResourceCard
                        key={video.id}
                        resource={video}
                        topic={video.topic_id ? topicsById.get(video.topic_id) : undefined}
                      />
                    ),
                  )}
                </div>
                <Link
                  href={buildEducationHref({}, { type: "video" })}
                  className="mt-3 inline-flex w-fit items-center font-sans text-xs font-semibold text-shamba-ink-soft underline transition-colors hover:text-shamba-ink"
                >
                  See all videos
                </Link>
              </>
            ) : (
              // Zero video resources exist yet -- an explicit empty state
              // rather than an absent or blank-looking section, so the
              // Academy still reads as complete while Watch & Learn's
              // first batch of videos is still being curated.
              <div className="mt-3 rounded-shamba border border-dashed border-shamba-line bg-shamba-card p-6 text-center">
                <p className="font-display text-sm font-semibold text-shamba-ink">
                  Watch &amp; Learn is coming soon.
                </p>
                <p className="mt-1 text-sm text-shamba-ink-soft">
                  We&apos;re preparing a carefully selected collection of
                  agricultural videos from trusted sources.
                </p>
              </div>
            )}
          </section>
        )}

        {!hasError && (
          <div className="flex flex-col gap-3">
            {/* Learning Library: the same resource grid below, framed as a
                distinct, filterable surface (topic/learning-category
                filters already existed; resource type is new here) rather
                than a separate route -- an additive label + filter, not a
                page redesign. */}
            <h2 className="font-display text-lg font-semibold text-shamba-ink">
              Learning Library
            </h2>

            <nav aria-label="Resource type" className="flex flex-wrap gap-2">
              <Link
                href={buildEducationHref(currentParams, { type: undefined })}
                aria-current={!activeType ? "page" : undefined}
                className={
                  !activeType
                    ? "rounded-shamba bg-shamba-blue px-3 py-1.5 font-sans text-xs font-semibold text-shamba-card"
                    : "rounded-shamba border border-shamba-line bg-shamba-card px-3 py-1.5 font-sans text-xs font-semibold text-shamba-ink-soft transition-colors hover:border-shamba-blue hover:text-shamba-ink"
                }
              >
                All
              </Link>

              {RESOURCE_TYPES.map((value) => {
                const isActive = value === activeType;
                return (
                  <Link
                    key={value}
                    href={buildEducationHref(currentParams, { type: value })}
                    aria-current={isActive ? "page" : undefined}
                    className={
                      isActive
                        ? "rounded-shamba bg-shamba-blue px-3 py-1.5 font-sans text-xs font-semibold text-shamba-card"
                        : "rounded-shamba border border-shamba-line bg-shamba-card px-3 py-1.5 font-sans text-xs font-semibold text-shamba-ink-soft transition-colors hover:border-shamba-blue hover:text-shamba-ink"
                    }
                  >
                    {RESOURCE_TYPE_LABELS[value]}
                  </Link>
                );
              })}
            </nav>

            <nav aria-label="Education categories" className="flex flex-wrap gap-2">
              <Link
                href={buildEducationHref(currentParams, { category: undefined })}
                aria-current={!activeCategory ? "page" : undefined}
                className={
                  !activeCategory
                    ? "rounded-shamba bg-shamba-green px-4 py-2 font-sans text-sm font-semibold text-shamba-card"
                    : "rounded-shamba border border-shamba-line bg-shamba-card px-4 py-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:border-shamba-green hover:text-shamba-ink"
                }
              >
                All
              </Link>

              {(categories as EducationCategory[] | null)?.map((cat) => {
                const isActive = cat.id === activeCategory;
                return (
                  <Link
                    key={cat.id}
                    href={buildEducationHref(currentParams, { category: cat.id })}
                    aria-current={isActive ? "page" : undefined}
                    className={
                      isActive
                        ? "rounded-shamba bg-shamba-green px-4 py-2 font-sans text-sm font-semibold text-shamba-card"
                        : "rounded-shamba border border-shamba-line bg-shamba-card px-4 py-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:border-shamba-green hover:text-shamba-ink"
                    }
                  >
                    {cat.name}
                  </Link>
                );
              })}
            </nav>

            <nav aria-label="Learning categories" className="flex flex-wrap gap-2">
              <Link
                href={buildEducationHref(currentParams, { learning: undefined })}
                aria-current={!activeLearning ? "page" : undefined}
                className={
                  !activeLearning
                    ? "rounded-shamba bg-shamba-blue px-3 py-1.5 font-sans text-xs font-semibold text-shamba-card"
                    : "rounded-shamba border border-shamba-line bg-shamba-card px-3 py-1.5 font-sans text-xs font-semibold text-shamba-ink-soft transition-colors hover:border-shamba-blue hover:text-shamba-ink"
                }
              >
                All learning categories
              </Link>

              {LEARNING_CATEGORIES.map((value) => {
                const isActive = value === activeLearning;
                return (
                  <Link
                    key={value}
                    href={buildEducationHref(currentParams, { learning: value })}
                    aria-current={isActive ? "page" : undefined}
                    className={
                      isActive
                        ? "rounded-shamba bg-shamba-blue px-3 py-1.5 font-sans text-xs font-semibold text-shamba-card"
                        : "rounded-shamba border border-shamba-line bg-shamba-card px-3 py-1.5 font-sans text-xs font-semibold text-shamba-ink-soft transition-colors hover:border-shamba-blue hover:text-shamba-ink"
                    }
                  >
                    {LEARNING_CATEGORY_LABELS[value]}
                  </Link>
                );
              })}
            </nav>
          </div>
        )}

        {!hasError && (resources?.length ?? 0) === 0 && (
          <p className="text-sm text-shamba-ink-soft">
            {activeCategoryName
              ? `No published resources in ${activeCategoryName} yet.`
              : "No published resources yet."}
          </p>
        )}

        {!hasError && resources && resources.length > 0 && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {(resources as unknown as EducationResourceListItem[]).map((resource) => (
              <ResourceCard
                key={resource.id}
                resource={resource}
                topic={resource.topic_id ? topicsById.get(resource.topic_id) : undefined}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
