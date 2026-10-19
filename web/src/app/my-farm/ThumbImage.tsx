"use client";

import { useEffect, useRef } from "react";

// A small lazy thumbnail laid over a panel that is already drawn
// underneath it (FarmNewsThumb, GuideThumb). If the file fails -- a
// signed URL that has expired while the page sat open, a dropped
// connection, a removed YouTube still -- the <img> hides itself and the
// panel shows through, instead of a broken-image icon. The effect catches
// a failure that happened before hydration, when onError wasn't attached
// yet. Any photo credit for it ([data-thumb-credit] inside the same
// [data-thumb-scope] row) is hidden with it. Decorative (alt=""): the
// title beside it says what it is. `priority` loads it straight away (the
// first picture on a page) instead of lazily.
export function ThumbImage({ src, priority = false }: { src: string; priority?: boolean }) {
  const ref = useRef<HTMLImageElement>(null);

  useEffect(() => {
    const img = ref.current;
    if (img && img.complete && img.naturalWidth === 0) hide(img);
  }, []);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      ref={ref}
      src={src}
      alt=""
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={(event) => hide(event.currentTarget)}
      className="absolute inset-0 size-full object-cover"
    />
  );
}

function hide(img: HTMLImageElement) {
  img.style.display = "none";
  img
    .closest("[data-thumb-scope]")
    ?.querySelectorAll<HTMLElement>("[data-thumb-credit]")
    .forEach((credit) => {
      credit.style.display = "none";
    });
}
