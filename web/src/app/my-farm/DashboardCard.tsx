import Link from "next/link";
import { ArrowRight, type LucideIcon } from "lucide-react";

// One My Farm section: a white panel with a tinted icon tile, a title,
// an optional one-line subtitle and an optional "go to the full feature"
// link in the corner. The dashboard only summarises -- every card hands
// off to the existing page that owns the data. `tone` is a full class
// string (not an interpolated fragment) so Tailwind can see it, as in
// productPillars.ts.
export function DashboardCard({
  icon: Icon,
  tone,
  title,
  subtitle,
  href,
  linkLabel,
  className = "",
  children,
}: {
  icon: LucideIcon;
  tone: string;
  title: string;
  subtitle?: string;
  href?: string;
  linkLabel?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-2xl border border-shamba-line bg-shamba-card p-4 shadow-[0_1px_2px_rgb(38_49_31/0.04),0_4px_16px_-8px_rgb(38_49_31/0.08)] sm:p-5 ${className}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <span className={`inline-flex size-10 shrink-0 items-center justify-center rounded-xl ${tone}`}>
            <Icon className="size-5" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h3 className="truncate font-display text-lg font-semibold leading-tight tracking-tight text-shamba-ink">
              {title}
            </h3>
            {subtitle && <p className="truncate text-xs leading-5 text-shamba-ink-soft">{subtitle}</p>}
          </div>
        </div>
        {href && linkLabel && (
          <Link
            href={href}
            className="relative mt-1.5 inline-flex shrink-0 items-center gap-1 rounded-full px-1 font-sans text-sm font-semibold text-shamba-green transition-colors hover:text-shamba-green-deep touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shamba-green"
          >
            {linkLabel}
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  );
}

// A labelled group of cards ("Today", "Your farm", ...): a small heading
// with a hairline rule, so the page reads as a few clear zones rather
// than one long run of equal cards.
export function DashboardZone({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <h2
          id={id}
          className="shrink-0 font-display text-sm font-semibold uppercase tracking-wider text-shamba-ink-soft"
        >
          {title}
        </h2>
        <span className="h-px flex-1 bg-shamba-line" aria-hidden="true" />
      </div>
      {children}
    </section>
  );
}

// The plain one-line "nothing here yet" state every section falls back
// to, with an optional link to where the farmer can fix it.
export function EmptyLine({
  children,
  href,
  linkLabel,
}: {
  children: React.ReactNode;
  href?: string;
  linkLabel?: string;
}) {
  return (
    <p className="rounded-xl bg-shamba-bg px-3.5 py-3 text-sm leading-6 text-shamba-ink-soft">
      {children}
      {href && linkLabel && (
        <>
          {" "}
          <Link
            href={href}
            className="relative rounded-shamba font-semibold text-shamba-green underline-offset-2 hover:underline touch-target focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shamba-green"
          >
            {linkLabel}
          </Link>
        </>
      )}
    </p>
  );
}

// Shown while a streamed section loads: same card frame, grey bars.
export function DashboardCardSkeleton({ label, lines = 2 }: { label: string; lines?: number }) {
  return (
    <section
      role="status"
      aria-label={`Loading ${label}`}
      className="rounded-2xl border border-shamba-line bg-shamba-card p-4 sm:p-5"
    >
      <div className="flex items-center gap-3">
        <div className="size-10 animate-pulse rounded-xl bg-shamba-line" />
        <div className="h-5 w-36 animate-pulse rounded bg-shamba-line" />
      </div>
      <div className="mt-4 flex flex-col gap-2">
        {Array.from({ length: lines }, (_, index) => (
          <div key={index} className="h-4 w-full animate-pulse rounded bg-shamba-bg" />
        ))}
      </div>
    </section>
  );
}
