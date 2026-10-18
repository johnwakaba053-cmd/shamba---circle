import { CloudSun, Droplets, MapPin } from "lucide-react";
import { fetchCurrentWeather, type CurrentWeatherResult } from "@/lib/weather/currentWeather";
import { KENYA_COUNTY_LOCATIONS } from "@/lib/weather/countyLocations";
import { WeatherIcon } from "@/app/weather/WeatherIcon";
import { DashboardCard, EmptyLine } from "./DashboardCard";

// My Farm's weather line: current conditions for the farmer's county, from
// the same fetchCurrentWeather() call the Weather screen makes (cached 10
// minutes per county, so this adds no extra WeatherAPI quota for farmers
// in the same county). The forecast, Farm Alerts and Farm Outlook stay on
// /weather -- this card only says what it is like now and links there.

// Never rejects: no county (or one without a weather point) resolves to
// null, and a WeatherAPI failure comes back as { ok: false }.
export async function loadWeatherSummary(countyId: string | null): Promise<CurrentWeatherResult | null> {
  const location = countyId ? KENYA_COUNTY_LOCATIONS[countyId] : undefined;
  if (!location) return null;
  const result = await fetchCurrentWeather(location.lat, location.lon);
  if (!result.ok) {
    console.error("[my-farm] current weather unavailable:", result.error);
  }
  return result;
}

export async function WeatherSummarySection({
  weather,
  countyName,
}: {
  weather: Promise<CurrentWeatherResult | null>;
  countyName: string | null;
}) {
  return <WeatherSummaryCard result={await weather} countyName={countyName} />;
}

export function WeatherSummaryCard({
  result,
  countyName,
}: {
  result: CurrentWeatherResult | null;
  countyName: string | null;
}) {
  const updatedTime = result?.ok ? result.weather.lastUpdated.split(" ")[1] : undefined;

  return (
    <DashboardCard
      icon={CloudSun}
      tone="bg-shamba-blue/10 text-shamba-blue"
      title="Weather now"
      href="/weather"
      linkLabel="Forecast"
    >
      {result === null || !countyName ? (
        <EmptyLine href="/profile" linkLabel="Choose your county">
          Set your county to see the weather for your area.
        </EmptyLine>
      ) : !result.ok ? (
        <EmptyLine href="/weather" linkLabel="Try the Weather page">
          We couldn&apos;t load the weather for {countyName} right now.
        </EmptyLine>
      ) : (
        <div className="flex flex-wrap items-center gap-x-5 gap-y-4 rounded-xl bg-gradient-to-br from-shamba-blue/[0.12] to-shamba-blue/[0.03] p-4">
          <div className="flex items-center gap-3">
            <WeatherIcon
              code={result.weather.conditionCode}
              isDay={result.weather.isDay}
              className="size-14 shrink-0"
            />
            <p className="flex shrink-0 items-start font-display text-shamba-ink">
              <span className="text-5xl font-bold leading-none tracking-tight">
                {Math.round(result.weather.temperatureC)}
              </span>
              <span className="ml-0.5 mt-1 text-lg font-medium">°C</span>
            </p>
          </div>
          <div className="min-w-0 flex-1 basis-48">
            <p className="font-display text-lg font-semibold leading-tight text-shamba-ink">
              {result.weather.conditionText}
            </p>
            <div className="mt-2 flex flex-wrap gap-1.5 text-xs font-medium">
              <span className="inline-flex items-center gap-1 rounded-full bg-shamba-card px-2.5 py-1 text-shamba-blue">
                <Droplets className="size-3.5" aria-hidden="true" />
                Chance of rain: {result.weather.chanceOfRainPercent}%
              </span>
              <span className="inline-flex items-center gap-1 rounded-full bg-shamba-card px-2.5 py-1 text-shamba-ink-soft">
                <MapPin className="size-3.5" aria-hidden="true" />
                {countyName} County
              </span>
            </div>
            {updatedTime && <p className="mt-2 text-xs text-shamba-ink-soft">Updated {updatedTime}</p>}
          </div>
        </div>
      )}
    </DashboardCard>
  );
}
