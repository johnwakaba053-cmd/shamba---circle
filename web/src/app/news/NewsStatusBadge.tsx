import type { NewsDisplayStatus } from "@/lib/news";

// Where an article stands, as a small mono tag. Readers only ever see
// live articles, so on the public pages this appears only when an admin
// opens a draft, scheduled, expired or archived article (N1's admin read
// policy lets them) -- and it's what the admin list will use later.
// Each state is a word, never colour alone.
const STATUS_STYLES: Record<NewsDisplayStatus, { label: string; className: string }> = {
  draft: {
    label: "Draft",
    className: "border border-shamba-line bg-shamba-bg text-shamba-ink-soft",
  },
  scheduled: {
    label: "Scheduled",
    className: "bg-shamba-ochre/15 text-shamba-ink",
  },
  live: {
    label: "Published",
    className: "bg-shamba-green/10 text-shamba-green-deep",
  },
  expired: {
    label: "Expired",
    className: "border border-shamba-line bg-shamba-bg text-shamba-ink-soft",
  },
  archived: {
    label: "Archived",
    className: "border border-shamba-line bg-shamba-bg text-shamba-ink-soft",
  },
};

export function NewsStatusBadge({ status }: { status: NewsDisplayStatus }) {
  const { label, className } = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex w-fit items-center rounded-full px-2.5 py-0.5 font-mono text-xs font-semibold uppercase tracking-wide ${className}`}
    >
      {label}
    </span>
  );
}
