import Link from "next/link";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { DashboardCard, EmptyLine } from "./DashboardCard";

// My Farm's communities: the ones the farmer has joined (their own
// community_memberships rows -- RLS shows nobody else's), each a shortcut
// into the conversation. No suggestions from crops: community ids don't
// line up with crop/livestock types, so any match would be a guess.

type JoinedCommunity = { id: string; name: string; emoji: string | null };

export type FarmCommunitiesResult = { ok: true; communities: JoinedCommunity[] } | { ok: false };

export async function loadFarmCommunities(userId: string): Promise<FarmCommunitiesResult> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("community_memberships")
      .select("community_id, communities(name, emoji)")
      .eq("profile_id", userId);
    if (error) {
      console.error("[my-farm] communities unavailable:", error.message);
      return { ok: false };
    }
    const communities = (data ?? [])
      .map((row) => {
        const community = Array.isArray(row.communities) ? row.communities[0] : row.communities;
        return {
          id: row.community_id as string,
          name: (community?.name as string | undefined) ?? row.community_id,
          emoji: (community?.emoji as string | null | undefined) ?? null,
        };
      })
      .sort((a, b) => a.name.localeCompare(b.name));
    return { ok: true, communities };
  } catch (err) {
    console.error("[my-farm] communities unavailable:", err instanceof Error ? err.message : err);
    return { ok: false };
  }
}

export async function CommunitiesSection({ communities }: { communities: Promise<FarmCommunitiesResult> }) {
  return <CommunitiesCard result={await communities} />;
}

export function CommunitiesCard({ result }: { result: FarmCommunitiesResult }) {
  return (
    <DashboardCard
      icon={Users}
      tone="bg-shamba-green/10 text-shamba-green"
      title="Your communities"
      subtitle="Groups you've joined"
      href="/communities"
      linkLabel="All"
    >
      {!result.ok ? (
        <EmptyLine href="/communities" linkLabel="Open Communities">
          We couldn&apos;t load your communities right now.
        </EmptyLine>
      ) : result.communities.length === 0 ? (
        <EmptyLine href="/communities" linkLabel="Find your community">
          You haven&apos;t joined a community yet.
        </EmptyLine>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {result.communities.map((community) => (
            <li key={community.id}>
              <Link
                href={`/communities/${community.id}`}
                className="inline-flex min-h-11 items-center gap-2 rounded-full border border-shamba-line bg-shamba-bg px-4 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:border-shamba-green hover:bg-shamba-green/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-shamba-green"
              >
                {community.emoji && <span aria-hidden="true">{community.emoji}</span>}
                {community.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </DashboardCard>
  );
}
