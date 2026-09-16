import { redirect } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import {
  EDUCATION_CATEGORY_ICON,
  EDUCATION_CATEGORY_FALLBACK_ICON,
} from "@/lib/education";

type EducationCategory = {
  id: string;
  name: string;
};

type EducationResourceListItem = {
  id: string;
  category_id: string;
  title: string;
  summary: string;
  source_name: string | null;
  published_at: string;
};

export default async function Education({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const { category } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: categories, error: categoriesError } = await supabase
    .from("education_categories")
    .select("id, name")
    .order("name");

  // Only trust a category filter that matches a real category -- an
  // unrecognised value in the query string is treated the same as no
  // filter, rather than passed straight into the resources query.
  const activeCategory = (categories ?? []).find((c) => c.id === category)
    ? category
    : undefined;

  let resourcesQuery = supabase
    .from("education_resources")
    .select("id, category_id, title, summary, source_name, published_at")
    .eq("is_published", true)
    .order("published_at", { ascending: false });

  if (activeCategory) {
    resourcesQuery = resourcesQuery.eq("category_id", activeCategory);
  }

  const { data: resources, error: resourcesError } = await resourcesQuery;

  const hasError = Boolean(categoriesError || resourcesError);
  const activeCategoryName = (categories as EducationCategory[] | null)?.find(
    (c) => c.id === activeCategory,
  )?.name;

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-8 px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-shamba-ink">
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

        {!hasError && (
          <nav aria-label="Education categories" className="flex flex-wrap gap-2">
            <Link
              href="/education"
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
                  href={`/education?category=${cat.id}`}
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
            {(resources as EducationResourceListItem[]).map((resource) => {
              const Icon =
                EDUCATION_CATEGORY_ICON[resource.category_id] ??
                EDUCATION_CATEGORY_FALLBACK_ICON;

              return (
                <Link
                  key={resource.id}
                  href={`/education/${resource.id}`}
                  className="flex flex-col gap-2 rounded-shamba border border-shamba-line bg-shamba-card p-4 transition-colors hover:border-shamba-green"
                >
                  <div className="flex items-center gap-2">
                    <Icon
                      className="size-5 shrink-0 text-shamba-green"
                      aria-hidden="true"
                    />
                    <h2 className="font-display text-base font-semibold leading-tight text-shamba-ink">
                      {resource.title}
                    </h2>
                  </div>

                  <p className="text-sm leading-6 text-shamba-ink-soft">
                    {resource.summary}
                  </p>

                  {resource.source_name && (
                    <p className="font-mono text-xs text-shamba-ink-soft">
                      Source: {resource.source_name}
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
