"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { TOPICS, type Topic } from "./topics";

// Feed-level composer: creates a post with community_id = null (a
// "Feed post" / future Reel), not tied to any community, so no
// membership check applies -- any authenticated farmer can post here.
// Deliberately a self-contained copy of PostComposer.tsx's upload flow
// rather than a shared/refactored module, matching this codebase's
// established practice this session of adding a Feed-specific
// component instead of modifying a working shared one. Limits below
// intentionally mirror PostComposer.tsx's exactly -- not something this
// stage changes.
//
// Topic is optional (tapping a selected chip again clears it back to
// no topic) -- posts.topic is nullable and choosing one is never
// required to post. Community posts are untouched: PostComposer.tsx
// (communities/[id]) has no topic picker and always posts topic = null.
const MAX_BODY_LENGTH = 2000;
const MAX_MEDIA_FILES = 4;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB, matches the Storage bucket's own cap
const ACCEPTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
];

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export function FeedComposer({ onPosted }: { onPosted?: () => void } = {}) {
  const router = useRouter();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const [body, setBody] = useState("");
  const [topic, setTopic] = useState<Topic | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";
  const trimmedLength = body.trim().length;
  const remaining = MAX_BODY_LENGTH - body.length;

  const previewUrls = useMemo(
    () => selectedFiles.map((file) => URL.createObjectURL(file)),
    [selectedFiles],
  );

  useEffect(() => {
    return () => {
      previewUrls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, [previewUrls]);

  function handleFilesSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    event.target.value = "";

    if (files.length === 0) return;

    const combined = [...selectedFiles, ...files].slice(0, MAX_MEDIA_FILES);

    for (const file of combined) {
      if (!ACCEPTED_MEDIA_TYPES.includes(file.type)) {
        setMediaError(`${file.name} isn't a supported photo or video type.`);
        return;
      }
      const isVideo = file.type.startsWith("video/");
      const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
      if (file.size > limit) {
        setMediaError(
          isVideo
            ? `${file.name} is too large. Videos must be under 100MB.`
            : `${file.name} is too large. Photos must be under 8MB.`,
        );
        return;
      }
    }

    setMediaError(null);
    setSelectedFiles(combined);
  }

  function removeFile(index: number) {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    setMediaError(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) return;

    const trimmed = body.trim();
    if (trimmed.length === 0) {
      setStatus({ kind: "error", message: "Write something before posting." });
      return;
    }

    setStatus({ kind: "loading" });

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatus({ kind: "error", message: "Please sign in again." });
        return;
      }

      const { data: newPost, error: postError } = await supabase
        .from("posts")
        .insert({ community_id: null, profile_id: user.id, body: trimmed, topic })
        .select("id")
        .single();

      if (postError || !newPost) {
        setStatus({
          kind: "error",
          message: "We couldn't post that. Please try again.",
        });
        return;
      }

      if (selectedFiles.length > 0) {
        const uploadedPaths: string[] = [];
        let uploadFailed = false;

        for (const file of selectedFiles) {
          const extension = file.name.includes(".")
            ? file.name.split(".").pop()
            : file.type.split("/")[1];
          const path = `${newPost.id}/${crypto.randomUUID()}.${extension}`;

          const { error: uploadError } = await supabase.storage
            .from("post-media")
            .upload(path, file, { contentType: file.type });

          if (uploadError) {
            uploadFailed = true;
            break;
          }
          uploadedPaths.push(path);
        }

        if (uploadFailed) {
          if (uploadedPaths.length > 0) {
            await supabase.storage.from("post-media").remove(uploadedPaths);
          }
          await supabase.from("posts").delete().eq("id", newPost.id).eq("profile_id", user.id);
          setStatus({
            kind: "error",
            message: "We couldn't attach your photo or video. Please try again.",
          });
          return;
        }

        const mediaRows = uploadedPaths.map((path, index) => ({
          post_id: newPost.id,
          profile_id: user.id,
          storage_path: path,
          media_type: selectedFiles[index].type.startsWith("video/") ? "video" : "image",
        }));

        const { error: mediaInsertError } = await supabase.from("post_media").insert(mediaRows);

        if (mediaInsertError) {
          await supabase.storage.from("post-media").remove(uploadedPaths);
          await supabase.from("posts").delete().eq("id", newPost.id).eq("profile_id", user.id);
          setStatus({
            kind: "error",
            message: "We couldn't attach your photo or video. Please try again.",
          });
          return;
        }
      }

      setBody("");
      setTopic(null);
      setSelectedFiles([]);
      setMediaError(null);
      setStatus({ kind: "success" });
      router.refresh();
      onPosted?.();
    } catch {
      setStatus({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
      });
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm rounded-shamba border border-shamba-line bg-shamba-card p-4"
    >
      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value.slice(0, MAX_BODY_LENGTH))}
        disabled={isLoading}
        rows={3}
        maxLength={MAX_BODY_LENGTH}
        placeholder="Share a photo, video, or update with every farmer on Shamba Circle…"
        className="w-full rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
      />

      <div className="mt-2 flex flex-wrap gap-1.5">
        {TOPICS.map((option) => {
          const isSelected = topic === option;
          return (
            <button
              key={option}
              type="button"
              onClick={() => setTopic(isSelected ? null : option)}
              disabled={isLoading}
              aria-pressed={isSelected}
              className={
                isSelected
                  ? "rounded-full bg-shamba-green px-3 py-1 font-mono text-xs font-semibold text-shamba-card transition-colors disabled:cursor-not-allowed disabled:opacity-70"
                  : "rounded-full border border-shamba-line px-3 py-1 font-mono text-xs font-semibold text-shamba-ink-soft transition-colors hover:border-shamba-green disabled:cursor-not-allowed disabled:opacity-70"
              }
            >
              {option}
            </button>
          );
        })}
      </div>

      <div className="mt-2 flex flex-col gap-2">
        <input
          ref={galleryInputRef}
          type="file"
          accept={ACCEPTED_MEDIA_TYPES.join(",")}
          multiple
          onChange={handleFilesSelected}
          disabled={isLoading || selectedFiles.length >= MAX_MEDIA_FILES}
          className="hidden"
        />

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFilesSelected}
          disabled={isLoading || selectedFiles.length >= MAX_MEDIA_FILES}
          className="hidden"
        />

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            disabled={isLoading || selectedFiles.length >= MAX_MEDIA_FILES}
            className="inline-flex w-fit items-center gap-2 rounded-shamba border border-shamba-line px-4 py-2 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg disabled:cursor-not-allowed disabled:opacity-70"
          >
            <Camera className="size-4" aria-hidden="true" />
            Camera
          </button>

          <button
            type="button"
            onClick={() => galleryInputRef.current?.click()}
            disabled={isLoading || selectedFiles.length >= MAX_MEDIA_FILES}
            className="inline-flex w-fit items-center gap-2 rounded-shamba border border-shamba-line px-4 py-2 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg disabled:cursor-not-allowed disabled:opacity-70"
          >
            <ImagePlus className="size-4" aria-hidden="true" />
            Add photo or video
          </button>
        </div>

        {mediaError && (
          <p role="alert" className="text-xs font-semibold text-shamba-rust">
            {mediaError}
          </p>
        )}

        {selectedFiles.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {selectedFiles.map((file, index) => (
              <div key={index} className="relative">
                {file.type.startsWith("video/") ? (
                  <video
                    src={previewUrls[index]}
                    muted
                    className="size-20 rounded-shamba border border-shamba-line object-cover"
                  />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={previewUrls[index]}
                    alt=""
                    className="size-20 rounded-shamba border border-shamba-line object-cover"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removeFile(index)}
                  disabled={isLoading}
                  aria-label={`Remove ${file.name}`}
                  className="absolute -right-1.5 -top-1.5 inline-flex size-5 items-center justify-center rounded-full bg-shamba-rust text-shamba-card disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <X className="size-3.5" aria-hidden="true" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <span className="font-mono text-xs text-shamba-ink-soft">
          {remaining} characters left
        </span>

        <button
          type="submit"
          disabled={isLoading || trimmedLength === 0}
          className="inline-flex items-center justify-center gap-2 rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isLoading ? "Posting…" : "Post to Feed"}
        </button>
      </div>

      {status.kind === "error" && (
        <p role="alert" className="mt-2 text-sm font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}

      {status.kind === "success" && (
        <p role="status" className="mt-2 text-sm font-semibold text-shamba-green">
          Posted to Feed.
        </p>
      )}
    </form>
  );
}
