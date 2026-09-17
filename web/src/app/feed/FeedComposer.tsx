"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Camera, ImagePlus, Loader2, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { parseHashtagInput } from "./hashtags";
import {
  detectActiveMentionQuery,
  MAX_MENTIONS_PER_POST,
  searchMentionCandidates,
  type ActiveMentionQuery,
  type MentionCandidate,
} from "./mentions";
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
//
// Hashtags are also optional and independent of topic -- a plain text
// field, parsed with hashtags.ts's parseHashtagInput off the exact
// same string used for the live preview pills below, so what's
// previewed is exactly what gets saved. Community posts get no
// hashtags either, for the same reason as topic above.
//
// Mentions are optional too and stored as a structured list
// (selectedMentions) kept separate from the caption text, per
// mentions.ts -- typing "@John" inserts "@John Wakaba " into the
// caption as a visible label, but the actual data that gets saved is
// the resolved profile UUID in selectedMentions, never re-parsed out
// of the caption text. That decoupling is deliberate: it's what makes
// resolving a mentioned profile's *current* privacy state possible
// later (see ReelInfo.tsx), instead of trusting a name frozen at post
// time.
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
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [body, setBody] = useState("");
  const [topic, setTopic] = useState<Topic | null>(null);
  const [hashtagInput, setHashtagInput] = useState("");
  const [selectedMentions, setSelectedMentions] = useState<MentionCandidate[]>([]);
  const [activeMention, setActiveMention] = useState<ActiveMentionQuery | null>(null);
  const [mentionCandidates, setMentionCandidates] = useState<MentionCandidate[]>([]);
  const [mentionSearchLoading, setMentionSearchLoading] = useState(false);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [mediaError, setMediaError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";
  const trimmedLength = body.trim().length;
  const remaining = MAX_BODY_LENGTH - body.length;
  const parsedHashtags = useMemo(() => parseHashtagInput(hashtagInput), [hashtagInput]);

  // Debounced @mention search -- fires whenever the active query
  // changes (including becoming an empty string right after typing
  // "@", which search_public_profiles handles safely). Already-selected
  // profiles are filtered out of the results so the same person can't
  // be picked twice.
  useEffect(() => {
    if (activeMention === null) {
      return;
    }

    let cancelled = false;

    const timeoutId = setTimeout(async () => {
      setMentionSearchLoading(true);
      const supabase = createClient();
      const results = await searchMentionCandidates(supabase, activeMention.query);
      if (cancelled) return;
      setMentionCandidates(
        results.filter((candidate) =>
          selectedMentions.every((selected) => selected.profileId !== candidate.profileId),
        ),
      );
      setMentionSearchLoading(false);
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [activeMention, selectedMentions]);

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

  function handleBodyChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const nextValue = event.target.value.slice(0, MAX_BODY_LENGTH);
    setBody(nextValue);
    const cursorPos = event.target.selectionStart ?? nextValue.length;
    const nextActiveMention = detectActiveMentionQuery(nextValue, cursorPos);
    setActiveMention(nextActiveMention);
    // Clear stale results from any previous query immediately (this is
    // an event handler, not an effect, so it's safe to do synchronously)
    // rather than showing the last query's candidates while the new
    // debounced search is still in flight.
    setMentionCandidates([]);
    setMentionSearchLoading(nextActiveMention !== null);
  }

  function handleBodyKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Escape" && activeMention !== null) {
      event.stopPropagation();
      setActiveMention(null);
    }
  }

  function selectMentionCandidate(candidate: MentionCandidate) {
    if (activeMention === null) return;

    if (selectedMentions.some((selected) => selected.profileId === candidate.profileId)) {
      setActiveMention(null);
      return;
    }

    const insertText = `@${candidate.displayName} `;
    const before = body.slice(0, activeMention.start);
    const after = body.slice(activeMention.start + 1 + activeMention.query.length);
    const nextBody = `${before}${insertText}${after}`.slice(0, MAX_BODY_LENGTH);

    setBody(nextBody);
    setSelectedMentions((prev) => [...prev, candidate].slice(0, MAX_MENTIONS_PER_POST));
    setActiveMention(null);

    // React commits the body state update to the textarea's DOM value
    // synchronously before the next paint, so the cursor position it's
    // restored to here is already correct by the time this callback runs.
    const cursorPos = Math.min(before.length + insertText.length, MAX_BODY_LENGTH);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(cursorPos, cursorPos);
      }
    });
  }

  function removeMention(profileId: string) {
    setSelectedMentions((prev) => prev.filter((mention) => mention.profileId !== profileId));
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

      if (parsedHashtags.length > 0) {
        const normalizedNames = parsedHashtags.map((tag) => tag.normalized);

        // Get-or-create: insert any never-seen terms (ignoreDuplicates
        // skips ones that already exist rather than erroring or
        // renaming them -- there's no UPDATE policy on hashtags at
        // all), then a plain select fetches ids for both the
        // just-inserted and the already-existing terms in one pass.
        const { error: hashtagUpsertError } = await supabase.from("hashtags").upsert(
          parsedHashtags.map((tag) => ({ name: tag.display, normalized_name: tag.normalized })),
          { onConflict: "normalized_name", ignoreDuplicates: true },
        );

        let hashtagsFailed = Boolean(hashtagUpsertError);

        if (!hashtagsFailed) {
          const { data: hashtagRows, error: hashtagSelectError } = await supabase
            .from("hashtags")
            .select("id")
            .in("normalized_name", normalizedNames);

          if (hashtagSelectError || !hashtagRows || hashtagRows.length === 0) {
            hashtagsFailed = true;
          } else {
            const postHashtagRows = hashtagRows.map((row) => ({
              post_id: newPost.id,
              hashtag_id: row.id,
            }));

            const { error: postHashtagInsertError } = await supabase
              .from("post_hashtags")
              .insert(postHashtagRows);

            hashtagsFailed = Boolean(postHashtagInsertError);
          }
        }

        if (hashtagsFailed) {
          await supabase.from("posts").delete().eq("id", newPost.id).eq("profile_id", user.id);
          setStatus({
            kind: "error",
            message: "We couldn't save your hashtags. Please try again.",
          });
          return;
        }
      }

      if (selectedMentions.length > 0) {
        const mentionRows = selectedMentions.map((mention) => ({
          post_id: newPost.id,
          mentioned_profile_id: mention.profileId,
        }));

        const { error: mentionInsertError } = await supabase
          .from("post_mentions")
          .insert(mentionRows);

        if (mentionInsertError) {
          await supabase.from("posts").delete().eq("id", newPost.id).eq("profile_id", user.id);
          setStatus({
            kind: "error",
            message: "We couldn't save your mentions. Please try again.",
          });
          return;
        }
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
      setHashtagInput("");
      setSelectedMentions([]);
      setActiveMention(null);
      setMentionCandidates([]);
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
        ref={textareaRef}
        value={body}
        onChange={handleBodyChange}
        onKeyDown={handleBodyKeyDown}
        disabled={isLoading}
        rows={3}
        maxLength={MAX_BODY_LENGTH}
        placeholder="Share a photo, video, or update with every farmer on Shamba Circle… Type @ to mention someone."
        className="w-full rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
      />

      {activeMention !== null && (
        <div className="mt-1.5 rounded-shamba border border-shamba-line bg-shamba-bg">
          {mentionSearchLoading && mentionCandidates.length === 0 && (
            <p className="px-3 py-2 font-mono text-xs text-shamba-ink-soft">Searching…</p>
          )}

          {!mentionSearchLoading && mentionCandidates.length === 0 && (
            <p className="px-3 py-2 font-mono text-xs text-shamba-ink-soft">
              No matching members found.
            </p>
          )}

          {mentionCandidates.length > 0 && (
            <ul className="max-h-48 overflow-y-auto py-1">
              {mentionCandidates.map((candidate) => (
                <li key={candidate.profileId}>
                  <button
                    type="button"
                    onClick={() => selectMentionCandidate(candidate)}
                    className="flex w-full flex-col items-start px-3 py-2 text-left transition-colors hover:bg-shamba-card"
                  >
                    <span className="font-sans text-sm font-semibold text-shamba-ink">
                      {candidate.displayName}
                    </span>
                    {candidate.roles.length > 0 && (
                      <span className="font-mono text-xs text-shamba-ink-soft">
                        {candidate.roles.join(", ")}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {selectedMentions.length > 0 && (
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {selectedMentions.map((mention) => (
            <span
              key={mention.profileId}
              className="inline-flex items-center gap-1 rounded-full border border-shamba-line px-2 py-0.5 font-mono text-xs font-semibold text-shamba-ink-soft"
            >
              @{mention.displayName}
              <button
                type="button"
                onClick={() => removeMention(mention.profileId)}
                disabled={isLoading}
                aria-label={`Remove mention of ${mention.displayName}`}
                className="text-shamba-ink-soft transition-colors hover:text-shamba-rust disabled:cursor-not-allowed"
              >
                <X className="size-3" aria-hidden="true" />
              </button>
            </span>
          ))}
        </div>
      )}

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

      <div className="mt-2">
        <input
          type="text"
          value={hashtagInput}
          onChange={(event) => setHashtagInput(event.target.value)}
          disabled={isLoading}
          placeholder="Add hashtags, e.g. #Avocado #Kiambu"
          className="w-full rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-2 font-sans text-sm text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
        />

        {parsedHashtags.length > 0 && (
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {parsedHashtags.map((tag) => (
              <span
                key={tag.normalized}
                className="rounded-full border border-shamba-line px-2 py-0.5 font-mono text-xs font-semibold text-shamba-ink-soft"
              >
                #{tag.display}
              </span>
            ))}
          </div>
        )}
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
