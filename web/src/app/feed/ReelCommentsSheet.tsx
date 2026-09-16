"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { PostCommentComposer } from "../communities/[id]/PostCommentComposer";
import { PostCommentItem } from "../communities/[id]/PostCommentItem";
import { PostCommentReactions } from "../communities/[id]/PostCommentReactions";
import type { Reel } from "./types";

// Bottom sheet over a light background (not over media), so the
// existing Community comment components are reused completely
// unmodified here -- their styling was already designed for this app's
// normal (light) surfaces, unlike the Reel's own dark overlay controls,
// which had to be forked. isMember is always true: every Reel shown in
// /feed is either Feed-level (open to any authenticated farmer) or from
// a community the caller has joined -- see feed/page.tsx.
//
// Dialog semantics (role, aria-modal, focus-on-open, Escape-to-close,
// background scroll lock) match MediaViewer.tsx's existing pattern --
// the two are the same kind of full-screen overlay over Reel content.
export function ReelCommentsSheet({ reel, onClose }: { reel: Reel; onClose: () => void }) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const original = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = original;
    };
  }, []);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  function handleKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape") {
      onClose();
    }
  }

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="reel-comments-title"
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 outline-none"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="flex max-h-[75dvh] flex-col rounded-t-shamba border-t border-shamba-line bg-shamba-card">
        <div className="flex items-center justify-between border-b border-shamba-line px-4 py-3">
          <h2
            id="reel-comments-title"
            className="font-display text-base font-semibold text-shamba-ink"
          >
            Comments ({reel.comments.length})
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comments"
            className="inline-flex size-8 items-center justify-center rounded-full text-shamba-ink-soft transition-colors hover:bg-shamba-bg hover:text-shamba-ink"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-4 py-3">
          {reel.commentsFailed && (
            <p role="alert" className="text-xs font-semibold text-shamba-rust">
              We couldn&apos;t load comments right now.
            </p>
          )}

          {!reel.commentsFailed && reel.comments.length === 0 && (
            <p className="text-xs text-shamba-ink-soft">No comments yet.</p>
          )}

          <div className="flex flex-col gap-3">
            {reel.comments.map((comment) => (
              <div key={comment.id} className="flex flex-col gap-1.5">
                <PostCommentItem
                  commentId={comment.id}
                  authorProfileId={comment.profileId}
                  authorDisplayName={comment.authorDisplayName}
                  body={comment.body}
                  isAuthor={comment.isAuthor}
                />
                <PostCommentReactions
                  commentId={comment.id}
                  isMember={true}
                  initialMyReactionTypes={comment.myReactionTypes}
                  initialCounts={comment.reactionCounts}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-shamba-line px-4 py-3 pb-[calc(env(safe-area-inset-bottom,0px)+0.75rem)]">
          <PostCommentComposer postId={reel.id} isMember={true} />
        </div>
      </div>
    </div>
  );
}
