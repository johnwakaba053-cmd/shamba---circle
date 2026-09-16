import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowRight, HelpCircle, PawPrint, Wheat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { ProfileLink } from "@/components/ProfileLink";
import { PostDeleteControl } from "../communities/[id]/PostDeleteControl";
import { PostLikeControl } from "../communities/[id]/PostLikeControl";
import { PostCommentComposer } from "../communities/[id]/PostCommentComposer";
import { PostCommentItem } from "../communities/[id]/PostCommentItem";
import { PostCommentReactions } from "../communities/[id]/PostCommentReactions";
import { PostMedia } from "../communities/[id]/PostMedia";
import { fetchPostMediaByPostId } from "@/lib/postMedia";

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

type FeedPostRow = {
  id: string;
  community_id: string;
  profile_id: string;
  author_display_name: string;
  body: string;
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

  let postsQuery = supabase
    .from("posts")
    .select("id, community_id, profile_id, author_display_name, body, created_at")
    .in("community_id", joinedCommunityIds)
    .order("created_at", { ascending: false })
    .limit(PAGE_SIZE + 1);

  if (before) {
    postsQuery = postsQuery.lt("created_at", before);
  }

  const { data: postsRaw, error: postsError } =
    joinedCommunityIds.length > 0
      ? await postsQuery
      : { data: [] as FeedPostRow[], error: null };

  const hasMore = (postsRaw?.length ?? 0) > PAGE_SIZE;
  const posts = (postsRaw ?? []).slice(0, PAGE_SIZE);
  const nextCursor = hasMore ? posts[posts.length - 1]?.created_at : null;

  const postIds = posts.map((post) => post.id);

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
      (reactionCountResults[index]?.data ?? []).map(
        (row: { reaction_type: string; count: number }) => ({
          reaction_type: row.reaction_type,
          count: Number(row.count),
        }),
      ),
    ]),
  );

  const hasError = Boolean(membershipsError || postsError);
  const isMember = true; // every post in this feed is, by construction, from a joined community

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        <div className="w-full max-w-sm">
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-shamba-ink">
            Your feed
          </h1>
          <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
            Recent posts from the communities you belong to.
          </p>
        </div>

        {hasError && (
          <p
            role="alert"
            className="mt-6 w-full max-w-sm text-sm font-semibold text-shamba-rust"
          >
            We couldn&apos;t load your feed right now. Please try again later.
          </p>
        )}

        {!hasError && joinedCommunityIds.length === 0 && (
          <div className="mt-6 w-full max-w-sm rounded-shamba border border-shamba-line bg-shamba-card p-6">
            <p className="text-base leading-6 text-shamba-ink-soft">
              You haven&apos;t joined any communities yet. Join one to start seeing
              posts here.
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
        )}

        {!hasError && joinedCommunityIds.length > 0 && posts.length === 0 && (
          <p className="mt-6 w-full max-w-sm text-sm text-shamba-ink-soft">
            No posts yet from your communities. Check back soon.
          </p>
        )}

        {!hasError && posts.length > 0 && (
          <div className="mt-6 flex w-full max-w-sm flex-col gap-3">
            {posts.map((post) => (
              <article
                key={post.id}
                className="rounded-shamba border border-shamba-line bg-shamba-card p-4"
              >
                <Link
                  href={`/communities/${post.community_id}`}
                  className="inline-flex font-mono text-xs font-semibold text-shamba-green transition-colors hover:text-shamba-green-deep"
                >
                  {communityNameById.get(post.community_id) ?? post.community_id}
                </Link>

                <div className="mt-1 flex items-baseline justify-between gap-2">
                  <ProfileLink
                    profileId={post.profile_id}
                    displayName={post.author_display_name}
                    className="font-sans text-sm font-semibold text-shamba-ink"
                  />
                  <p className="shrink-0 font-mono text-xs text-shamba-ink-soft">
                    {new Date(post.created_at).toLocaleDateString()}
                  </p>
                </div>
                <p className="mt-1 whitespace-pre-wrap text-base leading-6 text-shamba-ink-soft">
                  {post.body}
                </p>
                <PostMedia items={postMediaByPostId.get(post.id) ?? []} />

                <PostDeleteControl postId={post.id} isAuthor={post.profile_id === user.id} />
                <PostLikeControl
                  postId={post.id}
                  isMember={isMember}
                  initialLiked={likedPostIds.has(post.id)}
                  initialLikeCount={likeCountByPostId.get(post.id) ?? 0}
                />

                <div className="mt-3 flex flex-col gap-2 border-t border-shamba-line pt-3">
                  {commentsError && (
                    <p role="alert" className="text-xs font-semibold text-shamba-rust">
                      We couldn&apos;t load comments right now.
                    </p>
                  )}

                  {!commentsError && (commentsByPostId.get(post.id)?.length ?? 0) === 0 && (
                    <p className="text-xs text-shamba-ink-soft">No comments yet.</p>
                  )}

                  {!commentsError &&
                    commentsByPostId.get(post.id)?.map((comment) => (
                      <div key={comment.id} className="flex flex-col gap-1.5">
                        <PostCommentItem
                          commentId={comment.id}
                          authorProfileId={comment.profile_id}
                          authorDisplayName={comment.author_display_name}
                          body={comment.body}
                          isAuthor={comment.profile_id === user.id}
                        />
                        <PostCommentReactions
                          commentId={comment.id}
                          isMember={isMember}
                          initialMyReactionTypes={
                            myReactionTypesByCommentId.get(comment.id) ?? []
                          }
                          initialCounts={reactionCountsByCommentId.get(comment.id) ?? []}
                        />
                      </div>
                    ))}

                  <PostCommentComposer postId={post.id} isMember={isMember} />
                </div>
              </article>
            ))}

            {nextCursor && (
              <Link
                href={`/feed?before=${encodeURIComponent(nextCursor)}`}
                className="inline-flex items-center justify-center rounded-shamba border border-shamba-line px-6 py-3 font-sans text-base font-semibold text-shamba-ink transition-colors hover:bg-shamba-card"
              >
                Load more
              </Link>
            )}
          </div>
        )}

        {!hasError && joinedCommunityIds.length > 0 && suggestedCommunities.length > 0 && (
          <section className="mt-10 w-full max-w-sm">
            <h2 className="font-display text-lg font-semibold text-shamba-ink">
              Discover more communities
            </h2>
            <p className="mt-1 text-sm text-shamba-ink-soft">
              Communities you haven&apos;t joined yet.
            </p>

            <div className="mt-3 flex flex-col gap-2">
              {suggestedCommunities.map((community) => {
                const Icon = GROUP_ICON[community.group_name] ?? HelpCircle;
                return (
                  <Link
                    key={community.id}
                    href={`/communities/${community.id}`}
                    className="flex items-center gap-3 rounded-shamba border border-shamba-line bg-shamba-card p-3 transition-colors hover:border-shamba-green"
                  >
                    <Icon className="size-5 shrink-0 text-shamba-green" aria-hidden="true" />
                    <span className="font-sans text-sm font-medium text-shamba-ink">
                      {community.name}
                    </span>
                  </Link>
                );
              })}
            </div>

            <Link
              href="/communities"
              className="mt-3 inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink"
            >
              See all communities
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </section>
        )}
      </main>
    </div>
  );
}
