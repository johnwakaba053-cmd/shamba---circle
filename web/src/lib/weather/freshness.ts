// Server-only, like currentWeather.ts and forecast.ts, which share it.
//
// Their 10-minute fetch cache is stale-while-revalidate: once it expires,
// the first request is still answered from the old entry while Next.js
// refreshes it in the background. For a county nobody has viewed in a
// while, that old entry can be hours out of date, so a farmer would see
// hours-old conditions and an hourly strip that starts in the past.
// WeatherAPI stamps every response with location.localtime_epoch (when it
// was generated), so a response older than MAX_RESPONSE_AGE_SECONDS is
// fetched again, bypassing the cache.

const MAX_RESPONSE_AGE_SECONDS = 30 * 60;

type StampedResponse = { location?: { localtime_epoch?: number } };

// Returns `data` unchanged when it's fresh (or has no timestamp). When it's
// too old, makes one uncached request and returns that instead -- or the
// original `data` if the refetch fails: the page still shows its
// "Updated HH:mm" time, and older weather beats an error.
export async function refetchIfStale<T extends StampedResponse>(url: URL, data: T, timeoutMs: number): Promise<T> {
  const generatedAt = data.location?.localtime_epoch;
  if (typeof generatedAt !== "number" || Date.now() / 1000 - generatedAt <= MAX_RESPONSE_AGE_SECONDS) {
    return data;
  }

  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(timeoutMs), cache: "no-store" });
    if (!response.ok) return data;
    return (await response.json()) as T;
  } catch {
    return data;
  }
}
