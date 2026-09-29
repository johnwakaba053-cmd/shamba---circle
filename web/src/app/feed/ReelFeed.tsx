"use client";

import { Fragment, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUp, CheckCircle2, Loader2, RotateCcw, Users } from "lucide-react";
import type { Reel } from "./types";
import type { LoadMoreReelsResult } from "./actions";
import { useFeedHeaderVisibility } from "./FeedHeaderVisibility";
import { ReelPlaybackProvider, useOptionalReelPlayback, useReelPlayback } from "./ReelPlayback";
import { ReelSlide } from "./ReelSlide";

// The vertical, one-Reel-per-screen viewer. Native CSS scroll-snap
// (overflow-y-auto + snap-y snap-mandatory), not a gesture/carousel
// library -- consistent with the horizontal media carousel this project
// already built the same way.
//
// Which Reel is on screen: one IntersectionObserver on this scroll
// container reports the slide that is at least 60% visible to
// ReelPlayback, which is what lets exactly one Reel video play.
//
// Pagination keeps the same keyset cursor (?before=<created_at>), but
// when `loadMore` is supplied (the Feed page) the next page is fetched
// in place once the farmer is within LOAD_AHEAD Reels of the end, and
// appended -- no full-page navigation, no dead-end slide. The last slide
// only shows loading / retry / "all caught up". Without `loadMore`
// (ProfilePostViewer) nothing is appended, exactly as before.
//
// Pages loaded in place live in client state, so after a
// router.refresh() (posting a comment, deleting a Reel, publishing a
// Reel...) the server only re-sends the first page. When that happens,
// the extra pages are re-fetched in order from the fresh first page's
// cursor so those Reels are refreshed too, with no gap or duplicate.
//
// This div's own onScroll is also the single scroll-direction source
// for FeedHeaderVisibility -- deliberately reusing this existing
// container rather than adding a second, page-level scroll listener.
const LOAD_AHEAD = 3;
const VISIBLE_RATIO = 0.6;
const END_SLIDE_ID = "__end__";

type ExtraPage = { cursor: string; reels: Reel[]; nextCursor: string | null };

type ReelFeedProps = {
  reels: Reel[];
  nextCursor: string | null;
  // Rendered as the first child inside this same scroll-snap container,
  // ahead of every ReelSlide -- lets StoriesRow (or nothing at all)
  // participate in the exact same native scroll/snap gesture as the
  // Reels below it.
  header?: React.ReactNode;
  // Jumps to this reel on mount, no animation -- used by
  // ProfilePostViewer, which opens already scrolled to the tapped grid
  // tile. Assumes no `header` is rendered ahead of the reels.
  initialIndex?: number;
  // In-place pagination (see above). Omitted = no loading more.
  loadMore?: (before: string) => Promise<LoadMoreReelsResult>;
};

export function ReelFeed(props: ReelFeedProps) {
  // The Feed page wraps ReelFeed (and its composer) in its own
  // ReelPlaybackProvider; anywhere else (ProfilePostViewer) ReelFeed
  // brings its own, so autoplay works the same everywhere.
  const outerPlayback = useOptionalReelPlayback();

  if (outerPlayback) {
    return <ReelFeedInner {...props} />;
  }

  return (
    <ReelPlaybackProvider>
      <ReelFeedInner {...props} />
    </ReelPlaybackProvider>
  );
}

