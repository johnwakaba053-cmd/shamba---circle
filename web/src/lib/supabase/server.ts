import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

/**
 * Supabase client for use in Server Components, Server Actions, and
 * Route Handlers. Reads env vars at call time, not at module load, so
 * this file can be imported safely even when NEXT_PUBLIC_SUPABASE_URL /
 * _ANON_KEY aren't set yet (e.g. no .env.local during Phase 0).
 *
 * The setAll no-op/catch below is the standard @supabase/ssr pattern:
 * a Server Component can't write cookies, only Server Actions and Route
 * Handlers can. Writing an actual session-refresh middleware is deferred
 * to the authentication step, not included here.
 *
 * No auth, profile, or role logic here yet — this is just the client
 * factory those later steps will build on.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component during render, which can't
            // set cookies. Safe to ignore once a session-refresh
            // middleware exists (added in the auth step) to keep
            // sessions current instead.
          }
        },
      },
    },
  );
}
