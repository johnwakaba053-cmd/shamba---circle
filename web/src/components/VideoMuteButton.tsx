"use client";

import { Volume2, VolumeX } from "lucide-react";

// The one mute/unmute control for video over media -- shared by the
// Story viewer and Farming Reels so both look and behave the same.
// Size/position come from the caller via className.
export function VideoMuteButton({
  muted,
  onToggle,
  className = "",
}: {
  muted: boolean;
  onToggle: () => void;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      aria-label={muted ? "Unmute" : "Mute"}
      aria-pressed={!muted}
      className={`inline-flex items-center justify-center rounded-full bg-black/30 text-shamba-card backdrop-blur-sm ${className}`}
    >
      {muted ? (
        <VolumeX className="size-4" aria-hidden="true" />
      ) : (
        <Volume2 className="size-4" aria-hidden="true" />
      )}
    </button>
  );
}
