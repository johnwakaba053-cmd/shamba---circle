import type { SupabaseClient } from "@supabase/supabase-js";

// Deliberately narrower than PostMediaItem (lib/postMedia.ts): listing
// photos are images-only for this stage (the listing-media bucket itself
// only accepts image/jpeg, image/png, image/webp -- see the Stage 1
// migration), so there is no mediaType branch to carry yet. Only `id`
// and the already-resolved signed `url` are exposed -- never the raw
// storage_path, matching postMedia.ts's own discipline of never handing
// a raw private-bucket path to the UI.
export type ListingMediaItem = {
  id: string;
  url: string;
};

const SIGNED_URL_EXPIRY_SECONDS = 3600;

// Same batched-query shape as fetchPostMediaByPostId: one query for
// every listing's media rows across the whole page, then one batch of
// signed-URL mints, rather than a query per listing (N+1). Relies
// entirely on listing_media's own RLS (open SELECT, mirroring listings'
// own open-read policy -- see the Stage 1 migration) to scope results;
// no extra filtering needed here.
//
// Errors are swallowed the same way postMedia.ts's own fetch does (only
// `data` is read, `error` is discarded) -- a missing table, a transient
// query failure, or a listing with zero rows all resolve to the same
// "nothing to render" outcome via the empty Map return, so a caller
// never needs to distinguish "no photos" from "media temporarily
// unavailable." This is what keeps a zero-media listing rendering
// exactly as it does today, with no special-casing required at the call
// site, even before Stage 1's migration has been applied anywhere this
// runs against.
export async function fetchListingMediaByListingId(
  supabase: SupabaseClient,
  listingIds: string[],
): Promise<Map<string, ListingMediaItem[]>> {
  const result = new Map<string, ListingMediaItem[]>();
  if (listingIds.length === 0) {
    return result;
  }

  const { data: mediaRows } = await supabase
    .from("listing_media")
    .select("id, listing_id, storage_path")
    .in("listing_id", listingIds)
    .order("created_at", { ascending: true });

  if (!mediaRows || mediaRows.length === 0) {
    return result;
  }

  const signedUrlResults = await Promise.all(
    mediaRows.map((row) =>
      supabase.storage
        .from("listing-media")
        .createSignedUrl(row.storage_path, SIGNED_URL_EXPIRY_SECONDS),
    ),
  );

  mediaRows.forEach((row, index) => {
    const url = signedUrlResults[index]?.data?.signedUrl;
    if (!url) return;

    const existing = result.get(row.listing_id) ?? [];
    existing.push({ id: row.id, url });
    result.set(row.listing_id, existing);
  });

  return result;
}

// Edit-only shape: includes storagePath, unlike ListingMediaItem above.
// This is a deliberate, narrow exception to "never expose storage_path
// to the UI" -- the edit form needs the actual object path to call
// storage.remove() when the seller removes an existing photo (Storage
// has no "delete by row id" API, only delete-by-path), not to display
// or link to it anywhere. Kept as its own type/function rather than
// widening ListingMediaItem, so the browse/detail read paths continue
// to receive only {id, url} exactly as before.
export type EditableListingMediaItem = {
  id: string;
  storagePath: string;
  url: string;
};

// Single-listing, not batched -- only ever called from the edit page for
// the one listing being edited, unlike fetchListingMediaByListingId's
// whole-page batching.
export async function fetchEditableListingMedia(
  supabase: SupabaseClient,
  listingId: string,
): Promise<EditableListingMediaItem[]> {
  const { data: mediaRows } = await supabase
    .from("listing_media")
    .select("id, storage_path")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: true });

  if (!mediaRows || mediaRows.length === 0) {
    return [];
  }

  const signedUrlResults = await Promise.all(
    mediaRows.map((row) =>
      supabase.storage
        .from("listing-media")
        .createSignedUrl(row.storage_path, SIGNED_URL_EXPIRY_SECONDS),
    ),
  );

  const items: EditableListingMediaItem[] = [];
  mediaRows.forEach((row, index) => {
    const url = signedUrlResults[index]?.data?.signedUrl;
    if (!url) return;
    items.push({ id: row.id, storagePath: row.storage_path, url });
  });

  return items;
}
