"use client";

import { useState } from "react";
import { Play } from "lucide-react";
import { getYouTubeEmbedUrl, getYouTubeThumbnailUrl } from "@/lib/youtube";

// A video story's player. Until the reader taps, it's only YouTube's still
// image and a play button -- the YouTube player (roughly a megabyte of
// scripts) loads after the tap, which matters on prepaid mobile data.
// The player is youtube-nocookie and is always built from a validated
// ID (news_media.embed_id, checked again by the caller), never a URL.
export function YouTubeFacade({
  videoId,
  title,
  durationLabel,
}: {
  videoId: string;
  title: string;
  durationLabel: string | null;
}) {
  const [playing, setPlaying] = useState(false);

  if (playing) {
    return (
      <div className="relative aspect-video w-full overflow-hidden rounded-shamba border border-shamba-line bg-shamba-ink">
        <iframe
          src={`${getYouTubeEmbedUrl(videoId)}?autoplay=1&rel=0`}
          title={`Video: ${title}`}
          className="absolute inset-0 size-full"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          allowFullScreen
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => setPlaying(true)}
      className="group relative block aspect-video w-full overflow-hidden rounded-shamba border border-shamba-line bg-shamba-ink"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={getYouTubeThumbnailUrl(videoId)}
        alt=""
        fetchPriority="high"
        decoding="async"
        className="absolute inset-0 size-full object-cover"
      />
      <span aria-hidden="true" className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/30">
        <span className="flex size-16 items-center justify-center rounded-full bg-shamba-green text-shamba-card">
          <Play className="size-7 translate-x-0.5 fill-shamba-card" />
        </span>
      </span>
      {durationLabel && (
        <span className="absolute bottom-3 right-3 rounded-full bg-black/70 px-2.5 py-1 font-mono text-xs font-semibold text-shamba-card">
          {durationLabel}
        </span>
      )}
      <span className="sr-only">
        Play video: {title}
        {durationLabel ? ` (${durationLabel})` : ""}
      </span>
    </button>
  );
}
