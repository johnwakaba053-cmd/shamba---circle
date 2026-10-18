"use server";

import { createClient } from "@/lib/supabase/server";
import { EXPERT_DOCUMENTS_BUCKET } from "@/lib/experts";
import { isAdmin } from "@/lib/staff";

// How long an admin's document link works. Made only when the admin taps
// Open, never at page load, so it doesn't expire before it's used.
const ADMIN_SIGNED_URL_EXPIRY_SECONDS = 60;

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type AdminDocumentLinkResult = { ok: true; url: string } | { ok: false };

// A short-lived signed link to one private expert document, made on the
// server as E1 intends. The caller is re-derived from the session and
// must be an admin; the document's storage path is looked up here (the
// admin-only RLS policy on expert_documents applies), never taken from
// the browser. The storage bucket's own policy checks is_admin() again
// when the link is signed.
export async function getExpertDocumentLink(documentId: string): Promise<AdminDocumentLinkResult> {
  if (typeof documentId !== "string" || !UUID_PATTERN.test(documentId)) {
    return { ok: false };
  }

  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user || !(await isAdmin(supabase))) {
      return { ok: false };
    }

    const { data: document, error } = await supabase
      .from("expert_documents")
      .select("storage_path")
      .eq("id", documentId)
      .maybeSingle();

    if (error || !document) {
      return { ok: false };
    }

    const { data, error: signError } = await supabase.storage
      .from(EXPERT_DOCUMENTS_BUCKET)
      .createSignedUrl(document.storage_path as string, ADMIN_SIGNED_URL_EXPIRY_SECONDS);

    if (signError || !data?.signedUrl) {
      return { ok: false };
    }

    return { ok: true, url: data.signedUrl };
  } catch {
    return { ok: false };
  }
}
