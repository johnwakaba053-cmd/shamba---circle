import type { Metadata } from "next";
import { cache } from "react";
import Link from "next/link";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { Lock, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { FeedErrorState } from "@/app/feed/FeedErrorState";
import { FeedHeaderVisibilityProvider } from "@/app/feed/FeedHeaderVisibility";
import { FeedTopBar } from "@/app/feed/FeedTopBar";
import { fetchReelById } from "@/app/feed/feedData";
import { ReelFeed } from "@/app/feed/ReelFeed";
import { RefreshStaleMedia } from "@/app/feed/RefreshStaleMedia";
import { configuredSiteOrigin, reelPath, withReturnTo } from "@/lib/reelUrl";

// One Farming Reel at its own URL, /reels/<posts.id> -- the address a
// Reel can be opened (and later shared) by. Deliberately not a second
// Reel implementation: the Reel is loaded by fetchReelById(), which
// assembles it with the Feed's own assembleReels(), and rendered by the
// Feed's own ReelFeed/ReelSlide -- same media, autoplay + mute, text
// card, caption, likes, comments and reactions, follow and delete.
//
// cache() makes generateMetadata() and the page share one lookup per
// request instead of querying twice.
const loadReel = cache(async (reelId: string) => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { user: null, lookup: null };
  }

  return { user, lookup: await fetchReelById(supabase, user.id, reelId) };
});

type ReelPageProps = { params: Promise<{ reelId: string }> };

const SITE_NAME = "Shamba Space";
const GENERIC_TITLE = "Farming Reel on Shamba Space";
const GENERIC_DESCRIPTION =
  "Watch this Farming Reel on Shamba Space — everything farming, in one space.";
const PREVIEW_IMAGE = { url: "/icons/icon-512.png", width: 512, height: 512, alt: SITE_NAME };

// The absolute origin for canonical/Open Graph URLs: the configured
// production origin (see lib/reelUrl.ts), else this request's own host.
async function siteOrigin(): Promise<string> {
  const configured = configuredSiteOrigin();
  if (configured) return configured;

  const requestHeaders = await headers();
  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host") ?? "localhost:3000";
  const proto = requestHeaders.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

// Link previews (WhatsApp, Facebook, X...) are fetched signed-out, and
// RLS gives a signed-out request nothing -- so every preview gets the
// GENERIC card below: site name, generic title/description, app icon,
// canonical URL. No caption, author, media URL, comment or count ever
// appears in metadata for anyone who couldn't already open the Reel.
// Only a signed-in viewer who can open it (status "ok") gets the
// author + caption excerpt, i.e. what the page itself is showing them.
// A malformed or unknown id is a real not-found (404), here and in the
// page. Nothing is indexed: these pages sit behind sign-in.
export async function generateMetadata({ params }: ReelPageProps): Promise<Metadata> {
  const { reelId } = await params;
  const [{ lookup }, origin] = await Promise.all([loadReel(reelId), siteOrigin()]);

  if (lookup?.status === "not_found") {
    notFound();
  }

  const canonical = reelPath(reelId);
  const shared: Metadata = {
    metadataBase: new URL(origin),
    alternates: { canonical },
    robots: { index: false, follow: false },
  };

  if (lookup?.status !== "ok") {
    return {
      ...shared,
      title: GENERIC_TITLE,
      description: GENERIC_DESCRIPTION,
      openGraph: {
        type: "website",
        siteName: SITE_NAME,
        url: canonical,
        title: GENERIC_TITLE,
        description: GENERIC_DESCRIPTION,
        images: [PREVIEW_IMAGE],
      },
      twitter: {
        card: "summary",
        title: GENERIC_TITLE,
        description: GENERIC_DESCRIPTION,
        images: [PREVIEW_IMAGE.url],
      },
    };
  }

  const title = `${lookup.reel.authorDisplayName} on ${SITE_NAME}`;
  const caption = lookup.reel.body.replace(/\s+/g, " ").trim();
  const description = caption
    ? caption.length > 150
      ? `${caption.slice(0, 147)}…`
      : caption
    : GENERIC_DESCRIPTION;

  return {
    ...shared,
    title,
    description,
    openGraph: {
      type: "article",
      siteName: SITE_NAME,
      url: canonical,
      title,
      description,
      publishedTime: lookup.reel.createdAt,
      images: [PREVIEW_IMAGE],
    },
    twitter: { card: "summary", title, description, images: [PREVIEW_IMAGE.url] },
  };
}

export default async function ReelPage({ params }: ReelPageProps) {
  const { reelId } = await params;
  const { user, lookup } = await loadReel(reelId);

  if (!user || !lookup) {
    // Signed out: sign in first, then come straight back to this Reel.
    // Only a well-formed /reels/<uuid> is carried (see withReturnTo); the
    // Reel's own access rules run again normally once they're back.
    redirect(withReturnTo("/sign-in", reelPath(reelId)));
  }

  if (lookup.status === "not_found") {
    notFound();
  }

  return (
    // FeedHeaderVisibilityProvider is required by ReelFeed's scroll
    // wiring, exactly as on the Feed. ReelFeed brings its own playback
    // provider, so the Reel's video autoplays muted like in the Feed.
    <FeedHeaderVisibilityProvider>
      <div className="relative h-[100dvh] overflow-hidden bg-shamba-bg">
        <FeedTopBar href="/feed" label="Farming Reels" ariaLabel="Back to the Farming Reels feed" />

        {lookup.status === "error" && <FeedErrorState />}

        {lookup.status === "members_only" && (
          <main className="absolute inset-0 flex flex-col items-center justify-center px-6 pb-[env(safe-area-inset-bottom,0px)]">
            <div className="w-full max-w-sm rounded-shamba border border-shamba-line bg-shamba-card p-6 text-center">
              <Lock className="mx-auto size-8 text-shamba-ink-soft" aria-hidden="true" />
              <h1 className="mt-3 font-display text-xl font-bold text-shamba-ink">
                This Reel is shared in {lookup.communityName}
              </h1>
              <p className="mt-2 text-sm leading-6 text-shamba-ink-soft">
                Join the community to watch it and join the conversation.
              </p>
              <Link
                href={`/communities/${lookup.communityId}`}
                className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep"
              >
                <Users className="size-4" aria-hidden="true" />
                Open {lookup.communityName}
              </Link>
            </div>
          </main>
        )}

        {lookup.status === "ok" && (
          <main className="absolute inset-0 overflow-hidden">
            <RefreshStaleMedia issuedAt={lookup.mediaIssuedAt} />
            <ReelFeed reels={[lookup.reel]} nextCursor={null} />
          </main>
        )}
      </div>
    </FeedHeaderVisibilityProvider>
  );
}
