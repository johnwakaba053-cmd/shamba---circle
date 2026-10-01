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
export function AppHeader() {
  return (
    <header className="mx-auto flex w-full max-w-5xl flex-col gap-2 px-4 pt-4 pb-2 sm:gap-3 sm:px-10 sm:pt-6 sm:pb-3">
      <div className="flex items-center justify-between gap-2">
        <Link href="/communities" className="flex items-center gap-2">
          <Sprout className="size-6 text-shamba-green" aria-hidden="true" />
          <span className="font-display text-lg font-medium tracking-tight text-shamba-ink">
            Shamba Space
          </span>
        </Link>

        <div className="flex items-center gap-6">
          <NotificationBell />
          <span className="hidden sm:contents">
            <ProfileNavLink />
            <span className="pb-1">
              <SignOutButton />
            </span>
          </span>
        </div>
      </div>

      <div className="relative -mx-4 sm:mx-0">
        <nav
          aria-label="Main"
          className="flex items-center gap-5 overflow-x-auto whitespace-nowrap border-b border-shamba-line pl-4 pr-10 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:flex-wrap sm:gap-x-6 sm:gap-y-1 sm:overflow-visible sm:px-0"
        >
          <NavLink href="/communities">
            <Users className="size-4" aria-hidden="true" />
            Communities
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

          <NavLink href="/farm-records">
            <ClipboardList className="size-4" aria-hidden="true" />
            Farm Records
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
            <span className="pb-1">
              <SignOutButton />
            </span>
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
