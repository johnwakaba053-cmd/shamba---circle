import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPostMediaByPostId } from "@/lib/postMedia";
import { fetchPostHashtagsByPostId } from "./hashtags";
import { fetchPostMentionsByPostId } from "./mentions";
import type { Reel, ReelComment } from "./types";

// One page of the Farming Reels feed, assembled server-side. Moved out
// of page.tsx unchanged so the page's first render and loadMoreReels()
// (actions.ts, in-place loading as the farmer swipes) share exactly the
// same queries, pagination rules and privacy boundaries -- there is one
// definition of "what a Reel is", not two.

// Bounded page size for the feed's own keyset pagination — deliberately
// smaller than a single community's 50-post cap, since this aggregates
// across every community the user has joined.
export const FEED_PAGE_SIZE = 20;

export type FeedCommunity = { id: string; name: string; group_name: string };

export type FeedPage = {
  reels: Reel[];
  nextCursor: string | null;
  hasError: boolean;
  allCommunities: FeedCommunity[];
  joinedCommunityIdSet: Set<string>;
  // When this page's signed media links were created (stamped just before
  // signing, so never newer than the links) -- see feed/RefreshStaleMedia.
  mediaIssuedAt: number;
};

type PostCommentRow = {
  id: string;
  post_id: string;
  profile_id: string;
  author_display_name: string;
  body: string;
  created_at: string;
};

export async function fetchFeedPage(
  supabase: SupabaseClient,
  userId: string,
  before: string | null,
): Promise<FeedPage> {
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
    .limit(FEED_PAGE_SIZE + 1);

  if (before) {
    postsQuery = postsQuery.lt("created_at", before);
  }

  const { data: postsRaw, error: postsError } = await postsQuery;

  const hasMore = (postsRaw?.length ?? 0) > FEED_PAGE_SIZE;
  const posts = (postsRaw ?? []).slice(0, FEED_PAGE_SIZE);
  const nextCursor = hasMore ? posts[posts.length - 1]?.created_at : null;

  const mediaIssuedAt = Date.now();
  const reels = await assembleReels(supabase, userId, posts, communityNameById);
  const hasError = Boolean(membershipsError || postsError);

  return {
    reels,
    nextCursor: nextCursor ?? null,
    hasError,
    allCommunities: allCommunities ?? [],
    joinedCommunityIdSet,
    mediaIssuedAt,
  };
}

// The post columns every Reel is built from.
const REEL_POST_COLUMNS = "id, community_id, profile_id, author_display_name, body, topic, created_at";

type ReelPostRow = {
  id: string;
  community_id: string | null;
  profile_id: string;
  author_display_name: string;
  body: string;
  topic: string | null;
  created_at: string;
};

export type ReelLookup =
  | { status: "ok"; reel: Reel; mediaIssuedAt: number }
  | { status: "not_found" }
  | { status: "members_only"; communityId: string; communityName: string }
  | { status: "error" };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// One Reel by its canonical id (posts.id), for /reels/[reelId]. Same
// visibility rule as the Feed: a Feed-level post (community_id IS NULL)
// is open to every signed-in farmer; a community post only to that
// community's members -- the same boundary post_media/Storage RLS
// already enforces, so a non-member couldn't load its media anyway.
// For a non-member the caller gets "members_only" (with the community to
// join) instead of a half-broken Reel. A malformed or unknown id is
// "not_found", never an error. The Reel itself is assembled by the exact
// same assembleReels() the Feed uses.
export async function fetchReelById(
  supabase: SupabaseClient,
  userId: string,
  reelId: string,
): Promise<ReelLookup> {
  if (!UUID_PATTERN.test(reelId)) {
    return { status: "not_found" };
  }

  const { data: post, error: postError } = await supabase
    .from("posts")
    .select(REEL_POST_COLUMNS)
    .eq("id", reelId)
    .maybeSingle<ReelPostRow>();

  if (postError) {
    return { status: "error" };
  }
  if (!post) {
    return { status: "not_found" };
  }

  const communityNameById = new Map<string, string>();

  if (post.community_id) {
    const [{ data: community }, { data: membership, error: membershipError }] = await Promise.all([
      supabase.from("communities").select("id, name").eq("id", post.community_id).maybeSingle(),
      // RLS scopes community_memberships to the caller's own rows.
      supabase
        .from("community_memberships")
        .select("community_id")
        .eq("community_id", post.community_id)
        .eq("profile_id", userId)
        .maybeSingle(),
    ]);

    if (membershipError) {
      return { status: "error" };
    }

    const communityName = community?.name ?? post.community_id;
    communityNameById.set(post.community_id, communityName);

    if (!membership) {
      return { status: "members_only", communityId: post.community_id, communityName };
    }
  }

  const mediaIssuedAt = Date.now();
  const [reel] = await assembleReels(supabase, userId, [post], communityNameById);
  return reel ? { status: "ok", reel, mediaIssuedAt } : { status: "not_found" };
}

