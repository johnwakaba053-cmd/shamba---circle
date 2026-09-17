import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Link from "next/link";
import { HelpCircle, PawPrint, Sprout, Wheat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { fetchPostMediaByPostId } from "@/lib/postMedia";
import { FeedComposerLauncher } from "./FeedComposerLauncher";
import { FeedHeaderBar, FeedHeaderVisibilityProvider } from "./FeedHeaderVisibility";
import { fetchPostHashtagsByPostId } from "./hashtags";
import { fetchPostMentionsByPostId } from "./mentions";
import { ReelFeed } from "./ReelFeed";
import { fetchActiveStories } from "./stories";
import { StoriesRow } from "./StoriesRow";
import type { Reel, ReelComment } from "./types";

export const metadata: Metadata = {
  title: "Farming Reels · Shamba Circle",
};

// Bounded page size for the feed's own keyset pagination — deliberately
// smaller than a single community's 50-post cap, since this aggregates
// across every community the user has joined.
const PAGE_SIZE = 20;

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

type PostCommentRow = {
  id: string;
  post_id: string;
  profile_id: string;
  author_display_name: string;
  body: string;
  created_at: string;
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

  // The RLS-scoped list of the caller's own memberships (profile_id =
  // auth.uid()) is the entire security boundary for this feed: posts
  // themselves are openly readable by any authenticated user (same as
  // browsing a single community), so "only joined communities" is
  // enforced here by filtering on this server-trusted list, not by a new
  // RLS policy.
  const { data: memberships, error: membershipsError } = await supabase
    .from("community_memberships")
    .select("community_id");

  const joinedCommunityIds = (memberships ?? []).map((m) => m.community_id);
  const joinedCommunityIdSet = new Set(joinedCommunityIds);

  // Communities are small (26 rows) and openly readable to any
  // authenticated user, same as the main directory — fetching the full
  // table here serves both the per-post community label and the
  // discovery section below from a single query.
  const { data: allCommunities } = await supabase
    .from("communities")
    .select("id, name, group_name")
    .order("name");

  const communityNameById = new Map((allCommunities ?? []).map((c) => [c.id, c.name]));

  const suggestedCommunities = (allCommunities ?? [])
    .filter((c) => !joinedCommunityIdSet.has(c.id))
    .slice(0, SUGGESTED_COMMUNITY_COUNT);

  // Feed-level posts (community_id IS NULL) are visible to every
  // authenticated farmer regardless of community membership -- they
  // aren't scoped to any community at all. Community posts still only
  // show up here if the caller has joined that specific community.
  // PostgREST's .in() alone never matches NULL rows (standard SQL
  // semantics), so the NULL case is added explicitly via .or().
  const communityFilter =
    joinedCommunityIds.length > 0
      ? `community_id.is.null,community_id.in.(${joinedCommunityIds.join(",")})`
      : "community_id.is.null";

  let postsQuery = supabase
    .from("posts")
    .select("id, community_id, profile_id, author_display_name, body, topic, created_at")
    .or(communityFilter)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (before) {
    postsQuery = postsQuery.lt("created_at", before);
  }

  const { data: postsRaw, error: postsError } = await postsQuery;

  const hasMore = (postsRaw?.length ?? 0) > PAGE_SIZE;
  const posts = (postsRaw ?? []).slice(0, PAGE_SIZE);
  const nextCursor = hasMore ? posts[posts.length - 1]?.created_at : null;

  const postIds = posts.map((post) => post.id);
  const authorIds = Array.from(new Set(posts.map((post) => post.profile_id)));

  const postMediaByPostId = await fetchPostMediaByPostId(supabase, postIds);
  const postHashtagsByPostId = await fetchPostHashtagsByPostId(supabase, postIds);
  const postMentionsByPostId = await fetchPostMentionsByPostId(supabase, postIds);

  // Independent of posts/Reels entirely -- fetched unconditionally here
  // (cheap, bounded query) and only rendered in the populated-Reels
  // branch below, per Step 71A's scope.
  const activeStories = await fetchActiveStories(supabase);

  const [
    { data: myLikes },
    likeCountResults,
    { data: comments, error: commentsError },
    { data: myFollowRows },
  ] = await Promise.all([
    supabase.from("post_likes").select("post_id"),
    Promise.all(postIds.map((postId) => supabase.rpc("post_like_count", { p_post_id: postId }))),
    postIds.length > 0
      ? supabase
          .from("post_comments")
          .select("id, post_id, profile_id, author_display_name, body, created_at")
          .in("post_id", postIds)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as PostCommentRow[], error: null }),
    authorIds.length > 0
      ? supabase.from("follows").select("followed_profile_id").in("followed_profile_id", authorIds)
      : Promise.resolve({ data: [] as { followed_profile_id: string }[] }),
  ]);

  const likedPostIds = new Set((myLikes ?? []).map((like) => like.post_id));
  const likeCountByPostId = new Map(
    postIds.map((postId, index) => [postId, Number(likeCountResults[index]?.data ?? 0)]),
  );
  const followingProfileIds = new Set((myFollowRows ?? []).map((row) => row.followed_profile_id));

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
      (reactionCountResults[index]?.data ?? []).map(
        (row: { reaction_type: string; count: number }) => ({
          reaction_type: row.reaction_type,
          count: Number(row.count),
        }),
      ),
    ]),
  );

  // A comments-fetch failure degrades to an in-sheet error message per
  // Reel (see Reel.commentsFailed / ReelCommentsSheet) rather than
  // failing the whole page -- same resilience the old card feed had,
  // where a comments error only affected the per-post comment section,
  // never the posts/media/likes above it.
  const hasError = Boolean(membershipsError || postsError);
  const commentsFailed = Boolean(commentsError);

  const reels: Reel[] = posts.map((post) => {
    const reelComments: ReelComment[] = (commentsByPostId.get(post.id) ?? []).map((comment) => ({
      id: comment.id,
      postId: comment.post_id,
      profileId: comment.profile_id,
      authorDisplayName: comment.author_display_name,
      body: comment.body,
      isAuthor: comment.profile_id === user.id,
      myReactionTypes: myReactionTypesByCommentId.get(comment.id) ?? [],
      reactionCounts: reactionCountsByCommentId.get(comment.id) ?? [],
    }));

    return {
      id: post.id,
      communityId: post.community_id,
      communityName: post.community_id
        ? communityNameById.get(post.community_id) ?? post.community_id
        : null,
      profileId: post.profile_id,
      authorDisplayName: post.author_display_name,
      body: post.body,
      topic: post.topic,
      hashtags: postHashtagsByPostId.get(post.id) ?? [],
      mentions: postMentionsByPostId.get(post.id) ?? [],
      createdAt: post.created_at,
      media: postMediaByPostId.get(post.id) ?? [],
      isAuthor: post.profile_id === user.id,
      liked: likedPostIds.has(post.id),
      likeCount: likeCountByPostId.get(post.id) ?? 0,
      comments: reelComments,
      commentsFailed,
      showFollow: post.profile_id !== user.id,
      isFollowing: followingProfileIds.has(post.profile_id),
    };
  });

  return (
    <FeedHeaderVisibilityProvider>
      <div className="relative h-[100dvh] overflow-hidden bg-shamba-bg">
        <FeedHeaderBar>
          <AppHeader />
        </FeedHeaderBar>

        {hasError && (
          <main className="absolute inset-0 mx-auto flex w-full max-w-5xl flex-col items-center overflow-y-auto px-6 pb-20 pt-28 sm:px-10 sm:pt-32">
            <p role="alert" className="mt-6 w-full max-w-sm text-sm font-semibold text-shamba-rust">
              We couldn&apos;t load your feed right now. Please try again later.
            </p>
          </main>
        )}

        {!hasError && posts.length === 0 && (
          <main className="absolute inset-0 mx-auto flex w-full max-w-5xl flex-col items-center overflow-y-auto px-6 pb-20 pt-28 sm:px-10 sm:pt-32">
            <div className="w-full max-w-sm">
              <div className="flex items-center gap-2">
                <Sprout className="size-6 text-shamba-green" aria-hidden="true" />
                <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-shamba-ink">
                  Farming Reels
                </h1>
              </div>
              <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
                Short videos and photos from farmers across Shamba Circle.
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

        {!hasError && posts.length > 0 && (
          <main className="absolute inset-0 flex flex-col overflow-hidden pt-44 sm:pt-28">
            <StoriesRow stories={activeStories} />
            <div className="relative flex-1 overflow-hidden">
              <ReelFeed reels={reels} nextCursor={nextCursor} />
            </div>
          </main>
        )}

        <FeedComposerLauncher />
      </div>
    </FeedHeaderVisibilityProvider>
  );
}
