import type { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

// Education guide covers (20261012120000): openly licensed photos in the
// PRIVATE 'education-media' bucket. As with lib/newsMedia.ts, there are
// no public URLs: a page asks for short-lived signed URLs with the
// reader's own session, so Storage's policy decides (signed-in readers
// get files of published guides only). One query and one signing request
// per page, however many covers.
//
// Covers are loaded in their own query, not added to the pages' main
// selects, so a database where the migration hasn't been applied yet
// (no cover columns) simply shows no covers instead of failing the page.
const SIGNED_URL_SECONDS = 60 * 60;

// The licences the migration accepts, with the attribution label and the
// licence deed to link to. A value not listed here is never shown.
const LICENCES: Record<string, { label: string; url: string | null }> = {
  "cc0-1.0": { label: "CC0 1.0", url: "https://creativecommons.org/publicdomain/zero/1.0/" },
  "public-domain": { label: "Public domain", url: null },
  "cc-by-2.0": { label: "CC BY 2.0", url: "https://creativecommons.org/licenses/by/2.0/" },
  "cc-by-3.0": { label: "CC BY 3.0", url: "https://creativecommons.org/licenses/by/3.0/" },
  "cc-by-4.0": { label: "CC BY 4.0", url: "https://creativecommons.org/licenses/by/4.0/" },
  "cc-by-sa-2.0": { label: "CC BY-SA 2.0", url: "https://creativecommons.org/licenses/by-sa/2.0/" },
  "cc-by-sa-3.0": { label: "CC BY-SA 3.0", url: "https://creativecommons.org/licenses/by-sa/3.0/" },
  "cc-by-sa-4.0": { label: "CC BY-SA 4.0", url: "https://creativecommons.org/licenses/by-sa/4.0/" },
};

// Same file-name rule as the migration's check constraint.
const COVER_PATH_PATTERN = /^[a-z0-9]+(-[a-z0-9]+)*\/[a-z0-9]+(-[a-z0-9]+)*\.(webp|jpg|jpeg)$/;

export type EducationCover = {
  src: string;
  alt: string;
  credit: string;
  licenceLabel: string;
  licenceUrl: string | null;
  // The original file's page: the "source" of the attribution.
  sourceUrl: string;
};

type CoverRow = {
  id: string;
  cover_image_path: string | null;
  cover_thumb_path: string | null;
  cover_image_alt: string | null;
  cover_image_credit: string | null;
  cover_image_licence: string | null;
  cover_image_source_url: string | null;
};

// Postgres "undefined column": the cover migration isn't applied here.
const UNDEFINED_COLUMN = "42703";

function isHttpsUrl(value: string): boolean {
  try {
    return new URL(value).protocol === "https:";
  } catch {
    return false;
  }
}

// The database already enforces all of this; checked again so a row that
// somehow slips through is left out rather than shown half-attributed.
function isCompleteCover(row: CoverRow): boolean {
  const inOwnFolder = (path: string | null) =>
    path === null || (COVER_PATH_PATTERN.test(path) && path.split("/")[0] === row.id);
  return (
    row.cover_image_path !== null &&
    inOwnFolder(row.cover_image_path) &&
    inOwnFolder(row.cover_thumb_path) &&
    Boolean(row.cover_image_alt?.trim()) &&
    Boolean(row.cover_image_credit?.trim()) &&
    row.cover_image_licence !== null &&
    row.cover_image_licence in LICENCES &&
    row.cover_image_source_url !== null &&
    isHttpsUrl(row.cover_image_source_url)
  );
}

// Covers for the given published guides, keyed by guide id. `size`
// picks the file: "card" signs the 640px card image (the full cover when
// a guide has none), "page" the full cover. Guides without a complete
// cover, or whose file the reader can't be given a URL for, are simply
// missing from the map. Never rejects.
export async function fetchEducationCovers(
  supabase: ServerClient,
  ids: string[],
  size: "card" | "page",
): Promise<Map<string, EducationCover>> {
  const covers = new Map<string, EducationCover>();
  const wanted = new Set(ids);
  if (wanted.size === 0) return covers;

  try {
    // Only guides that have a cover (a handful), rather than an id list as
    // long as the Learning Library; filtered to `ids` below.
    const { data, error } = await supabase
      .from("education_resources")
      .select(
        "id, cover_image_path, cover_thumb_path, cover_image_alt, cover_image_credit, cover_image_licence, cover_image_source_url",
      )
      .eq("is_published", true)
      .not("cover_image_path", "is", null);
    if (error) {
      if (error.code !== UNDEFINED_COLUMN) {
        console.error("[education] covers unavailable:", error.message);
      }
      return covers;
    }

    const rows = ((data ?? []) as CoverRow[]).filter((row) => wanted.has(row.id) && isCompleteCover(row));
    const fileFor = (row: CoverRow) =>
      (size === "card" ? (row.cover_thumb_path ?? row.cover_image_path) : row.cover_image_path) as string;
    if (rows.length === 0) return covers;

    const { data: signed } = await supabase.storage
      .from("education-media")
      .createSignedUrls(rows.map(fileFor), SIGNED_URL_SECONDS);
    const urls = new Map<string, string>();
    for (const item of signed ?? []) {
      if (item.path && item.signedUrl && !item.error) urls.set(item.path, item.signedUrl);
    }

    for (const row of rows) {
      const src = urls.get(fileFor(row));
      if (!src) continue;
      const licence = LICENCES[row.cover_image_licence as string];
      covers.set(row.id, {
        src,
        alt: (row.cover_image_alt as string).trim(),
        credit: (row.cover_image_credit as string).trim(),
        licenceLabel: licence.label,
        licenceUrl: licence.url,
        sourceUrl: row.cover_image_source_url as string,
      });
    }
  } catch (err) {
    console.error("[education] covers unavailable:", err instanceof Error ? err.message : err);
  }
  return covers;
}
