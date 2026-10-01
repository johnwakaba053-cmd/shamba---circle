"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);

  async function handleSignOut() {
    if (isLoading) return;
    setIsLoading(true);

    const supabase = createClient();
    await supabase.auth.signOut();

    router.push("/");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      // Last item of the phone nav strip: keep it fully in view on focus.
      onFocus={(event) => event.currentTarget.scrollIntoView({ block: "nearest", inline: "nearest" })}
      disabled={isLoading}
      className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-shamba px-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-rust focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-shamba-green disabled:cursor-not-allowed disabled:opacity-70"
    >
      {isLoading ? (
        <Loader2 className="size-4 animate-spin" aria-hidden="true" />
      ) : (
        <LogOut className="size-4" aria-hidden="true" />
      )}
      Sign out
    </button>
  );
}
