"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import type { PostMediaItem } from "@/lib/postMedia";
import { VideoMuteButton } from "@/components/VideoMuteButton";
import { MediaViewer } from "./MediaViewer";
import { useOptionalReelPlayback } from "./ReelPlayback";

// Full-bleed Reel media, filling the slide behind the caption/rail
// overlays -- replaces the old card-thumbnail FeedPostMedia.tsx, which
// doesn't fit a full-viewport Reel. Multiple items still use their own
// horizontal swipe carousel (native scroll-snap, no gesture library),
// but the page indicator moves to a thin segmented bar pinned to the top
// edge (Stories-style) instead of bottom dots, so it never collides with
// the bottom caption block or the right-side interaction rail, which
// both anchor to the bottom. Tapping a photo or a playing video opens the
// same full-screen MediaViewer, unchanged, where video gets native
// controls.
//
// Autoplay: when this Reel is the one on screen (isActive, decided by
// ReelFeed + ReelPlayback so only ONE Reel ever plays), the video in the
// visible carousel position plays muted, inline and looping -- the same
// autoPlay/muted/playsInline recipe Stories already use, sharing its
// mute control (VideoMuteButton). Every other video is paused, including
// while MediaViewer is open on top. If the browser refuses autoplay
// (play() rejects, e.g. battery saver), nothing breaks: the video stays
// paused behind the Play overlay, and tapping it plays the video inline
// (falling back to the full-screen viewer if even that is refused).
// touch-pan-x on the
// scroller hints the browser that this element only handles horizontal
// panning itself, so it defers vertical panning to the outer vertical
// Reel scroller (ReelFeed.tsx) instead of guessing from swipe angle --
// doesn't change vertical scroll behavior, just makes the two axes
// disambiguate more reliably.
export function ReelMedia({
  items,
  isActive = false,
}: {
  items: PostMediaItem[];
  isActive?: boolean;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [playingIndex, setPlayingIndex] = useState<number | null>(null);
  const playback = useOptionalReelPlayback();
  const muted = playback?.muted ?? true;

  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) return;
      video.muted = muted;

      if (isActive && !viewerOpen && index === activeIndex) {
        // Rejection = autoplay blocked; the Play overlay stays as fallback.
        video.play().catch(() => {});
      } else if (!video.paused) {
        video.pause();
      }
    });
  }, [isActive, viewerOpen, activeIndex, muted, items]);

  if (items.length === 0) {
    return null;
  }

  const activeItemIsVideo = items[activeIndex]?.mediaType === "video";

  function handleScroll() {
    const el = scrollRef.current;
    if (!el || el.clientWidth === 0) return;
    const index = Math.round(el.scrollLeft / el.clientWidth);
    setActiveIndex(Math.max(0, Math.min(index, items.length - 1)));
  }

  function scrollToIndex(index: number) {
    const el = scrollRef.current;
    if (!el) return;
    const clamped = Math.max(0, Math.min(index, items.length - 1));
    el.scrollTo({ left: clamped * el.clientWidth, behavior: "smooth" });
    setActiveIndex(clamped);
  }

  return (
    <>
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className={`flex h-full snap-x snap-mandatory overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden ${
          items.length > 1 ? "touch-pan-x" : ""
        }`}
      >
        {items.map((item, index) => (
          <button
            key={item.id}
            type="button"
            onClick={() => {
              setActiveIndex(index);

              // Tap-to-play fallback: if this is the on-screen Reel's video
              // and autoplay was blocked, the tap (a user gesture, which
              // phones do allow) plays it inline. Only if even that fails
              // -- or it's a photo / an already-playing video -- does the
              // tap open the full-screen MediaViewer, exactly as before.
              const video = videoRefs.current[index];
              if (item.mediaType === "video" && isActive && video && video.paused) {
                video.muted = muted;
                video.play().catch(() => setViewerOpen(true));
                return;
              }

              setViewerOpen(true);
            }}
            aria-label={
              item.mediaType === "video" && playingIndex !== index
                ? `Play video ${index + 1} of ${items.length}`
                : `Open ${item.mediaType} ${index + 1} of ${items.length}`
            }
            className="relative h-full w-full flex-none snap-center snap-always"
          >
            {item.mediaType === "video" ? (
              <>
                <video
                  ref={(el) => {
                    videoRefs.current[index] = el;
                  }}
                  src={item.url}
                  className="size-full object-cover"
                  muted
                  loop
                  playsInline
                  preload={isActive && index === activeIndex ? "auto" : "metadata"}
                  onPlaying={() => setPlayingIndex(index)}
                  onPause={() => setPlayingIndex((current) => (current === index ? null : current))}
                />
                {playingIndex !== index && (
                  <span className="absolute inset-0 flex items-center justify-center">
                    <span className="flex size-16 items-center justify-center rounded-full bg-black/40">
                      <Play
                        className="size-7 fill-shamba-card text-shamba-card"
                        aria-hidden="true"
                      />
                    </span>
                  </span>
                )}
              </>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={item.url} alt="" className="size-full object-cover" />
            )}
          </button>
        ))}
      </div>

      {items.length > 1 && (
        <>
          <div className="pointer-events-none absolute inset-x-3 top-[calc(env(safe-area-inset-top,0px)+0.375rem)] z-20 flex gap-1">
            {items.map((_, index) => (
              <span
                key={index}
                className={`h-0.5 flex-1 rounded-full transition-colors ${
                  index === activeIndex ? "bg-shamba-card" : "bg-shamba-card/35"
                }`}
                aria-hidden="true"
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => scrollToIndex(activeIndex - 1)}
            disabled={activeIndex === 0}
            aria-label="Previous photo or video"
            className="absolute left-2 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/30 p-1.5 text-shamba-card transition-opacity hover:bg-black/50 disabled:opacity-0 sm:flex"
          >
            <ChevronLeft className="size-4" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => scrollToIndex(activeIndex + 1)}
            disabled={activeIndex === items.length - 1}
            aria-label="Next photo or video"
            className="absolute right-2 top-1/2 z-20 hidden -translate-y-1/2 items-center justify-center rounded-full bg-black/30 p-1.5 text-shamba-card transition-opacity hover:bg-black/50 disabled:opacity-0 sm:flex"
          >
            <ChevronRight className="size-4" aria-hidden="true" />
          </button>
        </>
      )}

      {/* Below the Feed's top control / ProfilePostViewer's close
          button, which both sit at the top edge. */}
      {activeItemIsVideo && playback && (
        <VideoMuteButton
          muted={muted}
          onToggle={playback.toggleMuted}
          className="absolute right-3 top-[calc(env(safe-area-inset-top,0px)+3.5rem)] z-20 size-9"
        />
      )}

      {viewerOpen && (
        <MediaViewer
          items={items}
          initialIndex={activeIndex}
          onClose={() => setViewerOpen(false)}
        />
      )}
    </>
  );
}
