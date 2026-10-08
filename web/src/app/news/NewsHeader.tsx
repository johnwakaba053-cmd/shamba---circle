import Link from "next/link";
import { Newspaper, Sprout } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";

// The header on /news pages. Signed-in farmers get the normal AppHeader,
// unchanged. Signed-out readers -- News is public -- get a slim version
// with the same brand row and the same tab baseline, but only the News
// tab (every other tab would just send them to sign-in) and a Sign in
// button in place of Notifications / Profile / Sign out.
//
// Gutters and heights match AppHeader so the page below lines up the
// same way whether or not the reader is signed in.
export function NewsHeader({ signedIn }: { signedIn: boolean }) {
  if (signedIn) {
    return <AppHeader />;
  }

  return (
    <header className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-6 pt-2 sm:gap-2 sm:px-10 sm:pt-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/"
          className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-shamba px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-shamba-green"
        >
          <Sprout className="size-6 text-shamba-green" aria-hidden="true" />
          <span className="font-display text-lg font-medium tracking-tight text-shamba-ink">
            Shamba Space
          </span>
        </Link>

        <Link
          href="/sign-in"
          className="inline-flex min-h-11 items-center justify-center rounded-shamba bg-shamba-green px-4 font-sans text-sm font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep"
        >
          Sign in
        </Link>
      </div>

      <div className="border-b border-shamba-line">
        <nav aria-label="Main" className="flex items-center sm:-mx-2">
          {/* The same "you are here" notebook tab NavLink draws, kept
              static: it's the only tab, and always the current one. */}
          <Link
            href="/news"
            aria-current="page"
            className="relative isolate -ml-2 inline-flex min-h-11 items-center gap-2 rounded-shamba px-2 font-sans text-sm font-semibold text-shamba-green focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-shamba-green sm:ml-0"
          >
            <span
              aria-hidden="true"
              className="absolute inset-0 -z-10 rounded-t-shamba border border-b-0 border-shamba-line bg-shamba-card"
            />
            <Newspaper className="size-4" aria-hidden="true" />
            News
            <span aria-hidden="true" className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-shamba-green" />
          </Link>
        </nav>
      </div>
    </header>
  );
}
