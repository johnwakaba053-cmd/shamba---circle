"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronLeft,
  ChevronRight,
  Loader2,
  Rss,
  Tag,
  Trash2,
  UserRound,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { fetchCreatorActiveStories, type ActiveStory, type StoryDetail } from "./stories";

// Full-screen Story viewer -- deliberately isolated from ReelFeed.tsx/
// ReelSlide.tsx/ReelInteractionRail.tsx (no shared code, no shared
// state, no changes to any of them). It's a plain fixed-position
// overlay, the same category of thing as MediaViewer.tsx/
// ReelCommentsSheet.tsx already are, not a second vertical scroll
// container: no scroll-snap, no window scroll listeners, no layout-
// height animation anywhere near the Reel viewport.
//
// `creators` is StoriesRow's own already-fetched, already-ordered
// `stories` array (one entry per creator) -- reused as-is for
// cross-creator navigation order, not refetched. What *is* fetched
// fresh here, per creator, is that creator's full active Story
// sequence via fetchCreatorActiveStories -- this is the authoritative,
// just-in-time expiry check (StoriesRow's own data can be stale by the
// time a bubble is actually tapped); a creator who no longer has any
// active Story is skipped over automatically rather than shown.
const IMAGE_STORY_DURATION_MS = 5000;

type PendingEdge = "start" | "end";

type DeleteStatus =
  | { kind: "idle" }
  | { kind: "confirming" }
  | { kind: "deleting" }
  | { kind: "error"; message: string };

