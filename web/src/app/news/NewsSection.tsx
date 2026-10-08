import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

// One section of the /news front page: a heading with its icon in a
// tinted circle (DESIGN.md's Tinted Chip Rule) and an optional "See all"
// link to the matching filtered view. Callers don't render a section
// that has nothing to show.
export function NewsSection({
  id,
  title,
  icon: Icon,
  tone,
  seeAllHref,
  seeAllLabel = "See all",
  className = "",
  children,
}: {
  id: string;
  title: string;
  icon: LucideIcon;
  // Full class strings (not fragments) so Tailwind can see them.
  tone: string;
  seeAllHref?: string;
  seeAllLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  const headingId = `news-${id}-heading`;

  return (
    <section aria-labelledby={headingId} className={`flex flex-col gap-4 ${className}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={headingId} className="flex items-center gap-2 font-display text-xl font-bold text-shamba-ink">
          <span className={`flex size-8 shrink-0 items-center justify-center rounded-full ${tone}`}>
            <Icon className="size-4" aria-hidden="true" />
          </span>
          {title}
        </h2>
        {seeAllHref && (
          <Link
            href={seeAllHref}
            className="relative touch-target inline-flex shrink-0 items-center gap-1 rounded-shamba font-sans text-sm font-semibold text-shamba-green transition-colors hover:text-shamba-green-deep"
          >
            {seeAllLabel}
            <span className="sr-only"> {title}</span>
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      {children}
    </section>
  );
}
