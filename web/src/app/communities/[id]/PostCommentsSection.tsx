"use client";

import { useState } from "react";
import { MessageCircle } from "lucide-react";
import { PostCommentComposer } from "./PostCommentComposer";
import { PostCommentItem } from "./PostCommentItem";
import { PostCommentReactions } from "./PostCommentReactions";

type CommentData = {
  id: string;
  profileId: string;
  authorDisplayName: string;
  body: string;
  isAuthor: boolean;
  myReactionTypes: string[];
  reactionCounts: { reaction_type: string; count: number }[];
};

// Collapses each post's comment thread behind a tap, instead of every
// thread rendering fully expanded at once (the original behavior) --
// otherwise a community with real conversation volume turns into one
// extremely long page. The comment data itself is unchanged: it's still
// fetched server-side in page.tsx in the same single batched query as
// before, just conditionally rendered here rather than refetched on
// open. PostCommentItem/PostCommentComposer/PostCommentReactions are
// reused completely unmodified underneath -- no comment/reaction
// architecture changes in this batch.
export function PostCommentsSection({
  postId,
  isMember,
  comments,
  commentsFailed,
}: {
  postId: string;
  isMember: boolean;
  comments: CommentData[];
  commentsFailed: boolean;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="mt-2 flex flex-1 flex-col items-start gap-1">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="inline-flex min-h-9 items-center gap-1.5 rounded-shamba px-1 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink"
      >
        <MessageCircle className="size-4" aria-hidden="true" />
        {comments.length === 0
          ? "Add a comment"
          : `${comments.length} ${comments.length === 1 ? "comment" : "comments"}`}
      </button>

      {isOpen && (
        <div className="flex w-full flex-col gap-2 border-t border-shamba-line pt-3">
          {commentsFailed && (
            <p role="alert" className="text-xs font-semibold text-shamba-rust">
              We couldn&apos;t load comments right now.
            </p>
          )}

          {!commentsFailed && comments.length === 0 && (
            <p className="text-xs text-shamba-ink-soft">No comments yet.</p>
          )}

          {!commentsFailed &&
            comments.map((comment) => (
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
                  isMember={isMember}
                  initialMyReactionTypes={comment.myReactionTypes}
                  initialCounts={comment.reactionCounts}
                />
              </div>
            ))}

          <PostCommentComposer postId={postId} isMember={isMember} />
        </div>
      )}
    </div>
  );
}
