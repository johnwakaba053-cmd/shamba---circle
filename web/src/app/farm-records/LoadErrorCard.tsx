import Link from "next/link";
import { RotateCw } from "lucide-react";

// Shown instead of a page's content when something it needs failed to
// load -- a temporary failure, never "not found". Same card as the farm
// page's own load error.
export function LoadErrorCard({ title, detail, retryHref }: { title: string; detail: string; retryHref: string }) {
  return (
    <div role="alert" className="mt-4 rounded-shamba border border-shamba-line bg-shamba-card p-4">
      <p className="text-sm font-semibold text-shamba-rust">{title}</p>
      <p className="mt-1 text-sm leading-5 text-shamba-ink-soft">{detail}</p>
      {/* Navigating to this page again reloads it from the server (it is
          dynamic), and works as a plain link before scripts load. */}
      <Link
        href={retryHref}
        prefetch={false}
        className="mt-3 inline-flex min-h-11 items-center gap-1.5 font-sans text-sm font-semibold text-shamba-green hover:underline"
      >
        <RotateCw className="size-4" aria-hidden="true" />
        Try again
      </Link>
    </div>
  );
}
