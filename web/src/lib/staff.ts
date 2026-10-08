import { notFound, redirect } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// Server-side gate for admin pages (Trust & Safety staff roles,
// 20260929140000). Signed-out visitors go to sign-in like every other
// page; signed-in non-admins get a plain 404, so admin routes don't
// reveal that they exist. This is only the page gate: every admin read
// and write is still enforced by RLS and the is_admin() checks inside the
// database functions.
export async function requireAdmin(): Promise<{ supabase: ServerClient; user: User }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  if (!(await isAdmin(supabase))) {
    notFound();
  }

  return { supabase, user };
}

// Asks the database about the caller only. Any error counts as "not an
// admin".
export async function isAdmin(supabase: ServerClient): Promise<boolean> {
  const { data, error } = await supabase.rpc("is_admin");
  return !error && data === true;
}
