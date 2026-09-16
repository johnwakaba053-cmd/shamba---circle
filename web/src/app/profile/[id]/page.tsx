import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { Lock, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";

const ROLE_LABELS: Record<string, string> = {
  farmer: "Farmer",
  buyer: "Buyer",
  seller: "Seller",
};

type PublicProfileRow = {
  profile_id: string;
  display_name: string | null;
  is_public: boolean;
  roles: string[] | null;
};

export default async function PublicProfile({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  // Never queries public.profiles directly — the SECURITY DEFINER
  // function is the only path to another user's profile data, and it
  // structurally cannot return phone/email/etc. since those columns are
  // never selected inside it, regardless of profile_visibility.
  const { data, error } = await supabase.rpc("get_public_profile", {
    p_profile_id: id,
  });

  const profile = (data as PublicProfileRow[] | null)?.[0];

  if (!error && !profile) {
    notFound();
  }

  const isOwnProfile = id === user.id;
  const isVisible = Boolean(profile && profile.display_name !== null);

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        <div className="w-full max-w-sm rounded-shamba border border-shamba-line bg-shamba-card p-6 sm:p-8">
          {error && (
            <p role="alert" className="text-sm font-semibold text-shamba-rust">
              We couldn&apos;t load this profile right now. Please try again later.
            </p>
          )}

          {!error && profile && !isVisible && (
            <>
              <Lock className="size-7 text-shamba-ink-soft" aria-hidden="true" />
              <h1 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink">
                This profile is private
              </h1>
              <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
                This farmer has chosen to keep their profile private.
              </p>
            </>
          )}

          {!error && profile && isVisible && (
            <>
              <UserRound className="size-7 text-shamba-green" aria-hidden="true" />
              <h1 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink">
                {profile.display_name}
              </h1>

              {profile.roles && profile.roles.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {profile.roles.map((role) => (
                    <span
                      key={role}
                      className="rounded-shamba border border-shamba-line bg-shamba-bg px-2 py-1 font-mono text-xs font-semibold text-shamba-ink-soft"
                    >
                      {ROLE_LABELS[role] ?? role}
                    </span>
                  ))}
                </div>
              )}

              {isOwnProfile && (
                <Link
                  href="/profile"
                  className="mt-4 inline-flex items-center justify-center rounded-shamba border border-shamba-line px-6 py-3 font-sans text-base font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg"
                >
                  Manage your profile
                </Link>
              )}
            </>
          )}
        </div>
      </main>
    </div>
  );
}
