"use client";

import { useState } from "react";
import { Play, Sprout } from "lucide-react";
import type { Reel } from "@/app/feed/types";
import { ProfilePostViewer } from "./ProfilePostViewer";

// The farmer-profile equivalent of a media grid -- deliberately not an
// Instagram clone: square agricultural tiles, no like/view counts (none
// are invented here), and a plain leaf icon + caption preview instead of
// a broken-image placeholder for a post with no attached media. Tapping
// a tile opens ProfilePostViewer at that exact index; the grid and
// viewer share the same already-assembled Reel[] (see profilePosts.ts),
// so there is no second post fetch on tap.
export function ProfilePostGrid({
  reels,
  emptyMessage,
}: {
  reels: Reel[];
  emptyMessage: string;
}) {
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  if (reels.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-shamba border border-dashed border-shamba-line bg-shamba-card px-6 py-10 text-center">
        <Sprout className="size-6 text-shamba-green" aria-hidden="true" />
        <p className="max-w-xs text-sm leading-6 text-shamba-ink-soft">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <>
      <div className="grid w-full grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
        {reels.map((reel, index) => {
          const thumbnail = reel.media[0];

          return (
            <button
              key={reel.id}
              type="button"
              onClick={() => setSelectedIndex(index)}
              aria-label={`Open post ${index + 1} of ${reels.length}`}
              className="relative aspect-square overflow-hidden rounded-shamba border border-shamba-line bg-shamba-card"
            >
              {thumbnail ? (
                <>
                  {thumbnail.mediaType === "video" ? (
                    <video
                      src={thumbnail.url}
                      muted
                      playsInline
                      preload="metadata"
                      className="size-full object-cover"
                    />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element -- private, signed-URL bucket, same convention as ReelMedia/PostMedia.
                    <img src={thumbnail.url} alt="" className="size-full object-cover" />
                  )}
                  {thumbnail.mediaType === "video" && (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <span className="flex size-9 items-center justify-center rounded-full bg-black/40">
                        <Play
                          className="size-4 fill-shamba-card text-shamba-card"
                          aria-hidden="true"
                        />
                      </span>
                    </span>
                  )}
                </>
              ) : (
                <div className="flex size-full flex-col items-center justify-center gap-1.5 bg-shamba-green/10 p-3 text-center">
                  <Sprout className="size-5 shrink-0 text-shamba-green" aria-hidden="true" />
                  <span className="line-clamp-3 font-sans text-xs leading-4 text-shamba-ink-soft">
                    {reel.body}
                  </span>
                </div>
              )}
            </button>
          );
        })}
      </div>

      {selectedIndex !== null && (
        <ProfilePostViewer
          reels={reels}
          initialIndex={selectedIndex}
          onClose={() => setSelectedIndex(null)}
        />
      )}
    </>
  );
}
