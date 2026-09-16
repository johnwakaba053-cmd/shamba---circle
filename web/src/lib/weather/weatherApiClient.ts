// Server-only. Never import this from a "use client" file -- it reads
// WEATHER_API_KEY (no NEXT_PUBLIC_ prefix, so Next.js already refuses to
// bundle it client-side, but this module has no reason to ever be
// requested by client code in the first place).

export type WeatherApiAlert = {
  headline: string;
  msgtype: string;
  severity: string;
  urgency: string;
  areas: string;
  category: string;
  certainty: string;
  event: string;
  note: string;
  effective: string;
  expires: string;
  desc: string;
  instruction: string;
};

type WeatherApiForecastResponse = {
  alerts?: { alert?: WeatherApiAlert[] };
};

export type WeatherApiResult =
  | { ok: true; alerts: WeatherApiAlert[] }
  | { ok: false; error: string };

const REQUEST_TIMEOUT_MS = 10_000;

// Forecast API with alerts=yes -- https://www.weatherapi.com/docs/. Only
// 1 day of forecast is requested since alerts, not the forecast body
// itself, are what this integration uses.
export async function fetchWeatherAlerts(lat: number, lon: number): Promise<WeatherApiResult> {
  const apiKey = process.env.WEATHER_API_KEY;

  if (!apiKey) {
    return { ok: false, error: "WEATHER_API_KEY is not configured" };
  }

  const url = new URL("https://api.weatherapi.com/v1/forecast.json");
  url.searchParams.set("key", apiKey);
  url.searchParams.set("q", `${lat},${lon}`);
  url.searchParams.set("days", "1");
  url.searchParams.set("alerts", "yes");

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    });

    if (!response.ok) {
      // Status only -- never log/return the request URL, which contains
      // the API key as a query parameter.
      return { ok: false, error: `WeatherAPI request failed with status ${response.status}` };
    }

    const data = (await response.json()) as WeatherApiForecastResponse;
    return { ok: true, alerts: data.alerts?.alert ?? [] };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return { ok: false, error: `WeatherAPI request error: ${message}` };
  }
}
