import Link from "next/link";
import { BookOpen, Rss, Sprout, Store, UserRound, Users } from "lucide-react";
import { SignOutButton } from "./SignOutButton";

// Shared across every authenticated page. Communities' original inline
// header is the visual source of truth this was extracted from — kept
// as one component now that six pages need the identical markup, rather
// than the per-page duplication convention this project used while only
// one or two pages needed it.
export function AppHeader() {
  return (
    <header className="mx-auto flex w-full max-w-5xl flex-wrap items-center justify-between gap-y-2 gap-x-2 px-6 py-6 sm:px-10">
      <div className="flex items-center gap-2">
        <Sprout className="size-6 text-shamba-green" aria-hidden="true" />
        <span className="font-display text-lg font-medium tracking-tight text-shamba-ink">
          Shamba Circle
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4">
        <Link
          href="/communities"
          className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink"
        >
          <Users className="size-4" aria-hidden="true" />
          Communities
        </Link>

        <Link
          href="/feed"
          className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink"
        >
          <Rss className="size-4" aria-hidden="true" />
          Feed
        </Link>

        <Link
          href="/marketplace"
          className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink"
        >
          <Store className="size-4" aria-hidden="true" />
          Marketplace
        </Link>

        <Link
          href="/education"
          className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink"
        >
          <BookOpen className="size-4" aria-hidden="true" />
          Education
        </Link>

        <Link
          href="/profile"
          className="inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink"
        >
          <UserRound className="size-4" aria-hidden="true" />
          Profile
        </Link>

        <SignOutButton />
      </div>
    </header>
  );
}
