"use client";

import { useEffect, useRef } from "react";

// A guide cover <img> that, if its file fails (a signed URL that expired
// while the page sat open, a dropped connection), hides its whole block --
// the closest [data-cover] ancestor, so the photo credit goes with it --
// and the page reads as it does for a guide with no cover. The effect
// catches a failure that happened before hydration, when onError wasn't
// attached yet. A plain <img> like every other Storage image in the app.
export function HideOnErrorImage({
  src,
  alt,
  priority = false,
  className,
}: {
  src: string;
  alt: string;
  priority?: boolean;
  className: string;
}) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) hideBlock(img);
  }, []);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={(event) => hideBlock(event.currentTarget)}
      className={className}
    />
  );
}

function hideBlock(img: HTMLImageElement) {
  const block = img.closest<HTMLElement>("[data-cover]") ?? img;
  block.style.display = "none";
}
