"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const MAX_BIO_LENGTH = 280; // Matches profiles_bio_length_check exactly.

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "success" }
  | { kind: "error"; message: string };

export function BioControl({
  userId,
  initialBio,
}: {
  userId: string;
  initialBio: string;
}) {
  const [bio, setBio] = useState(initialBio);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const isLoading = status.kind === "loading";
  const remaining = MAX_BIO_LENGTH - bio.length;

  async function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) return;

    const trimmed = bio.trim().slice(0, MAX_BIO_LENGTH);
    setStatus({ kind: "loading" });

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        // An empty bio is stored as NULL, not an empty string -- "no bio
        // set yet" and "a bio that happens to be blank" are the same
        // state as far as this product is concerned.
        .update({ bio: trimmed.length > 0 ? trimmed : null })
        .eq("id", userId);

      if (error) {
        setStatus({
          kind: "error",
          message: "We couldn't save your bio. Please try again.",
        });
        return;
      }

      setBio(trimmed);
      setStatus({ kind: "success" });
    } catch {
      setStatus({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
      });
    }
  }

  return (
    <form onSubmit={handleSave} className="flex flex-col gap-2">
      <label htmlFor="bio" className="font-sans text-sm font-semibold text-shamba-ink">
        Bio
      </label>
      <textarea
        id="bio"
        rows={3}
        maxLength={MAX_BIO_LENGTH}
        value={bio}
        onChange={(event) => setBio(event.target.value)}
        disabled={isLoading}
        placeholder="Avocado farmer from Kiambu | Dairy farmer | Learning better ways to grow."
        className="resize-none rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
      />
      <p
        aria-live="polite"
        className={`text-right font-mono text-xs ${
          remaining < 0 ? "text-shamba-rust" : "text-shamba-ink-soft"
        }`}
      >
        {bio.length}/{MAX_BIO_LENGTH}
      </p>

      {status.kind === "error" && (
        <p role="alert" className="text-sm font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}

      {status.kind === "success" && (
        <p role="status" className="text-sm font-semibold text-shamba-green">
          Bio saved.
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex w-fit items-center justify-center gap-2 rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isLoading ? "Saving…" : "Save"}
      </button>
    </form>
  );
}
