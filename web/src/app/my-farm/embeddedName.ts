// PostgREST returns a many-to-one embed (e.g. crop_types(name)) as an
// object, but the untyped Supabase client infers an array; accept either.
export function embeddedName(value: unknown): string | null {
  const row = Array.isArray(value) ? value[0] : value;
  return row && typeof row === "object" && "name" in row && typeof row.name === "string" ? row.name : null;
}
