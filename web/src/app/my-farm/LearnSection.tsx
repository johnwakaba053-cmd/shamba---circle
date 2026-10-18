import Link from "next/link";
import { BookOpen } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { fetchEducationCovers, type EducationCover } from "@/lib/educationMedia";
import { CoverCredit } from "@/app/education/CoverCredit";
import { DashboardCard, EmptyLine } from "./DashboardCard";
import type { NamedItem } from "./FarmerSummaryCard";
import { GuideThumb, permittedGuideThumbnail, type GuideTopicKind } from "./GuideThumb";

// My Farm's guides: the newest published Education resources whose topic
// is one of the farmer's crops or livestock -- the same topic match the
// Education page's "Your Farm" row makes (education_topics keyed to
// crop_types / livestock_types). Titles only; the guide itself is read on
// /education/<id>. Each row has a small topic-coloured icon panel, or a
// video's own permitted YouTube still, or an article's licensed cover
// photo (lib/educationMedia.ts) with its credit (see GuideThumb).

const MAX_GUIDES = 3;

type Guide = {
  id: string;
  title: string;
  topicName: string;
  topicEmoji: string | null;
  categoryId: string;
  topicKind: GuideTopicKind;
  thumbnailSrc: string | null;
  isVideo: boolean;
  // Set only when thumbnailSrc is a licensed cover: its attribution.
  cover: EducationCover | null;
};

export type FarmGuidesResult =
  | { ok: true; guides: Guide[]; topicIds: string[]; unmatched: string[] }
  | { ok: false };

// Never rejects; null when the farmer hasn't chosen crops or livestock.
export async function loadFarmGuides(
  crops: NamedItem[],
  livestock: NamedItem[],
): Promise<FarmGuidesResult | null> {
  if (crops.length === 0 && livestock.length === 0) return null;
  try {
    const supabase = await createClient();
    const filters = [
      crops.length > 0 && `crop_type_id.in.(${crops.map((crop) => crop.id).join(",")})`,
      livestock.length > 0 && `livestock_type_id.in.(${livestock.map((animal) => animal.id).join(",")})`,
    ].filter(Boolean) as string[];

    const { data: topics, error: topicsError } = await supabase
      .from("education_topics")
      .select("id, name, topic_type, emoji, crop_type_id, livestock_type_id")
      .eq("is_active", true)
      .or(filters.join(","));
    if (topicsError) {
      console.error("[my-farm] education topics unavailable:", topicsError.message);
      return { ok: false };
    }

    const topicList = topics ?? [];
    const matchedTypeIds = new Set(topicList.flatMap((topic) => [topic.crop_type_id, topic.livestock_type_id]));
    const unmatched = [...crops, ...livestock].filter((item) => !matchedTypeIds.has(item.id)).map((item) => item.name);
    if (topicList.length === 0) {
      return { ok: true, guides: [], topicIds: [], unmatched };
    }

    const topicNameById = new Map(topicList.map((topic) => [topic.id as string, topic.name as string]));
    // Each guide's mark comes from its own topic: the topic's emoji (the
    // one Education's topic badges show) and its topic_type for colour.
    const topicById = new Map(topicList.map((topic) => [topic.id as string, topic]));
    const { data: resources, error } = await supabase
      .from("education_resources")
      .select("id, title, topic_id, category_id, resource_type, thumbnail_url")
      .eq("is_published", true)
      .in("topic_id", Array.from(topicNameById.keys()))
      .order("published_at", { ascending: false })
      .limit(MAX_GUIDES);
    if (error) {
      console.error("[my-farm] education resources unavailable:", error.message);
      return { ok: false };
    }

    // Cover photos for the (at most three) articles/documents; videos keep
    // their YouTube still.
    const covers = await fetchEducationCovers(
      supabase,
      (resources ?? []).filter((resource) => resource.resource_type !== "video").map((resource) => resource.id),
      "card",
    );

    return {
      ok: true,
      guides: (resources ?? []).map((resource) => {
        const videoStill = permittedGuideThumbnail(resource.resource_type, resource.thumbnail_url);
        const cover = resource.resource_type === "video" ? null : (covers.get(resource.id) ?? null);
        return {
          id: resource.id,
          title: resource.title,
          topicName: topicNameById.get(resource.topic_id) ?? "",
          topicEmoji: (topicById.get(resource.topic_id)?.emoji as string | null | undefined) ?? null,
          categoryId: resource.category_id,
          topicKind: topicById.get(resource.topic_id)?.topic_type === "livestock" ? "livestock" : "crop",
          thumbnailSrc: videoStill ?? cover?.src ?? null,
          isVideo: videoStill !== null,
          cover,
        };
      }),
      topicIds: Array.from(topicNameById.keys()),
      unmatched,
    };
  } catch (err) {
    console.error("[my-farm] guides unavailable:", err instanceof Error ? err.message : err);
    return { ok: false };
  }
}

