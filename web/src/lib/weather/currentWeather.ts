// Server-only. Never import this from a "use client" file -- it reads
// WEATHER_API_KEY (no NEXT_PUBLIC_ prefix), exactly like
// weatherApiClient.ts.
//
// Current conditions for the Weather screen (Step 1): temperature,
// condition, chance of rain, humidity and wind at one county's query
// point (lib/weather/countyLocations.ts -- county granularity, never a
// farmer's own GPS/IP location). One WeatherAPI forecast.json call gives
// both the current conditions and today's hourly chance of rain.
//
// Responses are cached for 10 minutes per query point (Next.js fetch
// cache), so every farmer in a county shares one upstream call and the
// free-tier quota isn't spent on page views.

export type CurrentWeather = {
  temperatureC: number;
  conditionText: string;
  conditionCode: number;
  isDay: boolean;
  chanceOfRainPercent: number;
  humidityPercent: number;
  windKph: number;
  windDirection: string;
  // "YYYY-MM-DD HH:mm" in the location's own time zone (Africa/Nairobi).
  localTime: string;
  lastUpdated: string;
};

export type CurrentWeatherResult = { ok: true; weather: CurrentWeather } | { ok: false; error: string };

type ForecastResponse = {
  location?: { localtime?: string };
  current?: {
    temp_c?: number;
    is_day?: number;
    condition?: { text?: string; code?: number };
    wind_kph?: number;
    wind_dir?: string;
    humidity?: number;
    last_updated?: string;
  };
  forecast?: {
    forecastday?: {
      day?: { daily_chance_of_rain?: number };
      hour?: { time?: string; chance_of_rain?: number }[];
    }[];
  };
};

// A cold connection to WeatherAPI over a slow mobile/LAN link can stall
// once and then answer in well under a second, so a network failure or
// timeout is retried once (an HTTP error response is not).
const REQUEST_TIMEOUT_MS = 8_000;
const NETWORK_ATTEMPTS = 2;
const CACHE_SECONDS = 600;

export async function fetchCurrentWeather(lat: number, lon: number): Promise<CurrentWeatherResult> {
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "WEATHER_API_KEY is not configured" };
  }

  const url = new URL("https://api.weatherapi.com/v1/forecast.json");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", `${lat},${lon}`);
  url.searchParams.set("days", "1");
  url.searchParams.set("aqi", "no");
  url.searchParams.set("alerts", "no");

  let response: Response | null = null;
  let lastError = "Unknown error";
  for (let attempt = 1; attempt <= NETWORK_ATTEMPTS && !response; attempt++) {
    try {
      response = await fetch(url, {
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        next: { revalidate: CACHE_SECONDS },
      });
    } catch (err) {
      lastError = err instanceof Error ? `${err.name}: ${err.message}` : "Unknown error";
    }
  }

  if (!response) {
    return { ok: false, error: `WeatherAPI request error: ${lastError}` };
  }

  try {
    if (!response.ok) {
      // Status only -- never log/return the URL, which contains the key.
      return { ok: false, error: `WeatherAPI request failed with status ${response.status}` };
    }

    const data = (await response.json()) as ForecastResponse;
    const current = data.current;
    if (!current || typeof current.temp_c !== "number") {
      return { ok: false, error: "WeatherAPI response had no current conditions" };
    }

    const localTime = data.location?.localtime ?? "";
    const today = data.forecast?.forecastday?.[0];
    // The chance of rain for the current hour, like the reference design's
    // "Precipitation" figure; falls back to today's overall chance.
    const currentHourPrefix = localTime.slice(0, 13); // "YYYY-MM-DD HH"
    const hourChance = today?.hour?.find((hour) => hour.time?.startsWith(currentHourPrefix))?.chance_of_rain;
    const chanceOfRain = hourChance ?? today?.day?.daily_chance_of_rain ?? 0;

    const conditionText = current.condition?.text?.trim() || "—";

    return {
      ok: true,
      weather: {
        temperatureC: current.temp_c,
        conditionText,
        conditionCode: current.condition?.code ?? 0,
        // Around sunset WeatherAPI can report is_day = 0 while the text still
        // says "Sunny"; the icon follows the text so the two never disagree.
        isDay: current.is_day === 1 || /sunny/i.test(conditionText),
        chanceOfRainPercent: Math.round(chanceOfRain),
        humidityPercent: Math.round(current.humidity ?? 0),
        windKph: Math.round(current.wind_kph ?? 0),
        windDirection: current.wind_dir ?? "",
        localTime,
        lastUpdated: current.last_updated ?? localTime,
      },
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: `WeatherAPI response error: ${message}` };
  }
}
