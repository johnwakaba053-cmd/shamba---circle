import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import {
  EDUCATION_CATEGORY_ICON,
  EDUCATION_CATEGORY_FALLBACK_ICON,
} from "@/lib/education";

type EducationResourceDetail = {
  id: string;
  category_id: string;
  title: string;
  summary: string;
  content: string;
  source_name: string | null;
  source_url: string | null;
  published_at: string;
  education_categories: { name: string } | null;
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
      "id, category_id, title, summary, content, source_name, source_url, published_at, education_categories(name)",
    )
    .eq("id", id)
    .eq("is_published", true)
    .maybeSingle();

  const resource = data as EducationResourceDetail | null;

  if (!error && !resource) {
    notFound();
  }

  const paragraphs = resource?.content.split("\n\n") ?? [];

  const { data: related } = resource
    ? await supabase
        .from("education_resources")
        .select("id, title, summary")
        .eq("category_id", resource.category_id)
        .eq("is_published", true)
        .neq("id", resource.id)
        .order("published_at", { ascending: false })
        .limit(3)
    : { data: null };

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
            {resource.education_categories && (
              <Link
                href={`/education?category=${resource.category_id}`}
                className="inline-flex items-center gap-2 font-mono text-xs font-semibold text-shamba-green transition-colors hover:text-shamba-green-deep"
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

            <div className="mt-6 flex flex-col gap-4 border-t border-shamba-line pt-6">
              {paragraphs.map((paragraph, index) => (
                <p
                  key={index}
                  className="whitespace-pre-wrap text-base leading-7 text-shamba-ink"
                >
                  {paragraph}
                </p>
              ))}
            </div>

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
            <h2 className="font-display text-lg font-semibold text-shamba-ink">
              Related resources
            </h2>
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