export async function LearnSection({ guides }: { guides: Promise<FarmGuidesResult | null> }) {
  return <LearnCard result={await guides} />;
}

export function LearnCard({ result }: { result: FarmGuidesResult | null }) {
  // One topic: open Education already filtered to it.
  const moreHref = result?.ok && result.topicIds.length === 1 ? `/education?topic=${result.topicIds[0]}` : "/education";

  return (
    <DashboardCard
      icon={BookOpen}
      tone="bg-shamba-green/10 text-shamba-green"
      title="Learn"
      subtitle="Guides for your crops and livestock"
      href={moreHref}
      linkLabel="More guides"
    >
      {result === null ? (
        <EmptyLine href="/profile" linkLabel="Add your crops and livestock">
          Choose what you grow or keep to see guides for it.
        </EmptyLine>
      ) : !result.ok ? (
        <EmptyLine href="/education" linkLabel="Open Education">
          We couldn&apos;t load guides right now.
        </EmptyLine>
      ) : result.guides.length === 0 ? (
        <EmptyLine href="/education" linkLabel="Browse all guides">
          There are no guides for your crops or livestock yet.
        </EmptyLine>
      ) : (
        <div className="flex flex-col gap-2">
          <ul className="flex flex-col gap-2">
            {result.guides.map((guide) => (
              <li key={guide.id}>
                {/* No chevron here: in the narrow three-column layout every
                    pixel goes to the title, which may run to three lines. The
                    tinted tile and hover state already read as tappable. */}
                <Link
                  href={`/education/${guide.id}`}
                  data-thumb-scope
                  className="flex min-h-11 items-start gap-3 rounded-xl bg-shamba-bg p-2.5 transition-colors hover:bg-shamba-green/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shamba-green"
                >
                  <GuideThumb
                    emoji={guide.topicEmoji}
                    categoryId={guide.categoryId}
                    topicKind={guide.topicKind}
                    thumbnailSrc={guide.thumbnailSrc}
                    showPlay={guide.isVideo}
                  />
                  <span className="flex min-w-0 flex-1 flex-col gap-0.5 self-center">
                    {guide.topicName && (
                      <span className="truncate font-mono text-[11px] font-medium uppercase tracking-wide text-shamba-green">
                        {guide.topicName}
                      </span>
                    )}
                    <span className="line-clamp-3 text-sm font-semibold leading-5 text-pretty break-words text-shamba-ink">
                      {guide.title}
                    </span>
                    {guide.cover && (
                      <span data-thumb-credit className="text-[11px] leading-4 text-shamba-ink-soft">
                        <CoverCredit cover={guide.cover} />
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {result.unmatched.length > 0 && (
            <p className="text-xs leading-5 text-shamba-ink-soft">
              No guides yet for {result.unmatched.join(", ")}.
            </p>
          )}
        </div>
      )}
    </DashboardCard>
  );
}
