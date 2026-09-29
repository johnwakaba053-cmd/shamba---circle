import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HelpCircle, PawPrint, Sprout, Wheat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { loadMoreReels } from "./actions";
import { FeedComposerLauncher } from "./FeedComposerLauncher";
import { FeedErrorState } from "./FeedErrorState";
import { FeedHeaderVisibilityProvider } from "./FeedHeaderVisibility";
import { FeedTopBar } from "./FeedTopBar";
import { fetchFeedPage } from "./feedData";
import { ReelFeed } from "./ReelFeed";
import { ReelPlaybackProvider } from "./ReelPlayback";
import { RefreshStaleMedia } from "./RefreshStaleMedia";
import { fetchActiveStories } from "./stories";
import { StoriesRow } from "./StoriesRow";

export const metadata: Metadata = {
  title: "Farming Reels · Shamba Space",
};

// How many not-yet-joined communities to surface for discovery — a small,
// bounded teaser, not a replica of the full grouped directory on
// /communities.
const SUGGESTED_COMMUNITY_COUNT = 6;

// Same per-group icon mapping already used on /communities and
// /communities/[id] — kept as a local copy rather than a shared import,
// matching how this project already duplicates this exact small constant
// per page rather than extracting a shared module.
const GROUP_ICON: Record<string, typeof Wheat> = {
  "Crop Farmers": Wheat,
  "Animal Farmers": PawPrint,
  Other: HelpCircle,
};

export default async function Feed({
  searchParams,
}: {
  searchParams: Promise<{ before?: string }>;
}) {
  const { before } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { reels, nextCursor, hasError, allCommunities, joinedCommunityIdSet, mediaIssuedAt } =
    await fetchFeedPage(supabase, user.id, before ?? null);

  const suggestedCommunities = allCommunities
    .filter((c) => !joinedCommunityIdSet.has(c.id))
    .slice(0, SUGGESTED_COMMUNITY_COUNT);

  // Independent of posts/Reels entirely -- fetched unconditionally here
  // (cheap, bounded query) and only rendered in the populated-Reels
  // branch below, per Step 71A's scope.
  const activeStories = await fetchActiveStories(supabase);

  return (
    <FeedHeaderVisibilityProvider>
      <ReelPlaybackProvider>
        <div className="relative h-[100dvh] overflow-hidden bg-shamba-bg">
          {/* Product direction: Feed has no AppHeader/navigation at any
              breakpoint -- it's a dedicated Farming Reels experience,
              Stories at the top of the same vertical scroll container as
              the Reels, not a page with a header above content. The only
              chrome is FeedTopBar, a small pill to leave Reels.
              FeedHeaderVisibilityProvider still wraps the page below --
              not for a header, but because ReelFeed still calls
              useFeedHeaderVisibility() for its own onScroll wiring and
              would throw without a provider present. ReelPlaybackProvider
              wraps both ReelFeed and the composer so opening the composer
              pauses whichever Reel is playing. */}

          <FeedTopBar />
          <RefreshStaleMedia issuedAt={mediaIssuedAt} />

          {hasError && <FeedErrorState />}

          {!hasError && reels.length === 0 && (
            <main className="absolute inset-0 mx-auto flex w-full max-w-5xl flex-col items-center overflow-y-auto px-6 pb-20 pt-28 sm:px-10 sm:pt-32">
              <div className="w-full max-w-sm">
                <div className="flex items-center gap-2">
                  <Sprout className="size-6 text-shamba-green" aria-hidden="true" />
                  <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-shamba-ink">
                    Farming Reels
                  </h1>
                </div>
                <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
                  Short videos and photos from farmers across Shamba Space.
                </p>
              </div>

              <div className="mt-6 w-full max-w-sm rounded-shamba border border-shamba-line bg-shamba-card p-6">
                <p className="text-base leading-6 text-shamba-ink-soft">
                  No Reels yet. Share something, or join a community to see posts
                  from other farmers here.
                </p>

                {suggestedCommunities.length > 0 && (
                  <div className="mt-4 flex flex-col gap-2">
                    {suggestedCommunities.map((community) => {
                      const Icon = GROUP_ICON[community.group_name] ?? HelpCircle;
                      return (
                        <Link
                          key={community.id}
                          href={`/communities/${community.id}`}
                          className="flex items-center gap-3 rounded-shamba border border-shamba-line bg-shamba-bg p-3 transition-colors hover:border-shamba-green"
                        >
                          <Icon className="size-5 shrink-0 text-shamba-green" aria-hidden="true" />
                          <span className="font-sans text-sm font-medium text-shamba-ink">
                            {community.name}
                          </span>
                        </Link>
                      );
                    })}
                  </div>
                )}

                <Link
                  href="/communities"
                  className="mt-4 inline-flex items-center justify-center rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep"
                >
                  Browse all Communities
                </Link>
              </div>
            </main>
          )}

          {!hasError && reels.length > 0 && (
            // No reserved header clearance at any breakpoint -- there's no
            // header to clear (see the note above). StoriesRow is not a
            // separate flex sibling reserving its own permanent space --
            // it's passed into ReelFeed as the first child of its own
            // scroll-snap container instead (see ReelFeed.tsx), so Reels
            // get the full available height rather than "whatever's left
            // after Stories' static band."
            <main className="absolute inset-0 overflow-hidden">
              <ReelFeed
                reels={reels}
                nextCursor={nextCursor}
                header={<StoriesRow stories={activeStories} />}
                loadMore={loadMoreReels}
              />
            </main>
          )}

          <FeedComposerLauncher />
        </div>
      </ReelPlaybackProvider>
    </FeedHeaderVisibilityProvider>
  );
}