function ReelFeedInner({ reels, nextCursor, header, initialIndex = 0, loadMore }: ReelFeedProps) {
  const { reportScrollTop } = useFeedHeaderVisibility();
  const { setVisibleReelId } = useReelPlayback();
  const scrollRef = useRef<HTMLDivElement>(null);

  const [extraPages, setExtraPages] = useState<ExtraPage[]>([]);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">("idle");
  const [visibleId, setVisibleId] = useState<string | null>(null);

  // Bumped whenever the first page is replaced by a refresh, so a
  // loadMore that was already in flight can't append a stale page.
  const versionRef = useRef(0);
  const loadingRef = useRef(false);
  const extraPageCountRef = useRef(0);
  const isFirstRenderRef = useRef(true);

  const seenIds = new Set<string>();
  const allReels: Reel[] = [];
  for (const reel of [...reels, ...extraPages.flatMap((page) => page.reels)]) {
    if (seenIds.has(reel.id)) continue;
    seenIds.add(reel.id);
    allReels.push(reel);
  }

  const cursor = extraPages.length > 0 ? extraPages[extraPages.length - 1].nextCursor : nextCursor;

  useEffect(() => {
    extraPageCountRef.current = extraPages.length;
  }, [extraPages]);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || initialIndex <= 0) return;
    el.scrollTop = initialIndex * el.clientHeight;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Which slide is on screen. Re-observes whenever the set of slides
  // changes (pages appended, or a refresh swapped Reels in or out).
  const slideKey = `${allReels.map((reel) => reel.id).join(",")}|${loadMore ? "end" : ""}`;
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;

    const ratios = new Map<string, number>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const id = (entry.target as HTMLElement).dataset.reelId;
          if (id) ratios.set(id, entry.intersectionRatio);
        }

        let bestId: string | null = null;
        let bestRatio = VISIBLE_RATIO;
        for (const [id, ratio] of ratios) {
          if (ratio >= bestRatio) {
            bestId = id;
            bestRatio = ratio;
          }
        }

        setVisibleId(bestId);
        setVisibleReelId(bestId === END_SLIDE_ID ? null : bestId);
      },
      { root, threshold: [0, VISIBLE_RATIO, 0.9, 1] },
    );

    root.querySelectorAll<HTMLElement>("[data-reel-id]").forEach((slide) => observer.observe(slide));

    return () => observer.disconnect();
  }, [slideKey, setVisibleReelId]);

  // Nothing plays once this feed is gone (e.g. ProfilePostViewer closed).
  useEffect(() => () => setVisibleReelId(null), [setVisibleReelId]);

  const loadNextPage = useCallback(async () => {
    if (!loadMore || !cursor || loadingRef.current) return;

    loadingRef.current = true;
    const version = versionRef.current;
    setLoadState("loading");

    try {
      const result = await loadMore(cursor);
      if (version !== versionRef.current) return;

      if (!result.ok) {
        setLoadState("error");
        return;
      }

      setExtraPages((pages) => [
        ...pages,
        { cursor, reels: result.reels, nextCursor: result.nextCursor },
      ]);
      setLoadState("idle");
    } catch {
      if (version === versionRef.current) setLoadState("error");
    } finally {
      loadingRef.current = false;
    }
  }, [loadMore, cursor]);

  // Load ahead as the farmer nears the end (or lands on the end slide).
  // Deferred a tick so the fetch starts from outside the effect body.
  const visibleIndex =
    visibleId === END_SLIDE_ID
      ? allReels.length
      : allReels.findIndex((reel) => reel.id === visibleId);
  const nearEnd = visibleIndex >= 0 && visibleIndex >= allReels.length - LOAD_AHEAD;

  useEffect(() => {
    if (!nearEnd || !loadMore || !cursor || loadState !== "idle") return;

    const timeoutId = window.setTimeout(() => void loadNextPage(), 0);
    return () => window.clearTimeout(timeoutId);
  }, [nearEnd, cursor, loadMore, loadState, loadNextPage]);

  // First page replaced by router.refresh(): re-fetch the in-place pages
  // from the new first page's cursor (see the note at the top).
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }

    versionRef.current += 1;
    const version = versionRef.current;
    const pageCount = extraPageCountRef.current;
    if (!loadMore || pageCount === 0) return;

    void (async () => {
      const refreshed: ExtraPage[] = [];
      let pageCursor = nextCursor;

      for (let i = 0; i < pageCount && pageCursor; i += 1) {
        const result = await loadMore(pageCursor);
        if (version !== versionRef.current || !result.ok) return;
        refreshed.push({ cursor: pageCursor, reels: result.reels, nextCursor: result.nextCursor });
        pageCursor = result.nextCursor;
      }

      if (version === versionRef.current) {
        setExtraPages(refreshed);
        setLoadState("idle");
      }
    })();
  }, [reels, nextCursor, loadMore]);

  function scrollToTop() {
    scrollRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }

  const showEndSlide = Boolean(loadMore) && allReels.length > 0;

  return (
    <div
      ref={scrollRef}
      onScroll={(event) => reportScrollTop(event.currentTarget.scrollTop)}
      className="h-full snap-y snap-mandatory overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:bg-shamba-bg"
    >
      {/* `header` is usually created by a Server Component (the Feed
          page's <StoriesRow />) and arrives unkeyed. Sitting next to the
          Reel list, it is one child in this div's children array, so
          React requires a key there ("Each child in a list should have a
          unique key prop ... passed a child from Feed"). It is a single,
          fixed slot, so a constant key is its stable identity. */}
      <Fragment key="reel-feed-header">{header}</Fragment>

      {allReels.map((reel) => (
        <ReelSlide key={reel.id} reel={reel} />
      ))}

      {showEndSlide && (
        <div
          data-reel-id={END_SLIDE_ID}
          className="flex h-full w-full shrink-0 snap-start snap-always items-center justify-center bg-shamba-ink px-6 sm:mx-auto sm:my-3 sm:h-[calc(100%-1.5rem)] sm:max-w-sm sm:rounded-shamba"
        >
          {cursor && loadState !== "error" && (
            <p
              role="status"
              className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-card/80"
            >
              <Loader2 className="size-5 animate-spin" aria-hidden="true" />
              Loading more Reels…
            </p>
          )}

          {cursor && loadState === "error" && (
            <div className="flex flex-col items-center gap-3 text-center">
              <p role="alert" className="font-sans text-sm font-semibold text-shamba-card">
                We couldn&apos;t load more Reels.
              </p>
              <button
                type="button"
                onClick={() => void loadNextPage()}
                className="inline-flex items-center gap-2 rounded-shamba bg-shamba-card px-5 py-2.5 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg"
              >
                <RotateCcw className="size-4" aria-hidden="true" />
                Retry
              </button>
            </div>
          )}

          {!cursor && (
            <div className="flex max-w-xs flex-col items-center gap-3 text-center">
              <CheckCircle2 className="size-8 text-shamba-card/80" aria-hidden="true" />
              <p className="font-display text-lg font-bold text-shamba-card">
                You&apos;re all caught up
              </p>
              <p className="text-sm leading-6 text-shamba-card/70">
                Join more communities to see more Reels, or share one from your farm.
              </p>
              <div className="mt-1 flex flex-wrap items-center justify-center gap-2">
                <Link
                  href="/communities"
                  className="inline-flex items-center gap-2 rounded-shamba bg-shamba-card px-4 py-2.5 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg"
                >
                  <Users className="size-4" aria-hidden="true" />
                  Communities
                </Link>
                <button
                  type="button"
                  onClick={scrollToTop}
                  className="inline-flex items-center gap-2 rounded-shamba border border-shamba-card/40 px-4 py-2.5 font-sans text-sm font-semibold text-shamba-card transition-colors hover:bg-white/10"
                >
                  <ArrowUp className="size-4" aria-hidden="true" />
                  Back to top
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
