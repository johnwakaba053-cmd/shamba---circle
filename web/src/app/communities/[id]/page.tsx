import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, HelpCircle, PawPrint, Wheat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { MembershipControl } from "./MembershipControl";
import { PostComposer } from "./PostComposer";
import { PostLikeControl } from "./PostLikeControl";
import { PostCommentComposer } from "./PostCommentComposer";
import { PostCommentItem } from "./PostCommentItem";
import { PostDeleteControl } from "./PostDeleteControl";
import { PostCommentReactions } from "./PostCommentReactions";
import { PostMedia } from "./PostMedia";
import { fetchPostMediaByPostId } from "@/lib/postMedia";

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
    .select("id, name, group_name")
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
  const Icon = GROUP_ICON[community.group_name] ?? HelpCircle;

  const postIds = (posts ?? []).map((post) => post.id);

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

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        <div className="w-full max-w-sm rounded-shamba border border-shamba-line bg-shamba-card p-6 sm:p-8">
          <Icon className="size-7 text-shamba-green" aria-hidden="true" />

          <h1 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink">
            {community.name}
          </h1>
          <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
            {community.group_name}
          </p>

          <MembershipControl
            communityId={community.id}
            initialIsMember={isMember}
            initialMemberCount={memberCount}
          />
        </div>

        <section className="mt-10 w-full max-w-sm">
          <h2 className="font-display text-lg font-semibold text-shamba-ink">
            Posts
          </h2>

          <PostComposer communityId={community.id} isMember={isMember} />

          {postsError && (
            <p role="alert" className="mt-4 text-sm font-semibold text-shamba-rust">
              We couldn&apos;t load posts right now. Please try again later.
            </p>
          )}

          {!postsError && (posts?.length ?? 0) === 0 && (
            <p className="mt-4 text-sm text-shamba-ink-soft">
              No posts yet. Be the first to share something with this community.
            </p>
          )}

          {!postsError && posts && posts.length > 0 && (
            <div className="mt-4 flex flex-col gap-3">
              {posts.map((post) => (
                <article
                  key={post.id}
                  className="rounded-shamba border border-shamba-line bg-shamba-card p-4"
                >
                  <div className="flex items-baseline justify-between gap-2">
                    <p className="font-sans text-sm font-semibold text-shamba-ink">
                      {post.author_display_name}
                    </p>
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
            </div>
          )}
        </section>

        <Link
          href="/communities"
          className="mt-6 inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to Communities
        </Link>
      </main>
    </div>
  );
}
