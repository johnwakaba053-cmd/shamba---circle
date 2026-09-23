"use client";

import { useState } from "react";
import { UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB -- mirrors the avatars
// bucket's own file_size_limit. This client-side check exists only to give
// a farmer fast, friendly feedback before a slow upload attempt; the
// bucket's own limit is what actually enforces this, regardless of what
// happens here.
const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const SIGNED_URL_EXPIRY_SECONDS = 3600;

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

// A single canonical object per user -- "{userId}/avatar", no extension --
// rather than "{userId}/avatar.jpg" vs "{userId}/avatar.png". Storage
// tracks the real content type from the upload call itself, not from the
// filename, so this avoids ever leaving an orphaned file behind if a
// farmer later replaces a JPEG avatar with a PNG one: there is only ever
// one possible path to upsert into.
function avatarPathFor(userId: string): string {
  return `${userId}/avatar`;
}

export function AvatarUploadControl({
  userId,
  displayName,
  initialAvatarUrl,
}: {
  userId: string;
  displayName: string;
  initialAvatarUrl: string | null;
}) {
  const [avatarUrl, setAvatarUrl] = useState(initialAvatarUrl);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    // Always clear the input's own value so selecting the exact same file
    // twice in a row still fires a change event next time.
    event.target.value = "";
    if (!file) return;

    if (!ALLOWED_MIME_TYPES.has(file.type)) {
      setStatus({
        kind: "error",
        message: "Please choose a JPEG, PNG, or WebP image.",
      });
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setStatus({
        kind: "error",
        message: "That photo is too large. Please choose one under 5MB.",
      });
      return;
    }

    setStatus({ kind: "loading" });

    try {
      const supabase = createClient();
      const path = avatarPathFor(userId);

      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, file, { contentType: file.type, upsert: true });

      if (uploadError) {
        setStatus({
          kind: "error",
          message: "We couldn't upload your photo. Please try again.",
        });
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_path: path })
        .eq("id", userId);

      if (updateError) {
        setStatus({
          kind: "error",
          message: "Your photo uploaded, but we couldn't save it to your profile. Please try again.",
        });
        return;
      }

      const { data: signedUrlData } = await supabase.storage
        .from("avatars")
        .createSignedUrl(path, SIGNED_URL_EXPIRY_SECONDS);

      setAvatarUrl(signedUrlData?.signedUrl ?? null);
      setStatus({ kind: "idle" });
    } catch {
      setStatus({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
      });
    }
  }

  async function handleRemove() {
    // Reachable only via the hidden trigger button below, which the
    // three-dot menu's "Remove profile photo" item clicks programmatically
    // -- always mounted regardless of whether a photo is currently set, so
    // this no-ops harmlessly rather than requiring the menu to track
    // avatar state separately from this component's own.
    if (isLoading || !avatarUrl) return;
    setStatus({ kind: "loading" });

    try {
      const supabase = createClient();
      const path = avatarPathFor(userId);

      const { error: removeError } = await supabase.storage
        .from("avatars")
        .remove([path]);

      if (removeError) {
        setStatus({
          kind: "error",
          message: "We couldn't remove your photo. Please try again.",
        });
        return;
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ avatar_path: null })
        .eq("id", userId);

      if (updateError) {
        setStatus({
          kind: "error",
          message: "Your photo was removed, but we couldn't update your profile. Please try again.",
        });
        return;
      }

      setAvatarUrl(null);
      setStatus({ kind: "idle" });
    } catch {
      setStatus({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
      });
    }
  }

  return (
    <div className="flex flex-col items-center gap-2">
      {/* Read-only display only -- every edit affordance for this photo
          lives in the three-dot ProfileMenu instead (see page.tsx). The
          hidden input/button below are that menu's only actual targets:
          one canonical upload path and one avatar state, both still owned
          entirely by this component. */}
      <div className="size-24 overflow-hidden rounded-full border border-shamba-line bg-shamba-green/10">
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- private, signed-URL bucket, same convention as ListingMedia/PostMedia/ReelMedia.
          <img
            src={avatarUrl}
            alt={`${displayName}'s profile photo`}
            className="size-full object-cover"
            onError={() => setAvatarUrl(null)}
          />
        ) : (
          <div className="flex size-full items-center justify-center">
            <UserRound
              className="size-10 text-shamba-green"
              aria-hidden="true"
            />
          </div>
        )}
      </div>

      <input
        id="avatar-file-input"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileChange}
        disabled={isLoading}
        className="sr-only"
      />
      <button
        id="avatar-remove-trigger"
        type="button"
        onClick={handleRemove}
        disabled={isLoading}
        className="hidden"
        tabIndex={-1}
        aria-hidden="true"
      />

      {status.kind === "loading" && (
        <p role="status" className="text-xs font-semibold text-shamba-ink-soft">
          Updating your photo…
        </p>
      )}

      {status.kind === "error" && (
        <p role="alert" className="max-w-[16rem] text-center text-xs font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}
    </div>
  );
}
