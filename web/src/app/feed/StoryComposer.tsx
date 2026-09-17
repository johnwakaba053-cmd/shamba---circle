"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ImagePlus, Loader2, X } from "lucide-react";
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

// Story creation. Deliberately a self-contained composer rather than a
// refactor of FeedComposer.tsx into something shared -- same "Feed-
// specific component instead of modifying a working shared one"
// precedent used throughout this codebase (FeedPostMedia vs PostMedia,
// ReelLikeControl vs PostLikeControl, etc.). What genuinely is reused is
// the *pure* logic (topics.ts, hashtags.ts's parseHashtagInput,
// mentions.ts's detectActiveMentionQuery/searchMentionCandidates) --
// only the React state wiring around them is duplicated, not the
// underlying architecture or the database access patterns.
//
// Unlike a Reel, a Story's media is required (stories.media_type/
// media_path are NOT NULL at the database level) and singular -- one
// item, not up to 4 -- so selecting a new file replaces the current
// selection instead of appending to a list.
const MAX_CAPTION_LENGTH = 2000; // matches stories_caption_check
const MAX_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB, mirrors FeedComposer's own split
const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100MB, matches story-media's bucket limit
const ACCEPTED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "video/mp4",
  "video/quicktime",
];

type Status =
  | { kind: "idle" }
  | { kind: "publishing" }
  | { kind: "error"; message: string };

