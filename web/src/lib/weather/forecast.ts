// Server-only. Never import this from a "use client" file -- it reads
// WEATHER_API_KEY (no NEXT_PUBLIC_ prefix), exactly like
// currentWeather.ts and weatherApiClient.ts.
//
// Hourly and daily forecasts for the Weather screen (Step 2), at the same
// county query point as the current conditions. Asks WeatherAPI for 7
// days; the plan decides how many come back (the free plan returns 3), so
// callers show whatever days arrive rather than assuming seven.
//
// Cached for 10 minutes per query point (Next.js fetch cache), like the
// current conditions, and likewise fetched again when a cached response is
// more than 30 minutes old (see freshness.ts). The request URL carries the
// API key, so it is never logged -- errors only ever describe the status
// or failure kind.

import { refetchIfStale } from "./freshness";

export type HourlyForecast = {
  // "YYYY-MM-DD HH:mm" local (Africa/Nairobi).
  time: string;
  temperatureC: number;
  conditionText: string;
  conditionCode: number;
  isDay: boolean;
  chanceOfRainPercent: number;
};

export type DailyForecast = {
  // "YYYY-MM-DD" local.
  date: string;
  maxTemperatureC: number;
  minTemperatureC: number;
  conditionText: string;
  conditionCode: number;
  chanceOfRainPercent: number;
};

export type WeatherForecast = {
  // Next hours starting with the current one, at most HOURS_AHEAD.
  hours: HourlyForecast[];
  // Today first.
  days: DailyForecast[];
};

export type WeatherForecastResult = { ok: true; forecast: WeatherForecast } | { ok: false; error: string };

type ForecastResponse = {
  location?: { localtime?: string; localtime_epoch?: number };
  forecast?: {
    forecastday?: {
      date?: string;
      day?: {
        maxtemp_c?: number;
        mintemp_c?: number;
        daily_chance_of_rain?: number;
        condition?: { text?: string; code?: number };
      };
      hour?: {
        time?: string;
        temp_c?: number;
        is_day?: number;
        chance_of_rain?: number;
        condition?: { text?: string; code?: number };
      }[];
    }[];
  };
};

const FORECAST_DAYS = 7;
const HOURS_AHEAD = 24;
const REQUEST_TIMEOUT_MS = 8_000;
// A cold first connection to WeatherAPI can time out on slow networks;
// one retry on a network failure/timeout (never on an HTTP error).
const NETWORK_ATTEMPTS = 2;
const CACHE_SECONDS = 600;

export async function fetchWeatherForecast(lat: number, lon: number): Promise<WeatherForecastResult> {
  const apiKey = process.env.WEATHER_API_KEY;
  if (!apiKey) {
    return { ok: false, error: "WEATHER_API_KEY is not configured" };
  }

  const url = new URL("https://api.weatherapi.com/v1/forecast.json");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", `${lat},${lon}`);
  url.searchParams.set("days", String(FORECAST_DAYS));
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
      return { ok: false, error: `WeatherAPI request failed with status ${response.status}` };
    }

    const cached = (await response.json()) as ForecastResponse;
    const data = await refetchIfStale(url, cached, REQUEST_TIMEOUT_MS);
    const forecastDays = data.forecast?.forecastday ?? [];

    const days: DailyForecast[] = [];
    for (const day of forecastDays) {
      const info = day.day;
      if (!day.date || typeof info?.maxtemp_c !== "number" || typeof info.mintemp_c !== "number") continue;
      days.push({
        date: day.date,
        maxTemperatureC: info.maxtemp_c,
        minTemperatureC: info.mintemp_c,
        conditionText: info.condition?.text?.trim() || "—",
        conditionCode: info.condition?.code ?? 0,
        chanceOfRainPercent: Math.round(info.daily_chance_of_rain ?? 0),
      });
    }

    // Hours are "YYYY-MM-DD HH:mm", so comparing the "YYYY-MM-DD HH"
    // prefix as text keeps the current hour and everything after it.
    const currentHourPrefix = (data.location?.localtime ?? "").slice(0, 13);
    const hours: HourlyForecast[] = [];
    for (const day of forecastDays) {
      for (const hour of day.hour ?? []) {
        if (hours.length >= HOURS_AHEAD) break;
        if (!hour.time || typeof hour.temp_c !== "number") continue;
        if (currentHourPrefix && hour.time.slice(0, 13) < currentHourPrefix) continue;
        const conditionText = hour.condition?.text?.trim() || "—";
        hours.push({
          time: hour.time,
          temperatureC: hour.temp_c,
          conditionText,
          conditionCode: hour.condition?.code ?? 0,
          // Same rule as the current conditions: a "Sunny" hour gets the sun.
          isDay: hour.is_day === 1 || /sunny/i.test(conditionText),
          chanceOfRainPercent: Math.round(hour.chance_of_rain ?? 0),
        });
      }
    }

    if (days.length === 0 || hours.length === 0) {
      return { ok: false, error: "WeatherAPI response had no forecast" };
    }

    return { ok: true, forecast: { hours, days } };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: `WeatherAPI response error: ${message}` };
  }
}