export function StoryViewer({
  creators,
  initialCreatorIndex,
  onClose,
}: {
  creators: ActiveStory[];
  initialCreatorIndex: number;
  onClose: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const pendingEdgeRef = useRef<PendingEdge>("start");

  const [creatorIndex, setCreatorIndex] = useState(initialCreatorIndex);
  const [stories, setStories] = useState<StoryDetail[] | null>(null);
  const [storyIndex, setStoryIndex] = useState(0);
  const [captionExpanded, setCaptionExpanded] = useState(false);
  const [muted, setMuted] = useState(true);
  const [videoProgress, setVideoProgress] = useState(0);
  const [viewerProfileId, setViewerProfileId] = useState<string | null>(null);
  const [deleteStatus, setDeleteStatus] = useState<DeleteStatus>({ kind: "idle" });

  const currentStory = stories?.[storyIndex] ?? null;
  const isOwnStory = viewerProfileId !== null && currentStory?.profileId === viewerProfileId;
  // Covers "confirming", "deleting", AND "error" -- the confirmation
  // overlay stays open (showing the error, with Cancel/Delete still
  // available to retry) until the user explicitly cancels or a delete
  // actually succeeds, so navigation stays blocked for all three.
  const isDeleteOverlayOpen = deleteStatus.kind !== "idle";

  // Fetched once on mount, purely to decide whether *this* viewer sees
  // a delete control at all -- the real security boundary is
  // delete_my_story()'s own auth.uid() check server-side, not this
  // client-side comparison, which only controls whether the button
  // renders.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setViewerProfileId(data.user?.id ?? null);
    });
  }, []);

  // Lock background scroll while open -- same pattern as
  // MediaViewer.tsx/ReelCommentsSheet.tsx.
  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // Moves to a specific creator, fetching that creator's fresh active
  // sequence. If it turns out to be empty (expired since StoriesRow's
  // own data was fetched, or between one Story and the next here), that
  // creator is skipped in the same direction rather than shown empty --
  // this recursion is loop-safe by construction, since each step moves
  // the index strictly toward one end of a finite array, and running off
  // either end closes the viewer.
  async function openCreator(index: number, edge: PendingEdge) {
    if (index < 0 || index >= creators.length) {
      onClose();
      return;
    }

    setCreatorIndex(index);
    setStories(null);
    setStoryIndex(0);
    setCaptionExpanded(false);
    pendingEdgeRef.current = edge;

    const supabase = createClient();
    const fetched = await fetchCreatorActiveStories(supabase, creators[index].profileId);

    if (fetched.length === 0) {
      const nextIndex = edge === "start" ? index + 1 : index - 1;
      await openCreator(nextIndex, edge);
      return;
    }

    setStories(fetched);
    setStoryIndex(pendingEdgeRef.current === "start" ? 0 : fetched.length - 1);
  }

  useEffect(() => {
    openCreator(initialCreatorIndex, "start");
    // Only runs once on mount -- subsequent navigation goes through
    // goToNext/goToPrevious calling openCreator directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function goToNext() {
    // Blocked while a delete confirmation/attempt is in progress -- an
    // auto-advance or tap-zone navigation firing mid-confirmation would
    // yank the confirm UI out from under the user, or navigate away
    // during the delete call itself.
    if (!stories || isDeleteOverlayOpen) return;
    if (storyIndex < stories.length - 1) {
      setStoryIndex((index) => index + 1);
      setCaptionExpanded(false);
    } else {
      openCreator(creatorIndex + 1, "start");
    }
  }

  function goToPrevious() {
    if (!stories || isDeleteOverlayOpen) return;
    if (storyIndex > 0) {
      setStoryIndex((index) => index - 1);
      setCaptionExpanded(false);
    } else {
      openCreator(creatorIndex - 1, "end");
    }
  }

  // Auto-advance for image Stories -- a plain timeout, reset whenever
  // the active Story changes (including manual navigation, since that
  // changes currentStory.id too). Video Stories advance from onEnded
  // below instead; no timer runs for them.
  useEffect(() => {
    if (!currentStory || currentStory.mediaType !== "image") return;
    const timeoutId = setTimeout(goToNext, IMAGE_STORY_DURATION_MS);
    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStory?.id]);

  // Records exactly one view per "this Story is now the one being
  // shown" transition -- keyed on currentStory.id, same as the
  // auto-advance timer above, so it fires once on mount and again only
  // when the displayed Story actually changes (never on a bare
  // re-render, and never once per Story merely existing in the
  // Stories row). Fire-and-forget: record_story_view is idempotent
  // (ON CONFLICT DO NOTHING) and this stage builds no UI that reacts to
  // its result, so nothing here needs to await it, retry it, or surface
  // its outcome.
  useEffect(() => {
    if (!currentStory) return;
    const supabase = createClient();
    void supabase.rpc("record_story_view", { p_story_id: currentStory.id });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStory?.id]);

  // Resets videoProgress/fillStarted the moment currentStory changes --
  // done synchronously during render (the React-documented "adjusting
  // state when a prop changes" pattern) rather than in an effect, since
  // an effect body may not call setState synchronously. Only the actual
  // rAF-deferred flip below needs an effect at all.
  const [fillStarted, setFillStarted] = useState(false);
  const [lastSeenStoryId, setLastSeenStoryId] = useState(currentStory?.id);
  if (currentStory?.id !== lastSeenStoryId) {
    setLastSeenStoryId(currentStory?.id);
    setVideoProgress(0);
    setFillStarted(false);
  }

  // Drives the image-Story progress fill via a plain CSS width
  // transition rather than a JS animation loop or a global @keyframes
  // block (kept out of this codebase entirely) -- one animation frame
  // after the reset above, flip to the full duration + w-full so the
  // browser actually animates the change instead of jumping straight to
  // 100%.
  useEffect(() => {
    if (!currentStory || currentStory.mediaType !== "image") return;
    const rafId = requestAnimationFrame(() => setFillStarted(true));
    return () => cancelAnimationFrame(rafId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStory?.id, currentStory?.mediaType]);

  function handleDialogKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      // Escape backs out of the confirmation step first, rather than
      // closing the whole viewer out from under a pending destructive
      // action; it's a no-op while the delete call itself is in flight.
      if (deleteStatus.kind === "confirming" || deleteStatus.kind === "error") {
        setDeleteStatus({ kind: "idle" });
      } else if (deleteStatus.kind === "idle") {
        onClose();
      }
    } else if (event.key === "ArrowRight") {
      goToNext();
    } else if (event.key === "ArrowLeft") {
      goToPrevious();
    }
  }

  // Removes the just-deleted Story from this viewer's own local state
  // and lands on the next sensible place to be -- the next remaining
  // Story for the same creator, the next creator (reusing openCreator's
  // existing "this creator has nothing active" skip logic), or closed
  // entirely if nothing is left anywhere. router.refresh() is
  // fire-and-forget here: it re-fetches page.tsx's server-side
  // activeStories so StoriesRow's own bubble list (and, via its
  // existing findIndex check, "Your Story"'s creation-vs-viewer routing)
  // catches up once it next renders -- it does not block or delay the
  // viewer's own immediate, already-updated local state.
  function removeCurrentStoryAndAdvance(deletedStoryId: string) {
    router.refresh();

    setCaptionExpanded(false);
    setDeleteStatus({ kind: "idle" });

    // Read `stories` from this render's closure rather than a setState
    // updater callback: openCreator below has its own side effects
    // (fetching, further setState calls), which must never run from
    // inside a setState updater. This is safe to read directly --
    // navigation is blocked by isDeleteOverlayOpen for the entire
    // confirm/delete window, so nothing else can have changed `stories`
    // in the meantime.
    const remaining = (stories ?? []).filter((story) => story.id !== deletedStoryId);

    if (remaining.length === 0) {
      setStories(null);
      openCreator(creatorIndex + 1, "start");
      return;
    }

    setStoryIndex((index) => Math.min(index, remaining.length - 1));
    setStories(remaining);
  }

  async function handleConfirmDelete() {
    if (!currentStory || deleteStatus.kind === "deleting") return;

    setDeleteStatus({ kind: "deleting" });

    const supabase = createClient();
    const { data: deleted, error } = await supabase.rpc("delete_my_story", {
      p_story_id: currentStory.id,
    });

    if (error || !deleted) {
      setDeleteStatus({
        kind: "error",
        message: "We couldn't delete that Story. Please try again.",
      });
      return;
    }

    // Best-effort storage cleanup -- the database row (the authoritative
    // record) is already gone at this point, so a failure here only
    // ever leaves behind an orphaned object nothing in the app links to
    // or can render again, never a broken/dangling Story. Deliberately
    // not awaited-and-blocking the UI transition below on it.
    void supabase.storage.from("story-media").remove([currentStory.mediaPath]);

    removeCurrentStoryAndAdvance(currentStory.id);
  }

  const isLongCaption = (currentStory?.caption?.length ?? 0) > 140;

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label="Story viewer"
      tabIndex={-1}
      onKeyDown={handleDialogKeyDown}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black outline-none"
    >
      <div className="relative h-full w-full overflow-hidden bg-shamba-ink sm:my-4 sm:h-[calc(100%-2rem)] sm:max-w-sm sm:rounded-shamba">
        {!stories || !currentStory ? (
          <div className="flex size-full items-center justify-center">
            <Loader2 className="size-8 animate-spin text-shamba-card" aria-hidden="true" />
          </div>
        ) : (
          <>
            {currentStory.mediaType === "video" ? (
              <video
                ref={videoRef}
                key={currentStory.id}
                src={currentStory.mediaUrl ?? undefined}
                autoPlay
                muted={muted}
                playsInline
                onEnded={goToNext}
                onTimeUpdate={(event) => {
                  const el = event.currentTarget;
                  if (el.duration > 0) setVideoProgress(el.currentTime / el.duration);
                }}
                className="size-full object-contain"
              />
            ) : currentStory.mediaUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={currentStory.id}
                src={currentStory.mediaUrl}
                alt=""
                className="size-full object-cover"
              />
            ) : (
              <div className="flex size-full items-center justify-center text-shamba-card/70">
                <p className="font-sans text-sm">This Story&apos;s media couldn&apos;t be loaded.</p>
              </div>
            )}

            <div className="pointer-events-none absolute inset-x-0 top-0 h-1/3 bg-gradient-to-b from-black/70 to-transparent" />
            <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-black/75 to-transparent" />

            {/* Progress segments -- one per Story in the current creator's
                sequence, reset automatically whenever creatorIndex changes
                since `stories` itself is replaced. */}
            <div className="absolute inset-x-3 top-[calc(env(safe-area-inset-top,0px)+0.75rem)] z-20 flex gap-1">
              {stories.map((story, index) => (
                <div
                  key={story.id}
                  className="h-0.5 flex-1 overflow-hidden rounded-full bg-shamba-card/35"
                >
                  <div
                    className={
                      index < storyIndex
                        ? "h-full w-full bg-shamba-card"
                        : index > storyIndex
                          ? "h-full w-0 bg-shamba-card"
                          : currentStory.mediaType === "video"
                            ? "h-full bg-shamba-card"
                            : `h-full bg-shamba-card transition-[width] ease-linear ${
                                fillStarted ? "w-full duration-[5000ms]" : "w-0 duration-0"
                              }`
                    }
                    style={
                      index === storyIndex && currentStory.mediaType === "video"
                        ? { width: `${Math.min(videoProgress * 100, 100)}%` }
                        : undefined
                    }
                  />
                </div>
              ))}
            </div>

            {/* Creator identity */}
            <div className="absolute inset-x-3 top-[calc(env(safe-area-inset-top,0px)+1.5rem)] z-20 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-black/30 backdrop-blur-sm">
                  <UserRound className="size-4 text-shamba-card" aria-hidden="true" />
                </span>
                <Link
                  href={`/profile/${currentStory.profileId}`}
                  className="font-sans text-sm font-semibold text-shamba-card drop-shadow transition-colors hover:text-shamba-green"
                >
                  {currentStory.displayName ?? "Member"}
                </Link>
              </div>

              <div className="flex items-center gap-1">
                {currentStory.mediaType === "video" && (
                  <button
                    type="button"
                    onClick={() => setMuted((value) => !value)}
                    aria-label={muted ? "Unmute" : "Mute"}
                    className="inline-flex size-8 items-center justify-center rounded-full bg-black/30 text-shamba-card backdrop-blur-sm"
                  >
                    {muted ? (
                      <VolumeX className="size-4" aria-hidden="true" />
                    ) : (
                      <Volume2 className="size-4" aria-hidden="true" />
                    )}
                  </button>
                )}
                {isOwnStory && (
                  <button
                    type="button"
                    onClick={() => setDeleteStatus({ kind: "confirming" })}
                    disabled={isDeleteOverlayOpen}
                    aria-label="Delete story"
                    className="inline-flex size-8 items-center justify-center rounded-full bg-black/30 text-shamba-card backdrop-blur-sm disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close Story"
                  disabled={deleteStatus.kind === "deleting"}
                  className="inline-flex size-8 items-center justify-center rounded-full bg-black/30 text-shamba-card backdrop-blur-sm disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <X className="size-4" aria-hidden="true" />
                </button>
              </div>
            </div>

            {/* Tap zones -- left half = previous, right half = next.
                Real buttons, not clickable divs. */}
            <button
              type="button"
              onClick={goToPrevious}
              aria-label="Previous Story"
              className="absolute inset-y-0 left-0 z-10 w-1/2"
            />
            <button
              type="button"
              onClick={goToNext}
              aria-label="Next Story"
              className="absolute inset-y-0 right-0 z-10 w-1/2"
            />

            {/* Desktop-only chevrons, mirroring MediaViewer.tsx's own
                hidden-below-sm affordance. */}
            <div className="pointer-events-none absolute inset-0 z-10 hidden items-center justify-between px-2 sm:flex">
              <span className="pointer-events-auto inline-flex size-9 items-center justify-center rounded-full bg-black/20 text-shamba-card opacity-0 transition-opacity hover:opacity-100">
                <ChevronLeft className="size-5" aria-hidden="true" />
              </span>
              <span className="pointer-events-auto inline-flex size-9 items-center justify-center rounded-full bg-black/20 text-shamba-card opacity-0 transition-opacity hover:opacity-100">
                <ChevronRight className="size-5" aria-hidden="true" />
              </span>
            </div>

            {/* Caption / topic / hashtags / mentions -- own self-contained
                block, not shared with ReelInfo.tsx, to keep this viewer
                fully isolated from the Reel component tree. */}
            <div className="absolute inset-x-3 bottom-[calc(env(safe-area-inset-bottom,0px)+1rem)] z-20 text-shamba-card">
              {currentStory.topic && (
                <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 font-mono text-xs font-semibold backdrop-blur-sm">
                  <Tag className="size-3" aria-hidden="true" />
                  {currentStory.topic}
                </span>
              )}
              {!currentStory.topic && (
                <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-black/30 px-2 py-0.5 font-mono text-xs font-semibold backdrop-blur-sm">
                  <Rss className="size-3" aria-hidden="true" />
                  Farming Story
                </span>
              )}

              {currentStory.caption && (
                <div className="mt-1.5 text-sm leading-5 drop-shadow">
                  <p
                    className={
                      captionExpanded
                        ? "max-h-[30vh] overflow-y-auto overscroll-contain whitespace-pre-wrap pr-1"
                        : "line-clamp-2 whitespace-pre-wrap"
                    }
                  >
                    {currentStory.caption}
                  </p>
                  {isLongCaption && (
                    <button
                      type="button"
                      onClick={() => setCaptionExpanded((value) => !value)}
                      className="mt-0.5 font-mono text-xs font-semibold text-shamba-card/80 hover:text-shamba-card"
                    >
                      {captionExpanded ? "Show less" : "Show more"}
                    </button>
                  )}
                </div>
              )}

              {currentStory.hashtags.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1">
                  {currentStory.hashtags.map((tag) => (
                    <span key={tag} className="font-mono text-xs text-shamba-card/80 drop-shadow">
                      #{tag}
                    </span>
                  ))}
                </div>
              )}

              {currentStory.mentions.length > 0 && (
                <div className="mt-1.5 flex flex-wrap gap-x-2 gap-y-1">
                  {currentStory.mentions.map((mention) =>
                    mention.displayName ? (
                      <Link
                        key={mention.profileId}
                        href={`/profile/${mention.profileId}`}
                        className="font-mono text-xs text-shamba-card/80 drop-shadow transition-colors hover:text-shamba-green"
                      >
                        @{mention.displayName}
                      </Link>
                    ) : (
                      <span
                        key={mention.profileId}
                        className="font-mono text-xs text-shamba-card/60 drop-shadow"
                      >
                        @a Shamba Circle member
                      </span>
                    ),
                  )}
                </div>
              )}
            </div>

            {/* Delete confirmation -- a full-cover overlay rather than a
                second stacked dialog, so it also visually and
                functionally blocks the tap zones/auto-advance behind it
                (goToNext/goToPrevious additionally no-op while this is
                open, as a second layer of protection, not the only
                one). Only ever reachable via the owner-only Trash2
                button above, but isOwnStory is a display-only check --
                delete_my_story()'s own auth.uid() check is the actual
                security boundary. */}
            {isDeleteOverlayOpen && (
              <div className="absolute inset-0 z-30 flex items-end justify-center bg-black/70 p-4 sm:items-center">
                <div className="w-full max-w-xs rounded-shamba bg-shamba-card p-4 text-center">
                  <p className="font-sans text-sm font-semibold text-shamba-ink">
                    Delete this story?
                  </p>
                  {deleteStatus.kind === "error" && (
                    <p role="alert" className="mt-1.5 font-sans text-xs font-semibold text-shamba-rust">
                      {deleteStatus.message}
                    </p>
                  )}
                  <div className="mt-3 flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setDeleteStatus({ kind: "idle" })}
                      disabled={deleteStatus.kind === "deleting"}
                      className="inline-flex items-center justify-center rounded-shamba px-4 py-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmDelete}
                      disabled={deleteStatus.kind === "deleting"}
                      className="inline-flex items-center justify-center gap-2 rounded-shamba bg-shamba-rust px-4 py-2 font-sans text-sm font-semibold text-shamba-card transition-colors hover:bg-shamba-rust/85 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {deleteStatus.kind === "deleting" && (
                        <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
                      )}
                      {deleteStatus.kind === "deleting" ? "Deleting…" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
