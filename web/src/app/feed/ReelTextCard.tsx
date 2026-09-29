"use client";

import { useState } from "react";
import { Quote } from "lucide-react";

// A text-only post (no photo/video) as an intentional full-slide card
// instead of an empty dark screen: the caption becomes the content,
// centred in the same column ReelInfo's caption uses (left-3 right-16,
// clear of the action rail) and above the author/community block.
//
// Short posts get large type; long ones are clamped with "Read more",
// which only then makes the card scrollable -- so a normal swipe on the
// card still moves to the next Reel instead of being captured by an
// inner scroll area.
const LARGE_TEXT_MAX_CHARS = 120;
const MEDIUM_TEXT_MAX_CHARS = 280;
const CLAMP_THRESHOLD_CHARS = 400;

export function ReelTextCard({ body }: { body: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = body.length > CLAMP_THRESHOLD_CHARS;

  const sizeClass =
    body.length <= LARGE_TEXT_MAX_CHARS
      ? "text-2xl leading-snug"
      : body.length <= MEDIUM_TEXT_MAX_CHARS
        ? "text-xl leading-8"
        : "text-base leading-7";

  return (
    <div className="absolute inset-0 bg-gradient-to-b from-shamba-green-deep via-shamba-green-deep to-shamba-ink">
      <div className="absolute bottom-44 left-3 right-16 top-[calc(env(safe-area-inset-top,0px)+4.5rem)] flex items-center">
        <div
          className={`w-full rounded-shamba bg-shamba-card p-5 shadow-lg ${
            expanded ? "max-h-full overflow-y-auto overscroll-contain" : "max-h-full overflow-hidden"
          }`}
        >
          <Quote className="size-6 text-shamba-ochre" aria-hidden="true" />
          <p
            className={`mt-2 whitespace-pre-wrap break-words font-display font-medium text-shamba-ink ${sizeClass} ${
              isLong && !expanded ? "line-clamp-[10]" : ""
            }`}
          >
            {body}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((value) => !value)}
              className="mt-2 font-mono text-xs font-semibold text-shamba-green hover:text-shamba-green-deep"
            >
              {expanded ? "Show less" : "Read more"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
