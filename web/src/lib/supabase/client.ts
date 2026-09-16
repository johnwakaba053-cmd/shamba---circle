import { createBrowserClient } from "@supabase/ssr";

/**
 * Supabase client for use in Client Components (anything with "use client").
 * Reads env vars at call time, not at module load, so this file can be
 * imported safely even when NEXT_PUBLIC_SUPABASE_URL / _ANON_KEY aren't
 * set yet (e.g. no .env.local during Phase 0).
 *
 * No auth, profile, or role logic here yet — this is just the client
 * factory those later steps will build on.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
