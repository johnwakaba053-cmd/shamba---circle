"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";

// One AppHeader nav item. The only client-side part of the header: it
// needs the current path to mark "you are here" (aria-current + green
// underline), and on phones -- where the nav is a single sideways-
// scrolling row -- to bring the current item into view, so a farmer on
// /profile isn't left looking at a row that starts at Communities.
export function NavLink({
  href,
  children,
  ariaLabel,
  exact = false,
}: {
  href: string;
  children: React.ReactNode;
  ariaLabel?: string;
  // Only the exact path counts as "here" -- for /profile, where
  // /profile/<id> is someone else's profile, not the farmer's own.
  exact?: boolean;
}) {
  const pathname = usePathname();
  const isActive = pathname === href || (!exact && pathname.startsWith(`${href}/`));
  const ref = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (isActive) {
      ref.current?.scrollIntoView({ block: "nearest", inline: "center" });
    }
  }, [isActive]);

  // 44px-tall target; the focus ring is inset so the nav strip's
  // overflow-x-auto (which also clips vertically) can't cut it off.
  // onFocus: browsers skip scrolling a half-visible link into view, so a
  // keyboard user could land on a tab cut off at the strip's edge.
  // Active: a Card Cream notebook tab -- hairline top/sides, square bottom
  // resting on the nav baseline. Drawn as an absolutely positioned layer
  // (behind the label via `isolate` + -z-10) so it takes no layout space
  // and selecting a tab never shifts the row.
  return (
    <Link
      ref={ref}
      href={href}
      aria-label={ariaLabel}
      aria-current={isActive ? "page" : undefined}
      onFocus={(event) => event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" })}
      className={`group relative isolate inline-flex min-h-11 shrink-0 items-center gap-2 rounded-shamba px-2 font-sans text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-shamba-green ${
        isActive ? "text-shamba-green" : "text-shamba-ink-soft hover:text-shamba-ink"
      }`}
    >
      {/* The tab layer paints over the link's own inset focus ring, so it
          carries the ring itself while the link has keyboard focus. */}
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute inset-0 -z-10 rounded-t-shamba border border-b-0 border-shamba-line bg-shamba-card group-focus-visible:ring-2 group-focus-visible:ring-inset group-focus-visible:ring-shamba-green"
        />
      )}
      {children}
      {/* Active marker: a rounded bar under the label, so the current
          page never relies on text colour alone. */}
      {isActive && (
        <span
          aria-hidden="true"
          className="absolute inset-x-2 bottom-0 h-[3px] rounded-full bg-shamba-green"
        />
      )}
    </Link>
  );
}