// Turns post rows into Reels: media (signed URLs), hashtags, mentions,
// the caller's likes + like counts, comments with reaction counts and the
// caller's own reactions, and follow state. Shared by fetchFeedPage() and
// fetchReelById() so a Reel is built the same way everywhere.
async function assembleReels(
  supabase: SupabaseClient,
  userId: string,
  posts: ReelPostRow[],
  communityNameById: Map<string, string>,
): Promise<Reel[]> {
  const postIds = posts.map((post) => post.id);
  const authorIds = Array.from(new Set(posts.map((post) => post.profile_id)));

  const postMediaByPostId = await fetchPostMediaByPostId(supabase, postIds);
  const postHashtagsByPostId = await fetchPostHashtagsByPostId(supabase, postIds);
  const postMentionsByPostId = await fetchPostMentionsByPostId(supabase, postIds);

  // Engagement totals are batched: one post_like_counts() call for every
  // Reel on the page and one comment_reaction_counts_for_comments() call
  // for every comment (instead of one RPC per Reel / per comment). Both
  // are SECURITY DEFINER aggregates -- the likes/reactions tables only let
  // a farmer read their OWN rows -- and a Reel or comment with none simply
  // has no row, i.e. 0. The caller's own likes/reactions are read under
  // normal RLS, limited to the Reels/comments on this page.
  const [
    { data: myLikes },
    { data: likeCountRows },
    { data: comments, error: commentsError },
    { data: myFollowRows },
  ] = await Promise.all([
    postIds.length > 0
      ? supabase.from("post_likes").select("post_id").in("post_id", postIds)
      : Promise.resolve({ data: [] as { post_id: string }[] }),
    postIds.length > 0
      ? supabase.rpc("post_like_counts", { p_post_ids: postIds })
      : Promise.resolve({ data: [] as { post_id: string; like_count: number }[] }),
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
  const likeCountByPostId = new Map<string, number>(
    ((likeCountRows ?? []) as { post_id: string; like_count: number | string }[]).map((row) => [
      row.post_id,
      Number(row.like_count),
    ]),
  );
  const followingProfileIds = new Set((myFollowRows ?? []).map((row) => row.followed_profile_id));

  const commentsByPostId = new Map<string, PostCommentRow[]>();
  for (const comment of comments ?? []) {
    const existing = commentsByPostId.get(comment.post_id) ?? [];
    existing.push(comment);
    commentsByPostId.set(comment.post_id, existing);
  }

  const commentIds = (comments ?? []).map((comment) => comment.id);

  const [{ data: myCommentReactions }, { data: reactionCountRows }] = await Promise.all([
    commentIds.length > 0
      ? supabase
          .from("comment_reactions")
          .select("comment_id, reaction_type")
          .in("comment_id", commentIds)
      : Promise.resolve({ data: [] as { comment_id: string; reaction_type: string }[] }),
    commentIds.length > 0
      ? supabase.rpc("comment_reaction_counts_for_comments", { p_comment_ids: commentIds })
      : Promise.resolve({
          data: [] as { comment_id: string; reaction_type: string; reaction_count: number }[],
        }),
  ]);

  const myReactionTypesByCommentId = new Map<string, string[]>();
  for (const reaction of myCommentReactions ?? []) {
    const existing = myReactionTypesByCommentId.get(reaction.comment_id) ?? [];
    existing.push(reaction.reaction_type);
    myReactionTypesByCommentId.set(reaction.comment_id, existing);
  }

  // Same { reaction_type, count }[] shape per comment as before, grouped
  // from the one batched result; a comment with no reactions gets [].
  const reactionCountsByCommentId = new Map<string, { reaction_type: string; count: number }[]>();
  for (const row of (reactionCountRows ?? []) as {
    comment_id: string;
    reaction_type: string;
    reaction_count: number | string;
  }[]) {
    const existing = reactionCountsByCommentId.get(row.comment_id) ?? [];
    existing.push({ reaction_type: row.reaction_type, count: Number(row.reaction_count) });
    reactionCountsByCommentId.set(row.comment_id, existing);
  }

  // A comments-fetch failure degrades to an in-sheet error message per
  // Reel (see Reel.commentsFailed / ReelCommentsSheet) rather than
  // failing the whole page -- same resilience the old card feed had,
  // where a comments error only affected the per-post comment section,
  // never the posts/media/likes above it.
  const commentsFailed = Boolean(commentsError);

  return posts.map((post) => {
    const reelComments: ReelComment[] = (commentsByPostId.get(post.id) ?? []).map((comment) => ({
      id: comment.id,
      postId: comment.post_id,
      profileId: comment.profile_id,
      authorDisplayName: comment.author_display_name,
      body: comment.body,
      isAuthor: comment.profile_id === userId,
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
      isAuthor: post.profile_id === userId,
      liked: likedPostIds.has(post.id),
      likeCount: likeCountByPostId.get(post.id) ?? 0,
      comments: reelComments,
      commentsFailed,
      showFollow: post.profile_id !== userId,
      isFollowing: followingProfileIds.has(post.profile_id),
    };
  });
}
