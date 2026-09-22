// Community conversation timestamps (message time-of-day and the
// TODAY/YESTERDAY/date separators) are always computed in Kenya time
// (Africa/Nairobi), explicitly, rather than left to whatever timezone
// happens to be ambient. Two different ambient timezones would each be
// wrong in their own way here: the server process's own OS timezone
// (a Vercel serverless function's is not guaranteed to be Nairobi, and
// defaulting to it risks the same class of UTC-midnight day-boundary
// mislabeling already found and fixed once before in this app's Price
// History work), and an individual farmer's device timezone (which a
// diaspora Kenyan checking a Kenya-based farming conversation may not
// want anyway, and which this Server Component has no reliable way to
// read regardless). Passing an explicit IANA `timeZone` to Intl makes
// every call below deterministic and correct wherever it runs, with no
// client-side code required.
const TIME_ZONE = "Africa/Nairobi";

// Compact 24-hour time-of-day, e.g. "14:07" -- short enough to sit next
// to a farmer's name on a 320px screen without wrapping or crowding it.
export function formatMessageTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("en-GB", {
    timeZone: TIME_ZONE,
    hour: "2-digit",
    minute: "2-digit",
  });
}

// en-CA gives a YYYY-MM-DD string -- a stable, directly comparable
// calendar-day key in Nairobi time. Never displayed itself.
function dayKey(iso: string): string {
  return new Date(iso).toLocaleDateString("en-CA", { timeZone: TIME_ZONE });
}

// Whether two instants fall on the same Nairobi calendar day -- used to
// decide both where to insert a date separator and where a same-author
// message burst must end (a burst never spans a day separator).
export function isSameDay(isoA: string, isoB: string): boolean {
  return dayKey(isoA) === dayKey(isoB);
}

// "TODAY" / "YESTERDAY" / "22 SEPTEMBER" -- `now` is injectable for
// testing but always defaults to the real current instant. Kenya has no
// DST, so a plain 24-hour subtraction is always exactly "the previous
// calendar day" here.
export function formatDaySeparator(iso: string, now: Date = new Date()): string {
  const key = dayKey(iso);

  if (key === dayKey(now.toISOString())) {
    return "TODAY";
  }

  const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  if (key === dayKey(yesterday.toISOString())) {
    return "YESTERDAY";
  }

  return new Date(iso)
    .toLocaleDateString("en-GB", {
      timeZone: TIME_ZONE,
      day: "numeric",
      month: "long",
    })
    .toUpperCase();
}
