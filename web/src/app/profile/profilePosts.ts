import type { SupabaseClient } from "@supabase/supabase-js";
import { fetchPostMediaByPostId } from "@/lib/postMedia";
import { fetchPostHashtagsByPostId } from "@/app/feed/hashtags";
import { fetchPostMentionsByPostId } from "@/app/feed/mentions";
import type { Reel, ReelComment } from "@/app/feed/types";

// Bounded at the application layer, not the database: get_profile_posts()
// has no limit/offset parameter, and adding one would require a
// migration, which this phase was explicitly told to avoid unless
// absolutely required. This is the "retrieve then slice" approach
// sanctioned for v1 -- acceptable at this product's current scale, and
// safe to revisit with a real paginated RPC later.
const PROFILE_POST_LIMIT = 30;

type ProfilePostRow = {
  id: string;
  community_id: string | null;
  profile_id: string;
  author_display_name: string;
  body: string;
  topic: string | null;
  created_at: string;
};

type PostCommentRow = {
  id: string;
  post_id: string;
  profile_id: string;
  author_display_name: string;
  body: string;
  created_at: string;
};

// Assembles one profile's own posts into the exact same Reel[] shape
// feed/page.tsx already builds -- same building blocks, scoped to a
// single author instead of every joined community -- so
// ProfilePostGrid/ProfilePostViewer can reuse ReelFeed/ReelSlide/
// ReelMedia/ReelInfo/ReelInteractionRail/ReelCommentsSheet completely
// unmodified.
//
// get_profile_posts() (SECURITY DEFINER) is the only sanctioned path
// here -- it already returns zero rows for a viewer can_view_profile_posts()
// would reject. Never replace this with `.from("posts").eq("profile_id", ...)`
// directly: posts' own SELECT RLS is `using (true)`, open to any
// authenticated user, and would silently bypass profile privacy entirely.
export async function fetchProfileReels(
  supabase: SupabaseClient,
  profileId: string,
  viewerId: string,
): Promise<Reel[]> {
  const { data: postsRaw } = await supabase.rpc("get_profile_posts", {
    p_profile_id: profileId,
  });

  const posts = ((postsRaw ?? []) as ProfilePostRow[]).slice(0, PROFILE_POST_LIMIT);

  if (posts.length === 0) {
    return [];
  }

  const postIds = posts.map((post) => post.id);
  const communityIds = Array.from(
    new Set(
      posts
        .map((post) => post.community_id)
        .filter((id): id is string => id !== null),
    ),
  );

  const [
    postMediaByPostId,
    postHashtagsByPostId,
    postMentionsByPostId,
    { data: communities },
    { data: myLikes },
    likeCountResults,
    { data: comments, error: commentsError },
    { data: myFollowRow },
  ] = await Promise.all([
    fetchPostMediaByPostId(supabase, postIds),
    fetchPostHashtagsByPostId(supabase, postIds),
    fetchPostMentionsByPostId(supabase, postIds),
    communityIds.length > 0
      ? supabase.from("communities").select("id, name").in("id", communityIds)
      : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    supabase.from("post_likes").select("post_id").in("post_id", postIds),
    Promise.all(
      postIds.map((postId) => supabase.rpc("post_like_count", { p_post_id: postId })),
    ),
    supabase
      .from("post_comments")
      .select("id, post_id, profile_id, author_display_name, body, created_at")
      .in("post_id", postIds)
      .order("created_at", { ascending: true }),
    // Only meaningful for someone else's profile -- viewing your own
    // posts never needs your own follow status toward yourself, and
    // `follows` structurally forbids a self-follow row anyway.
    profileId === viewerId
      ? Promise.resolve({ data: null as { followed_profile_id: string } | null })
      : supabase
          .from("follows")
          .select("followed_profile_id")
          .eq("follower_profile_id", viewerId)
          .eq("followed_profile_id", profileId)
          .maybeSingle(),
  ]);

  const communityNameById = new Map((communities ?? []).map((c) => [c.id, c.name]));
  const likedPostIds = new Set((myLikes ?? []).map((like) => like.post_id));
  const likeCountByPostId = new Map(
    postIds.map((postId, index) => [postId, Number(likeCountResults[index]?.data ?? 0)]),
  );
  const isFollowingAuthor = Boolean(myFollowRow);

  const commentsByPostId = new Map<string, PostCommentRow[]>();
  for (const comment of (comments ?? []) as PostCommentRow[]) {
    const existing = commentsByPostId.get(comment.post_id) ?? [];
    existing.push(comment);
    commentsByPostId.set(comment.post_id, existing);
  }

  const commentIds = (comments ?? []).map((comment) => comment.id);

  const [{ data: myCommentReactions }, reactionCountResults] = await Promise.all([
    commentIds.length > 0
      ? supabase
          .from("comment_reactions")
          .select("comment_id, reaction_type")
          .in("comment_id", commentIds)
      : Promise.resolve({ data: [] as { comment_id: string; reaction_type: string }[] }),
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

  const commentsFailed = Boolean(commentsError);

  return posts.map((post) => {
    const reelComments: ReelComment[] = (commentsByPostId.get(post.id) ?? []).map((comment) => ({
      id: comment.id,
      postId: comment.post_id,
      profileId: comment.profile_id,
      authorDisplayName: comment.author_display_name,
      body: comment.body,
      isAuthor: comment.profile_id === viewerId,
      myReactionTypes: myReactionTypesByCommentId.get(comment.id) ?? [],
      reactionCounts: reactionCountsByCommentId.get(comment.id) ?? [],
    }));

    return {
      id: post.id,
      communityId: post.community_id,
      communityName: post.community_id
        ? communityNameById.get(post.community_id) ?? null
        : null,
      profileId: post.profile_id,
      authorDisplayName: post.author_display_name,
      body: post.body,
      topic: post.topic,
      hashtags: postHashtagsByPostId.get(post.id) ?? [],
      mentions: postMentionsByPostId.get(post.id) ?? [],
      createdAt: post.created_at,
      media: postMediaByPostId.get(post.id) ?? [],
      isAuthor: post.profile_id === viewerId,
      liked: likedPostIds.has(post.id),
      likeCount: likeCountByPostId.get(post.id) ?? 0,
      comments: reelComments,
      commentsFailed,
      showFollow: post.profile_id !== viewerId,
      isFollowing: isFollowingAuthor,
    };
  });
}
