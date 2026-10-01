"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Trash2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const POST_MEDIA_BUCKET = "post-media";

// Light-on-dark fork of communities/[id]/PostDeleteControl.tsx -- same
// delete call (own-row, RLS-enforced), restyled to stay readable over
// media instead of the card list's plain-ink text link. Only rendered
// for the Reel's own author (see Reel.isAuthor in feed/page.tsx), same
// as the original.
//
// Deleting a Reel also removes its photo/video files from Storage (they
// used to be left behind). Order, all under the existing RLS/Storage
// policies -- nothing here can touch another farmer's data:
//   1. Collect the Reel's file paths: its post_media rows plus a listing
//      of its "<postId>/" folder (the files that actually exist,
//      including any stray upload).
//   2. Remove the files WHILE THE POST STILL EXISTS. Storage's delete
//      policy only allows the file's OWNER (another user's media can
//      never be removed), and because Storage deletes with RETURNING,
//      Postgres also applies the bucket's SELECT policy -- which requires
//      the post to exist. Removing after the post is gone silently
//      matches nothing (200, empty result), so the files would stay.
//      The result is checked against the files that exist: if any wasn't
//      removed, stop here -- the Reel is left in place and the farmer is
//      told, never a silent partial delete.
//   3. Delete the post (own-row RLS); post_media rows cascade. It must
//      delete exactly one row. If this step fails, the farmer is told and
//      can tap Delete again (the retry simply deletes the now media-less
//      post).
export function ReelDeleteControl({ postId }: { postId: string }) {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    if (isLoading) return;

    if (!window.confirm("Delete this Reel? This cannot be undone.")) {
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setError("Please sign in again.");
        setIsLoading(false);
        return;
      }

      // 1. The Reel's files.
      const [{ data: mediaRows, error: mediaError }, { data: folderFiles, error: listError }] =
        await Promise.all([
          supabase.from("post_media").select("storage_path").eq("post_id", postId),
          supabase.storage.from(POST_MEDIA_BUCKET).list(postId),
        ]);

      if (mediaError || listError) {
        setError("We couldn't delete that Reel. Please try again.");
        setIsLoading(false);
        return;
      }

      const existingPaths = (folderFiles ?? []).map((file) => `${postId}/${file.name}`);
      const mediaPaths = Array.from(
        new Set([...(mediaRows ?? []).map((row) => row.storage_path as string), ...existingPaths]),
      );

      // 2. Its files, while the post (and so the bucket's read access)
      // still exists -- and verify every existing file really went.
      if (mediaPaths.length > 0) {
        const { data: removed, error: removeError } = await supabase.storage
          .from(POST_MEDIA_BUCKET)
          .remove(mediaPaths);

        const removedPaths = new Set((removed ?? []).map((object) => object.name));
        const notRemoved = existingPaths.filter((path) => !removedPaths.has(path));

        if (removeError || notRemoved.length > 0) {
          setError("We couldn't delete that Reel's photos or videos. Please try again.");
          setIsLoading(false);
          return;
        }
      }

      // 3. The post itself -- exactly one own row.
      const { data: deletedRows, error: deleteError } = await supabase
        .from("posts")
        .delete()
        .eq("id", postId)
        .eq("profile_id", user.id)
        .select("id");

      if (deleteError || !deletedRows || deletedRows.length !== 1) {
        setError("We couldn't delete that Reel. Please try again.");
        setIsLoading(false);
        router.refresh();
        return;
      }

      router.refresh();
    } catch {
      setError("Something went wrong. Please try again in a moment.");
      setIsLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={handleDelete}
        disabled={isLoading}
        className="inline-flex items-center gap-1.5 font-sans text-xs font-semibold text-shamba-card/80 drop-shadow transition-colors hover:text-shamba-card disabled:cursor-not-allowed disabled:opacity-70 relative touch-target"
      >
        {isLoading ? (
          <Loader2 className="size-3.5 animate-spin" aria-hidden="true" />
        ) : (
          <Trash2 className="size-3.5" aria-hidden="true" />
        )}
        {isLoading ? "Deleting…" : "Delete Reel"}
      </button>

      {error && (
        <p role="alert" className="text-xs font-semibold text-shamba-rust">
          {error}
        </p>
      )}
    </div>
  );
}
