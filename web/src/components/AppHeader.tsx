import Link from "next/link";
import {
  BookOpen,
  Clapperboard,
  ClipboardList,
  CloudSun,
  MessageCircle,
  Sprout,
  Store,
  TrendingUp,
  UserRound,
  Users,
} from "lucide-react";
import { NavLink } from "./NavLink";
import { NotificationBell } from "./NotificationBell";
import { SignOutButton } from "./SignOutButton";

// Shared across every authenticated page. Communities' original inline
// header is the visual source of truth this was extracted from — kept
// as one component now that six pages need the identical markup, rather
// than the per-page duplication convention this project used while only
// one or two pages needed it.
//
// Layout: every destination is a labelled item (icon AND word, never an
// icon alone). Top row: brand, then the farmer's own things --
// Notifications (with its unread count) always, plus Profile and Sign
// out from sm up. Second row: the places to go, in the landing page's
// pillar order (Communities, Farming Reels, Weather, Marketplace) then
// Messages and the rest. On phones that row scrolls sideways instead of
// wrapping (a fade on the right edge shows there's more), and Profile /
// Sign out sit at its end since the top row has no room for them.
//
// Gutters: px-6 / sm:px-10 matches the <main> of the pages below it, so
// the Sprout mark, the first tab's label and page content share one left
// edge. Every item is a 44px-tall target with px-2 of its own; the -mx-2
// / pl-4 offsets cancel that padding so labels (not hit areas) align.
export function AppHeader() {
  return (
    <header className="mx-auto flex w-full max-w-5xl flex-col gap-1 px-6 pt-2 sm:gap-2 sm:px-10 sm:pt-4">
      <div className="flex items-center justify-between gap-2">
        <Link
          href="/communities"
          className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-shamba px-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-shamba-green"
        >
          <Sprout className="size-6 text-shamba-green" aria-hidden="true" />
          <span className="font-display text-lg font-medium tracking-tight text-shamba-ink">
            Shamba Space
          </span>
        </Link>

        <div className="-mr-2 flex items-center">
          <NotificationBell />
          <span className="hidden sm:contents">
            <ProfileNavLink />
            <SignOutButton />
          </span>
        </div>
      </div>

      <div className="relative -mx-6 border-b border-shamba-line sm:mx-0">
        <nav
          aria-label="Main"
          className="flex items-center overflow-x-auto whitespace-nowrap scroll-pl-4 scroll-pr-10 pl-4 pr-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-2 sm:flex-wrap sm:overflow-visible sm:px-0"
        >
          <NavLink href="/communities">
            <Users className="size-4" aria-hidden="true" />
            Communities
          </NavLink>

          <NavLink href="/farm-records">
            <ClipboardList className="size-4" aria-hidden="true" />
            Farm Records
          </NavLink>

          <NavLink href="/feed">
            <Clapperboard className="size-4" aria-hidden="true" />
            Farming Reels
          </NavLink>

          <NavLink href="/weather">
            <CloudSun className="size-4" aria-hidden="true" />
            Weather &amp; Alerts
          </NavLink>

          <NavLink href="/marketplace">
            <Store className="size-4" aria-hidden="true" />
            Marketplace
          </NavLink>

          <NavLink href="/messages">
            <MessageCircle className="size-4" aria-hidden="true" />
            Messages
          </NavLink>

          <NavLink href="/market-prices">
            <TrendingUp className="size-4" aria-hidden="true" />
            Market Prices
          </NavLink>

          <NavLink href="/education">
            <BookOpen className="size-4" aria-hidden="true" />
            Education
          </NavLink>

          <span className="contents sm:hidden">
            <ProfileNavLink />
            <SignOutButton />
          </span>
        </nav>

        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-shamba-bg to-transparent sm:hidden"
        />
      </div>
    </header>
  );
}

function ProfileNavLink() {
  return (
    <NavLink href="/profile" exact>
      <UserRound className="size-4" aria-hidden="true" />
      Profile
    </NavLink>
  );
}
