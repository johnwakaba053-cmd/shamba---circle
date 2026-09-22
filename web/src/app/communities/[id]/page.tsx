import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { ProfileLink } from "@/components/ProfileLink";
import { formatDaySeparator, formatMessageTime, isSameDay } from "@/lib/formatMessageTime";
import { MembershipControl } from "./MembershipControl";
import { PostComposer } from "./PostComposer";
import { PostLikeControl } from "./PostLikeControl";
import { PostCommentsSection } from "./PostCommentsSection";
import { PostDeleteControl } from "./PostDeleteControl";
import { PostMedia } from "./PostMedia";
import { CommunityConversation } from "./CommunityConversation";
import { fetchPostMediaByPostId } from "@/lib/postMedia";

type PostCommentRow = {
  id: string;
  post_id: string;
  profile_id: string;
  author_display_name: string;
  body: string;
  created_at: string;
};

type PostRow = {
  id: string;
  profile_id: string;
  author_display_name: string;
  body: string;
  created_at: string;
};

type MessageGroup = {
  key: string;
  dateLabel: string | null;
  profileId: string;
  authorDisplayName: string;
  timestamp: string;
  posts: PostRow[];
};

// A burst continues only while it's the same farmer, on the same
// Nairobi calendar day (see lib/formatMessageTime.ts), AND within this
// gap of their previous message -- matching the approved audit's own
// "a few minutes" recommendation. A longer pause from the same farmer
// starts a fresh header rather than silently attaching to an old one.
const GROUP_GAP_MS = 5 * 60 * 1000;

// Groups consecutive posts from the same farmer into one visual "burst"
// (one avatar/name/timestamp header, several message lines underneath)
// and marks where a date separator belongs. Purely a rendering-layer
// transform over the already-fetched, already-ordered posts -- every
// post inside every group is still rendered as its own independent
// element below (see the JSX), so likes/comments/deletion keep working
// per post exactly as before this batch.
function groupMessages(posts: PostRow[]): MessageGroup[] {
  const groups: MessageGroup[] = [];

  for (const post of posts) {
    const prevGroup = groups.at(-1);
    const prevPost = prevGroup?.posts.at(-1);

    const sameDay = prevPost ? isSameDay(prevPost.created_at, post.created_at) : false;
    const sameAuthor = prevGroup ? prevGroup.profileId === post.profile_id : false;
    const withinGap = prevPost
      ? new Date(post.created_at).getTime() - new Date(prevPost.created_at).getTime() <=
        GROUP_GAP_MS
      : false;

    if (prevGroup && prevPost && sameAuthor && sameDay && withinGap) {
      prevGroup.posts.push(post);
      continue;
    }

    groups.push({
      key: post.id,
      dateLabel: sameDay ? null : formatDaySeparator(post.created_at),
      profileId: post.profile_id,
      authorDisplayName: post.author_display_name,
      timestamp: post.created_at,
      posts: [post],
    });
  }

  return groups;
}

