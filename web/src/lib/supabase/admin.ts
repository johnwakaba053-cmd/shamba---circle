import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Service-role Supabase client for trusted server-side jobs only (e.g.
 * weather ingestion) -- bypasses RLS entirely, the same trust level as a
 * migration or the on_auth_user_created trigger. Never import this from
 * a Client Component or anything reachable from the browser:
 * SUPABASE_SERVICE_ROLE_KEY (no NEXT_PUBLIC_ prefix, so Next.js already
 * refuses to bundle it client-side) must never be exposed. Deliberately
 * a separate factory from lib/supabase/server.ts (anon key + the
 * caller's own cookie session) and lib/supabase/client.ts (anon key,
 * browser), so an accidental import of the wrong client is at least a
 * differently-named module, not a silent behavior change in an existing
 * shared file.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceRoleKey) {
    throw new Error(
      "createAdminClient: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must both be set",
    );
  }

  return createSupabaseClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
