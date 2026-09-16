import type { PostMediaItem } from "@/lib/postMedia";

// Pure presentation, no client-side Supabase calls — signed URLs are
// generated server-side (see lib/postMedia.ts) and passed in already
// resolved, so this can render directly from a Server Component.
export function PostMedia({ items }: { items: PostMediaItem[] }) {
  if (items.length === 0) {
    return null;
  }

  return (
    <div
      className={
        items.length === 1
          ? "mt-2 grid grid-cols-1 gap-2"
          : "mt-2 grid grid-cols-2 gap-2"
      }
    >
      {items.map((item) =>
        item.mediaType === "video" ? (
          <video
            key={item.id}
            src={item.url}
            controls
            className="aspect-square w-full rounded-shamba border border-shamba-line bg-shamba-bg object-cover"
          />
        ) : (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={item.id}
            src={item.url}
            alt=""
            className="aspect-square w-full rounded-shamba border border-shamba-line object-cover"
          />
        ),
      )}
    </div>
  );
}