export function StoryComposer({
  onClose,
  onPublished,
}: {
  onClose: () => void;
  onPublished: () => void;
}) {
  const router = useRouter();
  const dialogRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const captionRef = useRef<HTMLTextAreaElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [topic, setTopic] = useState<Topic | null>(null);
  const [hashtagInput, setHashtagInput] = useState("");
  const [selectedMentions, setSelectedMentions] = useState<MentionCandidate[]>([]);
  const [activeMention, setActiveMention] = useState<ActiveMentionQuery | null>(null);
  const [mentionCandidates, setMentionCandidates] = useState<MentionCandidate[]>([]);
  const [mentionSearchLoading, setMentionSearchLoading] = useState(false);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isPublishing = status.kind === "publishing";
  const parsedHashtags = useMemo(() => parseHashtagInput(hashtagInput), [hashtagInput]);

  const previewUrl = useMemo(() => (file ? URL.createObjectURL(file) : null), [file]);
  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  useEffect(() => {
    dialogRef.current?.focus();
  }, []);

  // Same debounced-search shape as FeedComposer's own mention input.
  useEffect(() => {
    if (activeMention === null) return;

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

  function handleDialogKeyDown(event: React.KeyboardEvent) {
    if (event.key === "Escape" && !isPublishing) {
      onClose();
    }
  }

  function handleFileSelected(event: React.ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;

    if (!ACCEPTED_MEDIA_TYPES.includes(selected.type)) {
      setFileError(`${selected.name} isn't a supported photo or video type.`);
      return;
    }

    const isVideo = selected.type.startsWith("video/");
    const limit = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (selected.size > limit) {
      setFileError(
        isVideo
          ? `${selected.name} is too large. Videos must be under 100MB.`
          : `${selected.name} is too large. Photos must be under 8MB.`,
      );
      return;
    }

    setFileError(null);
    setFile(selected);
  }

  function handleCaptionChange(event: React.ChangeEvent<HTMLTextAreaElement>) {
    const nextValue = event.target.value.slice(0, MAX_CAPTION_LENGTH);
    setCaption(nextValue);
    const cursorPos = event.target.selectionStart ?? nextValue.length;
    const nextActiveMention = detectActiveMentionQuery(nextValue, cursorPos);
    setActiveMention(nextActiveMention);
    setMentionCandidates([]);
    setMentionSearchLoading(nextActiveMention !== null);
  }

  function handleCaptionKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
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
    const before = caption.slice(0, activeMention.start);
    const after = caption.slice(activeMention.start + 1 + activeMention.query.length);
    const nextCaption = `${before}${insertText}${after}`.slice(0, MAX_CAPTION_LENGTH);

    setCaption(nextCaption);
    setSelectedMentions((prev) => [...prev, candidate].slice(0, MAX_MENTIONS_PER_POST));
    setActiveMention(null);

    const cursorPos = Math.min(before.length + insertText.length, MAX_CAPTION_LENGTH);
    requestAnimationFrame(() => {
      const el = captionRef.current;
      if (el) {
        el.focus();
        el.setSelectionRange(cursorPos, cursorPos);
      }
    });
  }

  function removeMention(profileId: string) {
    setSelectedMentions((prev) => prev.filter((mention) => mention.profileId !== profileId));
  }

  async function handlePublish() {
    if (isPublishing) return;

    if (!file) {
      setStatus({ kind: "error", message: "Choose a photo or video first." });
      return;
    }

    setStatus({ kind: "publishing" });

    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        setStatus({ kind: "error", message: "Please sign in again." });
        return;
      }

      // The story id is generated client-side and used for both the
      // storage path and the row's own primary key. This is required,
      // not just convenient: stories.media_path is NOT NULL and there is
      // no UPDATE policy on stories (by design -- editing a Story isn't
      // part of this foundation), so the usual "insert the row, then
      // upload, then update the row with the final path" sequence
      // literally isn't available here. Uploading first and inserting
      // once with the final path already known is the only sequence
      // that fits the existing schema -- and the story-media INSERT
      // policy only checks the profile_id path segment, so it doesn't
      // need the stories row to exist yet either.
      const storyId = crypto.randomUUID();
      const isVideo = file.type.startsWith("video/");
      const extension = file.name.includes(".")
        ? file.name.split(".").pop()
        : file.type.split("/")[1];
      const mediaPath = `${user.id}/${storyId}/story.${extension}`;

      const { error: uploadError } = await supabase.storage
        .from("story-media")
        .upload(mediaPath, file, { contentType: file.type });

      if (uploadError) {
        setStatus({
          kind: "error",
          message: "We couldn't upload your Story. Please try again.",
        });
        return;
      }

      const { error: storyInsertError } = await supabase.from("stories").insert({
        id: storyId,
        profile_id: user.id,
        media_type: isVideo ? "video" : "image",
        media_path: mediaPath,
        caption: caption.trim() || null,
        topic,
      });

      if (storyInsertError) {
        await supabase.storage.from("story-media").remove([mediaPath]);
        setStatus({
          kind: "error",
          message: "We couldn't publish your Story. Please try again.",
        });
        return;
      }

      if (parsedHashtags.length > 0) {
        const normalizedNames = parsedHashtags.map((tag) => tag.normalized);

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
            const { error: storyHashtagInsertError } = await supabase
              .from("story_hashtags")
              .insert(hashtagRows.map((row) => ({ story_id: storyId, hashtag_id: row.id })));

            hashtagsFailed = Boolean(storyHashtagInsertError);
          }
        }

        if (hashtagsFailed) {
          // Deleting the story cascades story_hashtags/story_mentions
          // automatically via their FKs -- only the Storage object
          // needs an explicit cleanup call, since storage isn't
          // FK-linked to stories at the database level.
          await supabase.from("stories").delete().eq("id", storyId).eq("profile_id", user.id);
          await supabase.storage.from("story-media").remove([mediaPath]);
          setStatus({
            kind: "error",
            message: "We couldn't save your hashtags. Please try again.",
          });
          return;
        }
      }

      if (selectedMentions.length > 0) {
        const { error: mentionInsertError } = await supabase.from("story_mentions").insert(
          selectedMentions.map((mention) => ({
            story_id: storyId,
            mentioned_profile_id: mention.profileId,
          })),
        );

        if (mentionInsertError) {
          await supabase.from("stories").delete().eq("id", storyId).eq("profile_id", user.id);
          await supabase.storage.from("story-media").remove([mediaPath]);
          setStatus({
            kind: "error",
            message: "We couldn't save your mentions. Please try again.",
          });
          return;
        }
      }

      router.refresh();
      onPublished();
    } catch {
      setStatus({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
      });
    }
  }

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-labelledby="story-composer-title"
      tabIndex={-1}
      onKeyDown={handleDialogKeyDown}
      className="fixed inset-0 z-50 flex flex-col justify-end bg-black/50 outline-none sm:items-center sm:justify-center"
      onClick={(event) => {
        if (event.target === event.currentTarget && !isPublishing) onClose();
      }}
    >
      <div className="max-h-[90dvh] w-full overflow-y-auto rounded-t-shamba border-t border-shamba-line bg-shamba-bg p-4 sm:max-w-sm sm:rounded-shamba sm:border">
        <div className="mb-3 flex items-center justify-between">
          <h2 id="story-composer-title" className="font-display text-lg font-semibold text-shamba-ink">
            Create Story
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={isPublishing}
            aria-label="Close"
            className="inline-flex size-8 items-center justify-center rounded-full text-shamba-ink-soft transition-colors hover:bg-shamba-card hover:text-shamba-ink disabled:cursor-not-allowed disabled:opacity-70"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_MEDIA_TYPES.join(",")}
          onChange={handleFileSelected}
          disabled={isPublishing}
          className="hidden"
        />

        {previewUrl ? (
          <div className="relative">
            {file?.type.startsWith("video/") ? (
              <video
                src={previewUrl}
                controls
                playsInline
                className="aspect-[9/16] w-full rounded-shamba border border-shamba-line bg-shamba-ink object-contain"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewUrl}
                alt=""
                className="aspect-[9/16] w-full rounded-shamba border border-shamba-line object-cover"
              />
            )}
            <button
              type="button"
              onClick={() => setFile(null)}
              disabled={isPublishing}
              aria-label="Remove selected media"
              className="absolute right-2 top-2 inline-flex size-8 items-center justify-center rounded-full bg-shamba-ink/60 text-shamba-card disabled:cursor-not-allowed disabled:opacity-70"
            >
              <X className="size-4" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPublishing}
            className="flex aspect-[9/16] w-full flex-col items-center justify-center gap-2 rounded-shamba border-2 border-dashed border-shamba-line bg-shamba-card text-shamba-ink-soft transition-colors hover:border-shamba-green disabled:cursor-not-allowed disabled:opacity-70"
          >
            <ImagePlus className="size-8" aria-hidden="true" />
            <span className="font-sans text-sm font-semibold">Choose Photo or Video</span>
          </button>
        )}

        {fileError && (
          <p role="alert" className="mt-2 text-xs font-semibold text-shamba-rust">
            {fileError}
          </p>
        )}

        {file && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isPublishing}
            className="mt-2 font-mono text-xs font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink disabled:cursor-not-allowed disabled:opacity-70"
          >
            Change photo or video
          </button>
        )}

        <textarea
          ref={captionRef}
          value={caption}
          onChange={handleCaptionChange}
          onKeyDown={handleCaptionKeyDown}
          disabled={isPublishing}
          rows={2}
          maxLength={MAX_CAPTION_LENGTH}
          placeholder="Add a caption… Type @ to mention someone."
          className="mt-3 w-full rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
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
                  disabled={isPublishing}
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
                disabled={isPublishing}
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
            disabled={isPublishing}
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

        <div className="mt-3 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPublishing}
            className="inline-flex items-center justify-center rounded-shamba px-4 py-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink disabled:cursor-not-allowed disabled:opacity-70"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={isPublishing || !file}
            className="inline-flex items-center justify-center gap-2 rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPublishing && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isPublishing ? "Publishing…" : "Publish Story"}
          </button>
        </div>

        {status.kind === "error" && (
          <p role="alert" className="mt-2 text-sm font-semibold text-shamba-rust">
            {status.message}
          </p>
        )}
      </div>
    </div>
  );
}
