"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, Loader2, Plus, Send, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MAX_BODY_LENGTH = 2000;
const MAX_MEDIA_FILES = 4;
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB, matches the Storage bucket's own cap
const MAX_TEXTAREA_HEIGHT_PX = 128; // matches the textarea's own max-h-32
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

// Message-bar composer: same posts+post_media insert/upload/rollback
// logic as before this batch, restyled as a compact "type a message"
// bar (text input, attach, camera, send) instead of a standalone card
// with a big textarea and separate buttons below it, per the Batch 1
// conversation redesign. Rendered inside CommunityConversation.tsx's
// fixed-to-viewport-bottom panel.
export function PostComposer({
  communityId,
  isMember,
}: {
  communityId: string;
  isMember: boolean;
}) {
  const router = useRouter();
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";
  const trimmedLength = body.trim().length;
  const remaining = MAX_BODY_LENGTH - body.length;
  const mediaLimitReached = selectedFiles.length >= MAX_MEDIA_FILES;

  // Object URLs are only valid client-side. Derive them from the current
  // selection with useMemo (not useState+setState-in-effect); the effect
  // below only handles revoking the previous batch, never sets state.
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
    event.target.value = ""; // allow re-selecting the same file again later

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

  // Grows the textarea with its content, up to MAX_TEXTAREA_HEIGHT_PX
  // (matching the max-h-32 below), so a long message stays fully visible
  // instead of scrolling inside a fixed one-line box -- a plain
  // imperative style write on the element itself, independent of the
  // controlled `value`, is enough here and avoids a layout-measuring
  // effect for something this small.
  function handleBodyChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const el = event.target;
    setBody(el.value.slice(0, MAX_BODY_LENGTH));
    el.style.height = "auto";
    el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_HEIGHT_PX)}px`;
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) return;

    const trimmed = body.trim();
    if (trimmed.length === 0) {
      setStatus({ kind: "error", message: "Write something before sending." });
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
        .insert({ community_id: communityId, profile_id: user.id, body: trimmed })
        .select("id")
        .single();

      if (postError || !newPost) {
        setStatus({
          kind: "error",
          message: "We couldn't send that. Please try again.",
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
      setSelectedFiles([]);
      setMediaError(null);
      setStatus({ kind: "success" });
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
      router.refresh();
    } catch {
      setStatus({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
      });
    }
  }

  if (!isMember) {
    return (
      <p className="px-1 py-3 text-center text-sm text-shamba-ink-soft">
        Join this community to send a message.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-1.5">
      {selectedFiles.length > 0 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          {selectedFiles.map((file, index) => (
            <div key={index} className="relative shrink-0">
              {file.type.startsWith("video/") ? (
                <video
                  src={previewUrls[index]}
                  muted
                  className="size-16 rounded-shamba border border-shamba-line object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={previewUrls[index]}
                  alt=""
                  className="size-16 rounded-shamba border border-shamba-line object-cover"
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

      {mediaError && (
        <p role="alert" className="text-xs font-semibold text-shamba-rust">
          {mediaError}
        </p>
      )}

      <div className="flex items-end gap-1.5">
        <input
          ref={galleryInputRef}
          type="file"
          accept={ACCEPTED_MEDIA_TYPES.join(",")}
          multiple
          onChange={handleFilesSelected}
          disabled={isLoading || mediaLimitReached}
          className="hidden"
        />

        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFilesSelected}
          disabled={isLoading || mediaLimitReached}
          className="hidden"
        />

        <button
          type="button"
          onClick={() => galleryInputRef.current?.click()}
          disabled={isLoading || mediaLimitReached}
          aria-label="Attach a photo or video"
          title="Attach a photo or video"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-shamba-line text-shamba-ink-soft transition-colors hover:bg-shamba-bg disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus className="size-5" aria-hidden="true" />
        </button>

        <textarea
          ref={textareaRef}
          value={body}
          onChange={handleBodyChange}
          disabled={isLoading}
          rows={1}
          maxLength={MAX_BODY_LENGTH}
          aria-label="Message"
          placeholder="Type a message…"
          className="min-h-11 max-h-32 flex-1 resize-none overflow-y-auto rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-2.5 font-sans text-base leading-6 text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
        />

        {/* Camera capture is a plain HTML file input with capture="environment"
            -- there's no separate native app dependency here. Where a device
            has no camera (most desktops), the browser falls back to its
            normal file picker, so this button still works everywhere, it just
            may not open a live camera on desktop. */}
        <button
          type="button"
          onClick={() => cameraInputRef.current?.click()}
          disabled={isLoading || mediaLimitReached}
          aria-label="Take a photo"
          title="Take a photo"
          className="flex size-11 shrink-0 items-center justify-center rounded-full border border-shamba-line text-shamba-ink-soft transition-colors hover:bg-shamba-bg disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Camera className="size-5" aria-hidden="true" />
        </button>

        <button
          type="submit"
          disabled={isLoading || trimmedLength === 0}
          aria-label="Send message"
          title="Send"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-shamba-green text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoading ? (
            <Loader2 className="size-5 animate-spin" aria-hidden="true" />
          ) : (
            <Send className="size-5" aria-hidden="true" />
          )}
        </button>
      </div>

      {remaining <= 300 && (
        <p className="text-right font-mono text-xs text-shamba-ink-soft">
          {remaining} characters left
        </p>
      )}

      {status.kind === "error" && (
        <p role="alert" className="text-xs font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}
    </form>
  );
}
