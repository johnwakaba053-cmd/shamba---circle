import { NEWS_FORMAT_ICON, NEWS_FORMAT_LABELS, type NewsFormat } from "@/lib/news";

// "Video", "Photo story", "Market update" as a small mono tag with its
// icon -- never colour alone. Plain articles get no badge: they're the
// default, and a tag on every card would just be noise.
export function NewsFormatBadge({ format }: { format: NewsFormat }) {
  if (format === "article") return null;
  const Icon = NEWS_FORMAT_ICON[format];

  return (
    <span className="inline-flex w-fit items-center gap-1 rounded-full border border-shamba-line bg-shamba-bg px-2 py-0.5 font-mono text-xs font-semibold text-shamba-ink-soft">
      <Icon className="size-3.5" aria-hidden="true" />
      {NEWS_FORMAT_LABELS[format]}
    </span>
  );
}
