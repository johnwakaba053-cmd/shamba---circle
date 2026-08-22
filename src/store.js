// Storage layer — currently backed by localStorage (this laptop/browser only).
// Swap the internals of these functions for Supabase calls later; the rest
// of the app only ever calls get()/set() so nothing else needs to change.

export async function get(key) {
  try {
    const raw = localStorage.getItem(key);
    return raw === null ? null : { key, value: raw };
  } catch (e) {
    return null;
  }
}

export async function set(key, value) {
  try {
    localStorage.setItem(key, value);
    return { key, value };
  } catch (e) {
    return null;
  }
}
