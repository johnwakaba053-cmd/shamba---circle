import { redirect } from "next/navigation";
import Link from "next/link";
import { HelpCircle, PawPrint, Wheat } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";

const GROUP_ORDER = ["Crop Farmers", "Animal Farmers", "Other"] as const;
type GroupName = (typeof GROUP_ORDER)[number];

// One icon per group, not per community — keeps this simple rather than
// building a 26-entry icon mapping.
const GROUP_ICON: Record<GroupName, typeof Wheat> = {
  "Crop Farmers": Wheat,
  "Animal Farmers": PawPrint,
  Other: HelpCircle,
};

type Community = {
  id: string;
  name: string;
  group_name: string;
};

export default async function Communities() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: communities, error } = await supabase
    .from("communities")
    .select("id, name, group_name")
    .order("name");

  const grouped: Record<GroupName, Community[]> = {
    "Crop Farmers": [],
    "Animal Farmers": [],
    Other: [],
  };

  for (const community of communities ?? []) {
    const group = community.group_name as GroupName;
    if (grouped[group]) {
      grouped[group].push(community);
    }
  }

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-10 px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        <div>
          <h1 className="font-display text-3xl font-bold leading-tight tracking-tight text-shamba-ink">
            Communities
          </h1>
          <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
            Find farmers who share what you grow or raise.
          </p>
        </div>

        {error && (
          <p role="alert" className="text-sm font-semibold text-shamba-rust">
            We couldn&apos;t load communities right now. Please try again later.
          </p>
        )}

        {!error &&
          GROUP_ORDER.map((group) => {
            const items = grouped[group];
            if (items.length === 0) return null;
            const Icon = GROUP_ICON[group];

            return (
              <section key={group}>
                <h2 className="font-display text-lg font-semibold text-shamba-ink">
                  {group}
                </h2>
                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  {items.map((community) => (
                    <Link
                      key={community.id}
                      href={`/communities/${community.id}`}
                      className="flex items-center gap-3 rounded-shamba border border-shamba-line bg-shamba-card p-4 transition-colors hover:border-shamba-green"
                    >
                      <Icon
                        className="size-6 shrink-0 text-shamba-green"
                        aria-hidden="true"
                      />
                      <span className="font-sans text-base font-medium text-shamba-ink">
                        {community.name}
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            );
          })}
      </main>
    </div>
  );
}
