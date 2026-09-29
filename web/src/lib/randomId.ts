/* eslint-disable no-restricted-properties -- this file IS the one sanctioned wrapper around crypto.randomUUID(). */
// A random RFC 4122 version-4 UUID, safe to call in EVERY browser context.
//
// crypto.randomUUID() only exists in secure contexts (HTTPS, localhost).
// On a phone testing against the dev server over the LAN
// (http://192.168.x.x:3000) it is undefined, and calling it threw right
// after a Feed post was created -- so the photo/video upload never ran
// and a caption-only post was left behind. crypto.getRandomValues() is
// available on plain HTTP too, so it's the fallback.
//
// ESLint (no-restricted-properties in eslint.config.mjs) forbids calling
// crypto.randomUUID() anywhere else, so this can't silently come back.
export function randomId(): string {
  if (typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }

  const bytes = crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40; // version 4
  bytes[8] = (bytes[8] & 0x3f) | 0x80; // RFC 4122 variant
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
