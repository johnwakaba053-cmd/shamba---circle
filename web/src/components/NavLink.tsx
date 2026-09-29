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

  return (
    <Link
      ref={ref}
      href={href}
      aria-label={ariaLabel}
      aria-current={isActive ? "page" : undefined}
      className={`-mb-px inline-flex items-center gap-2 border-b-2 pt-1 pb-2 font-sans text-sm font-semibold transition-colors ${
        isActive
          ? "border-shamba-green text-shamba-green"
          : "border-transparent text-shamba-ink-soft hover:text-shamba-ink"
      }`}
    >
      {children}
    </Link>
  );
}
