import Link from "next/link";

// Small reusable link from a display name to its owner's public profile.
// Always keyed by the real profile id, never by the name text. className
// is supplied by each call site to preserve that context's existing
// typography exactly — this only adds navigation and a hover affordance.
export function ProfileLink({
  profileId,
  displayName,
  className = "font-semibold text-shamba-ink",
}: {
  profileId: string;
  displayName: string;
  className?: string;
}) {
  return (
    <Link
      href={`/profile/${profileId}`}
      className={`${className} transition-colors hover:text-shamba-green`}
    >
      {displayName}
    </Link>
  );
}
