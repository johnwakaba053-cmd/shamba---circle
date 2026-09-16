// Server-only. Pure logic, no I/O -- never logs, never throws, never
// guesses. A malformed or ambiguous number returns null; callers must
// treat that as "not usable," never attempt to repair it themselves.

// Kenyan mobile subscriber numbers: 9 digits after the 254 country
// code, starting with 7 (Safaricom/Airtel/Telkom's original mobile
// range) or 1 (the newer allocation range, e.g. Safaricom's 01xxxxxxxx
// numbers). Landline ranges and anything else are deliberately not
// treated as SMS-capable here.
const KENYA_MOBILE_LOCAL_PATTERN = /^[17]\d{8}$/;

// Accepts the four common shapes a farmer's number might already be
// stored/entered in -- 0712345678, 712345678, 254712345678,
// +254712345678 -- and normalizes each to +254XXXXXXXXX. Anything that
// doesn't cleanly fit one of those exact shapes (wrong length, extra
// characters, a non-mobile prefix) returns null rather than being
// coerced into a best guess.
export function normalizeKenyanPhone(raw: string | null | undefined): string | null {
  if (typeof raw !== "string") return null;

  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Only an optional leading + and digits are meaningful. Letters,
  // spaces, multiple +'s, etc. make the input ambiguous, not something
  // to strip and guess through.
  if (!/^\+?\d+$/.test(trimmed)) return null;

  const digits = trimmed.startsWith("+") ? trimmed.slice(1) : trimmed;

  let local: string;
  if (digits.startsWith("254") && digits.length === 12) {
    local = digits.slice(3);
  } else if (digits.startsWith("0") && digits.length === 10) {
    local = digits.slice(1);
  } else if (digits.length === 9) {
    local = digits;
  } else {
    return null; // ambiguous length -- never guess
  }

  if (!KENYA_MOBILE_LOCAL_PATTERN.test(local)) return null;

  return `+254${local}`;
}