export default async function CommunityDetail({
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

  const { data: community } = await supabase
    .from("communities")
    .select("id, name, emoji")
    .eq("id", id)
    .maybeSingle();

  if (!community) {
    notFound();
  }

  const [{ data: membership }, { data: memberCountData }, { data: posts, error: postsError }] =
    await Promise.all([
      supabase
        .from("community_memberships")
        .select("community_id")
        .eq("community_id", id)
        .maybeSingle(),
      supabase.rpc("community_member_count", { p_community_id: id }),
      supabase
        .from("posts")
        .select("id, profile_id, author_display_name, body, created_at")
        .eq("community_id", id)
        .order("created_at", { ascending: false })
        .limit(50),
    ]);

  const isMember = Boolean(membership);
  const memberCount = Number(memberCountData ?? 0);

  // Same query/limit as before this batch (the most recent 50 posts --
  // cursor pagination is explicitly out of scope here), just displayed
  // oldest-first so the conversation reads top-to-bottom like a chat
  // thread, with the newest message sitting just above the composer.
  const orderedPosts = [...(posts ?? [])].reverse();

  const postIds = orderedPosts.map((post) => post.id);

  const postMediaByPostId = await fetchPostMediaByPostId(supabase, postIds);

  const [{ data: myLikes }, likeCountResults, { data: comments, error: commentsError }] =
    await Promise.all([
      supabase.from("post_likes").select("post_id"),
      Promise.all(
        postIds.map((postId) => supabase.rpc("post_like_count", { p_post_id: postId })),
      ),
      postIds.length > 0
        ? supabase
            .from("post_comments")
            .select("id, post_id, profile_id, author_display_name, body, created_at")
            .in("post_id", postIds)
            .order("created_at", { ascending: true })
        : Promise.resolve({ data: [] as PostCommentRow[], error: null }),
    ]);

  const likedPostIds = new Set((myLikes ?? []).map((like) => like.post_id));
  const likeCountByPostId = new Map(
    postIds.map((postId, index) => [postId, Number(likeCountResults[index]?.data ?? 0)]),
  );

  const commentsByPostId = new Map<string, PostCommentRow[]>();
  for (const comment of comments ?? []) {
    const existing = commentsByPostId.get(comment.post_id) ?? [];
    existing.push(comment);
    commentsByPostId.set(comment.post_id, existing);
  }

  const commentIds = (comments ?? []).map((comment) => comment.id);

  const [{ data: myCommentReactions }, reactionCountResults] = await Promise.all([
    supabase.from("comment_reactions").select("comment_id, reaction_type"),
    Promise.all(
      commentIds.map((commentId) =>
        supabase.rpc("comment_reaction_counts", { p_comment_id: commentId }),
      ),
    ),
  ]);

  const myReactionTypesByCommentId = new Map<string, string[]>();
  for (const reaction of myCommentReactions ?? []) {
    const existing = myReactionTypesByCommentId.get(reaction.comment_id) ?? [];
    existing.push(reaction.reaction_type);
    myReactionTypesByCommentId.set(reaction.comment_id, existing);
  }

  const reactionCountsByCommentId = new Map<
    string,
    { reaction_type: string; count: number }[]
  >(
    commentIds.map((commentId, index) => [
      commentId,
      (reactionCountResults[index]?.data ?? []).map((row: { reaction_type: string; count: number }) => ({
        reaction_type: row.reaction_type,
        count: Number(row.count),
      })),
    ]),
  );

  const commentsFailed = Boolean(commentsError);

  const messageGroups = groupMessages(orderedPosts);

  // Changes whenever the newest post changes (first load, and again
  // right after this viewer sends one) -- see CommunityConversation.tsx,
  // which re-scrolls to the bottom whenever this key changes.
  const scrollKey = `${orderedPosts.length}:${orderedPosts.at(-1)?.id ?? "empty"}`;

  const composer = <PostComposer communityId={community.id} isMember={isMember} />;

  return (
    <div className="flex min-h-[100dvh] flex-col bg-shamba-bg">
      {/* Restored per Batch 1 QA corrections: this page must keep the
          normal app-wide navigation (Communities/Feed/Marketplace/Market
          Prices/Education/Alerts/Profile/Sign out) reachable directly from
          inside a community, not only via the back arrow below. AppHeader
          is reused completely unmodified -- no parallel nav is built here. */}
      <AppHeader />

      <header className="sticky top-0 z-10 w-full border-b border-shamba-line bg-shamba-card">
        <div className="mx-auto flex w-full max-w-sm items-center gap-3 px-4 py-3">
          <Link
            href="/communities"
            aria-label="Back to Communities"
            className="flex size-9 shrink-0 items-center justify-center rounded-full text-shamba-ink-soft transition-colors hover:bg-shamba-bg hover:text-shamba-ink"
          >
            <ArrowLeft className="size-5" aria-hidden="true" />
          </Link>
          <span className="text-2xl" aria-hidden="true">
            {community.emoji ?? "🌾"}
          </span>
          <h1 className="min-w-0 flex-1 truncate font-display text-lg font-bold leading-tight text-shamba-ink">
            {community.name}
          </h1>
        </div>
        <div className="mx-auto w-full max-w-sm px-4 pb-3">
          <MembershipControl
            compact
            communityId={community.id}
            initialIsMember={isMember}
            initialMemberCount={memberCount}
          />
        </div>
      </header>

      <CommunityConversation composer={composer} scrollKey={scrollKey}>
        {postsError && (
          <p role="alert" className="text-sm font-semibold text-shamba-rust">
            We couldn&apos;t load this conversation right now. Please try again later.
          </p>
        )}

        {!postsError && orderedPosts.length === 0 && (
          <p className="text-sm text-shamba-ink-soft">
            No messages yet. Be the first to say something in this community.
          </p>
        )}

        {!postsError && orderedPosts.length > 0 && (
          <div className="flex flex-col gap-5">
            {messageGroups.map((group) => (
              <div key={group.key}>
                {group.dateLabel && (
                  <div className="mb-5 flex items-center gap-3">
                    <div className="h-px flex-1 bg-shamba-line" aria-hidden="true" />
                    <span className="shrink-0 font-mono text-xs font-semibold tracking-wide text-shamba-ink-soft">
                      {group.dateLabel}
                    </span>
                    <div className="h-px flex-1 bg-shamba-line" aria-hidden="true" />
                  </div>
                )}

                <div className="flex items-start gap-2.5">
                  <span
                    className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full border border-shamba-line bg-shamba-card text-shamba-ink-soft"
                    aria-hidden="true"
                  >
                    <UserRound className="size-4" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline gap-2">
                      <ProfileLink
                        profileId={group.profileId}
                        displayName={group.authorDisplayName}
                        className="min-w-0 truncate font-sans text-sm font-semibold text-shamba-ink"
                      />
                      <span className="shrink-0 font-mono text-xs text-shamba-ink-soft">
                        {formatMessageTime(group.timestamp)}
                      </span>
                    </div>

                    <div className="mt-1 flex flex-col gap-1.5">
                      {group.posts.map((post) => (
                        <div key={post.id}>
                          <p className="whitespace-pre-wrap text-base leading-6 text-shamba-ink">
                            {post.body}
                          </p>
                          <PostMedia items={postMediaByPostId.get(post.id) ?? []} />
                          <PostDeleteControl
                            postId={post.id}
                            isAuthor={post.profile_id === user.id}
                          />

                          <div className="flex flex-wrap items-start gap-4">
                            <PostLikeControl
                              postId={post.id}
                              isMember={isMember}
                              initialLiked={likedPostIds.has(post.id)}
                              initialLikeCount={likeCountByPostId.get(post.id) ?? 0}
                            />
                            <PostCommentsSection
                              postId={post.id}
                              isMember={isMember}
                              commentsFailed={commentsFailed}
                              comments={(commentsByPostId.get(post.id) ?? []).map((comment) => ({
                                id: comment.id,
                                profileId: comment.profile_id,
                                authorDisplayName: comment.author_display_name,
                                body: comment.body,
                                isAuthor: comment.profile_id === user.id,
                                myReactionTypes: myReactionTypesByCommentId.get(comment.id) ?? [],
                                reactionCounts: reactionCountsByCommentId.get(comment.id) ?? [],
                              }))}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CommunityConversation>
    </div>
  );
}
