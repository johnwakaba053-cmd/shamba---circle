import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import {
  EDUCATION_CATEGORY_ICON,
  EDUCATION_CATEGORY_FALLBACK_ICON,
  LEARNING_CATEGORIES,
  LEARNING_CATEGORY_LABELS,
  RESOURCE_TYPES,
  RESOURCE_TYPE_LABELS,
  isLearningCategory,
  isResourceType,
  buildEducationHref,
  type LearningCategory,
  type ResourceType,
  type ResourceOrigin,
} from "@/lib/education";

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

type EducationResourceListItem = {
  id: string;
  category_id: string;
  topic_id: string | null;
  learning_category: LearningCategory | null;
  resource_type: ResourceType;
  origin: ResourceOrigin | null;
  title: string;
  summary: string;
  source_name: string | null;
  education_sources: { name: string } | null;
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
      "id, category_id, topic_id, learning_category, resource_type, origin, title, summary, source_name, education_sources(name), published_at",
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
                  🐄 Livestock
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
            {(resources as unknown as EducationResourceListItem[]).map((resource) => {
              const Icon =
                EDUCATION_CATEGORY_ICON[resource.category_id] ??
                EDUCATION_CATEGORY_FALLBACK_ICON;
              const resourceTopic = resource.topic_id
                ? topicsById.get(resource.topic_id)
                : undefined;

              return (
                // A plain <article>, not a <Link> -- the title link and the
                // "Read Resource" action below both point to the same detail
                // route as separate, sibling interactive elements, so the
                // card never nests one link inside another (invalid HTML)
                // while still giving the whole card exactly one destination.
                <article
                  key={resource.id}
                  className="flex flex-col gap-2 rounded-shamba border border-shamba-line bg-shamba-card p-4"
                >
                  {/* Shown only for origin = shamba_original -- distinct
                      green fill (not the neutral bg-shamba-bg used for the
                      type/topic/learning badges below) so a farmer can tell
                      at a glance this is Shamba Space's own written guide,
                      not an external link. */}
                  {resource.origin === "shamba_original" && (
                    <span className="w-fit rounded-shamba bg-shamba-green px-2 py-0.5 font-mono text-xs font-semibold text-shamba-card">
                      Shamba Space Original
                    </span>
                  )}

                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="rounded-shamba bg-shamba-bg px-2 py-0.5 font-mono text-xs font-semibold text-shamba-ink-soft">
                      {RESOURCE_TYPE_LABELS[resource.resource_type]}
                    </span>
                    {resourceTopic && (
                      <span className="rounded-shamba bg-shamba-bg px-2 py-0.5 font-mono text-xs font-semibold text-shamba-ink-soft">
                        {resourceTopic.emoji ? `${resourceTopic.emoji} ` : ""}
                        {resourceTopic.name}
                      </span>
                    )}
                    {resource.learning_category && (
                      <span className="rounded-shamba bg-shamba-bg px-2 py-0.5 font-mono text-xs font-semibold text-shamba-ink-soft">
                        {LEARNING_CATEGORY_LABELS[resource.learning_category]}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    <Icon
                      className="size-5 shrink-0 text-shamba-green"
                      aria-hidden="true"
                    />
                    <h2 className="font-display text-base font-semibold leading-tight text-shamba-ink">
                      <Link
                        href={`/education/${resource.id}`}
                        className="transition-colors hover:text-shamba-green hover:underline"
                      >
                        {resource.title}
                      </Link>
                    </h2>
                  </div>

                  <p className="text-sm leading-6 text-shamba-ink-soft">
                    {resource.summary}
                  </p>

                  {(resource.education_sources?.name || resource.source_name) && (
                    <p className="font-mono text-xs text-shamba-ink-soft">
                      Source: {resource.education_sources?.name ?? resource.source_name}
                    </p>
                  )}

                  <Link
                    href={`/education/${resource.id}`}
                    className="mt-1 inline-flex w-fit items-center gap-1.5 rounded-shamba border border-shamba-line px-3 py-1.5 font-sans text-xs font-semibold text-shamba-ink transition-colors hover:border-shamba-green hover:text-shamba-green"
                  >
                    Read Resource
                    <ArrowRight className="size-3.5" aria-hidden="true" />
                  </Link>
                </article>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
