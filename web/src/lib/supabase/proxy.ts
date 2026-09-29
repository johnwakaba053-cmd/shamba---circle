import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Session refresh for src/proxy.ts (Next.js 16's renamed Middleware),
 * following the standard @supabase/ssr pattern: Server Components can't
 * write cookies (see the no-op setAll in ./server.ts), so without this an
 * expired access token is refreshed per-render but the rotated tokens are
 * never saved back to the browser.
 *
 * This ONLY refreshes the session cookie. It deliberately does not
 * redirect anyone -- every protected page already does its own
 * getUser() + redirect("/sign-in"), and that behavior is unchanged.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // Must run immediately after createServerClient with nothing in
  // between: this is the call that refreshes an expired session and
  // triggers setAll above with the new cookies.
  await supabase.auth.getClaims();

  return response;
}
