import type { EducationCover } from "@/lib/educationMedia";

// The attribution every cover carries wherever it is shown: who made the
// photo and under which licence. On the guide page (`linked`) the credit
// links to the original file and the licence to its deed, as CC licences
// ask; on cards it is plain text, so a card keeps its two links.
export function CoverCredit({ cover, linked = false }: { cover: EducationCover; linked?: boolean }) {
  const linkClass =
    "font-semibold text-shamba-blue underline-offset-2 transition-colors hover:text-shamba-green-deep hover:underline";

  return (
    <>
      Photo:{" "}
      {linked ? (
        <a href={cover.sourceUrl} target="_blank" rel="noopener noreferrer" className={linkClass}>
          {cover.credit}
        </a>
      ) : (
        cover.credit
      )}
      {" · "}
      {linked && cover.licenceUrl ? (
        <a href={cover.licenceUrl} target="_blank" rel="noopener noreferrer license" className={linkClass}>
          {cover.licenceLabel}
        </a>
      ) : (
        cover.licenceLabel
      )}
    </>
  );
}
