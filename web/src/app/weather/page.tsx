import type { Metadata } from "next";
import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CloudOff, Droplets, MapPin, Umbrella, Wind } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import { KENYA_COUNTY_LOCATIONS } from "@/lib/weather/countyLocations";
import { fetchCurrentWeather, type CurrentWeather } from "@/lib/weather/currentWeather";
import { fetchWeatherForecast } from "@/lib/weather/forecast";
import { FarmAlertsSection, FarmAlertsSkeleton, loadFarmAlerts } from "./FarmAlertsSection";
import { FarmOutlookSection, FarmOutlookSkeleton } from "./FarmOutlookSection";
import { ForecastSections, ForecastSkeleton } from "./ForecastSections";
import { WeatherIcon } from "./WeatherIcon";

export const metadata: Metadata = {
  title: "Weather · Shamba Space",
};

// Weather screen, Step 1: current conditions only (location, temperature,
// condition, chance of rain, humidity, wind) for the farmer's own county
// -- the county they set in Profile, the same county the weather alerts
// already use. Step 2 adds the hourly strip and daily forecast below it
// (ForecastSections.tsx). Step 3 adds the Farm Alerts section below that
// (FarmAlertsSection.tsx), and Step 4 the Farm Outlook tips below the
// alerts (FarmOutlookSection.tsx), built from the same weather data.
//
// Layout follows the reference weather card: location row on top; the
// big icon + temperature, a short stats list and a "Weather / day time /
// condition" block beside it on wider screens. On a phone the stats drop
// below as three tiles so nothing is squeezed.
export default async function WeatherPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const { data: preferences } = await supabase
    .from("farmer_preferences")
    .select("county_id")
    .maybeSingle();

  const countyId = preferences?.county_id ?? null;
  const location = countyId ? KENYA_COUNTY_LOCATIONS[countyId] : undefined;

  const { data: county } = countyId
    ? await supabase.from("counties").select("name").eq("id", countyId).maybeSingle()
    : { data: null };

  // Start the forecast now so it downloads alongside the current
  // conditions; ForecastSections awaits it behind <Suspense>. It never
  // rejects (failures come back as { ok: false }).
  const forecast = location ? fetchWeatherForecast(location.lat, location.lon) : null;
  // Farm alerts load alongside both (Supabase, not WeatherAPI) and stream
  // in last; also never rejects.
  const farmAlerts = location && county ? loadFarmAlerts() : null;
  const result = location ? await fetchCurrentWeather(location.lat, location.lon) : null;
  if (result && !result.ok) {
    // Server log only (the message never contains the API key); the
    // farmer sees the friendly error card with Try again.
    console.error("[weather] current conditions unavailable:", result.error);
  }

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />

      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-4 px-4 pb-20 pt-6 sm:px-10 sm:pt-12">
        {!location || !county ? (
          <NoCountyCard />
        ) : result && result.ok ? (
          <>
            <CurrentWeatherCard countyName={county.name} weather={result.weather} />
            {forecast && (
              <Suspense fallback={<ForecastSkeleton />}>
                <ForecastSections forecast={forecast} />
              </Suspense>
            )}
            {farmAlerts && (
              <Suspense fallback={<FarmAlertsSkeleton />}>
                <FarmAlertsSection alerts={farmAlerts} />
              </Suspense>
            )}
            {forecast && (
              <Suspense fallback={<FarmOutlookSkeleton />}>
                <FarmOutlookSection countyName={county.name} current={result.weather} forecast={forecast} />
              </Suspense>
            )}
          </>
        ) : (
          <>
            <WeatherErrorCard countyName={county.name} />
            {farmAlerts && (
              <Suspense fallback={<FarmAlertsSkeleton />}>
                <FarmAlertsSection alerts={farmAlerts} />
              </Suspense>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function LocationRow({ countyName }: { countyName: string }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="inline-flex min-w-0 items-center gap-1.5 font-sans text-base font-semibold text-shamba-ink">
        <MapPin className="size-4 shrink-0 text-shamba-green" aria-hidden="true" />
        <span className="truncate">{countyName} County</span>
      </p>
      <Link
        href="/profile"
        className="inline-flex items-center rounded-full border border-shamba-line px-3 py-1 font-sans text-sm font-semibold text-shamba-green transition-colors hover:border-shamba-green hover:bg-shamba-bg"
      >
        Change county
      </Link>
    </div>
  );
}

// "Tuesday 18:24" from WeatherAPI's "YYYY-MM-DD HH:mm" local time (Kenya is
// always UTC+3, no daylight saving).
function formatLocalDayTime(localTime: string): string {
  const [date, time] = localTime.split(" ");
  if (!date || !time) return "";
  const instant = new Date(`${date}T${time}:00+03:00`);
  if (Number.isNaN(instant.getTime())) return "";
  const weekday = instant.toLocaleDateString("en-GB", { weekday: "long", timeZone: "Africa/Nairobi" });
  return `${weekday} ${time}`;
}

function CurrentWeatherCard({ countyName, weather }: { countyName: string; weather: CurrentWeather }) {
  // Phones get a short label so each of the three tiles stays on one line.
  const stats = [
    { key: "rain", label: "Chance of rain", shortLabel: "Rain", value: `${weather.chanceOfRainPercent}%`, detail: "", Icon: Umbrella },
    { key: "humidity", label: "Humidity", shortLabel: "Humidity", value: `${weather.humidityPercent}%`, detail: "", Icon: Droplets },
    { key: "wind", label: "Wind", shortLabel: "Wind", value: `${weather.windKph} km/h`, detail: weather.windDirection, Icon: Wind },
  ];
  const updatedAt = weather.lastUpdated.split(" ")[1] ?? "";

  return (
    <section
      aria-labelledby="weather-title"
      className="rounded-shamba border border-shamba-line bg-shamba-card p-5 sm:p-6"
    >
      <LocationRow countyName={countyName} />

      <div className="mt-5 flex flex-wrap items-start justify-between gap-x-4 gap-y-5">
        <div className="order-1 flex items-center gap-3">
          <WeatherIcon code={weather.conditionCode} isDay={weather.isDay} className="size-16 shrink-0 sm:size-20" />
          <p className="flex items-start font-display text-shamba-ink">
            <span className="text-6xl font-bold leading-none tracking-tight sm:text-7xl">
              {Math.round(weather.temperatureC)}
            </span>
            <span className="ml-0.5 mt-1 text-xl font-medium sm:text-2xl">°C</span>
          </p>
        </div>

        <dl className="order-3 grid w-full grid-cols-3 gap-2 sm:order-2 sm:mr-auto sm:w-auto sm:grid-cols-1 sm:gap-0.5 sm:self-center">
          {stats.map(({ key, label, shortLabel, value, detail, Icon }) => (
            <div
              key={key}
              className="flex flex-col gap-1 rounded-shamba bg-shamba-bg p-3 sm:flex-row sm:items-center sm:gap-1.5 sm:bg-transparent sm:p-0"
            >
              <dt className="inline-flex items-center gap-1 whitespace-nowrap text-xs text-shamba-ink-soft sm:text-sm">
                <Icon className="size-3.5 shrink-0 text-shamba-green" aria-hidden="true" />
                <span>
                  <span className="sm:hidden">{shortLabel}</span>
                  <span className="hidden sm:inline">{label}:</span>
                </span>
              </dt>
              <dd className="whitespace-nowrap font-sans text-base font-semibold text-shamba-ink sm:text-sm">
                {value}
                {detail && (
                  <span className="ml-1 text-xs font-medium text-shamba-ink-soft sm:text-sm">{detail}</span>
                )}
              </dd>
            </div>
          ))}
        </dl>

        <div className="order-2 text-right sm:order-3">
          <h1 id="weather-title" className="font-display text-2xl font-bold leading-tight text-shamba-ink">
            Weather
          </h1>
          <p className="mt-1 text-sm text-shamba-ink-soft">{formatLocalDayTime(weather.localTime)}</p>
          <p className="text-sm font-semibold text-shamba-ink-soft">{weather.conditionText}</p>
        </div>
      </div>

      <p className="mt-5 border-t border-shamba-line pt-3 text-xs text-shamba-ink-soft">
        {updatedAt ? `Updated ${updatedAt} · ` : ""}
        Weather data from{" "}
        <a
          href="https://www.weatherapi.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-shamba-green hover:text-shamba-green-deep"
        >
          WeatherAPI.com
        </a>
      </p>
    </section>
  );
}

function NoCountyCard() {
  return (
    <section className="rounded-shamba border border-shamba-line bg-shamba-card p-6 text-center">
      <MapPin className="mx-auto size-8 text-shamba-green" aria-hidden="true" />
      <h1 className="mt-3 font-display text-xl font-bold text-shamba-ink">Where is your farm?</h1>
      <p className="mt-2 text-sm leading-6 text-shamba-ink-soft">
        Choose your county in Profile to see the current weather for your area.
      </p>
      <Link
        href="/profile"
        className="mt-5 inline-flex w-full items-center justify-center rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep sm:w-auto"
      >
        Choose my county
      </Link>
    </section>
  );
}

function WeatherErrorCard({ countyName }: { countyName: string }) {
  return (
    <section className="rounded-shamba border border-shamba-line bg-shamba-card p-5 sm:p-6">
      <LocationRow countyName={countyName} />
      <div className="mt-6 flex flex-col items-center text-center">
        <CloudOff className="size-8 text-shamba-ink-soft" aria-hidden="true" />
        <h1 className="mt-3 font-display text-xl font-bold text-shamba-ink">
          We couldn&apos;t load the weather
        </h1>
        <p role="alert" className="mt-2 text-sm leading-6 text-shamba-ink-soft">
          Check your connection and try again in a moment.
        </p>
        <Link
          href="/weather"
          className="mt-5 inline-flex items-center justify-center rounded-shamba border border-shamba-line px-6 py-3 font-sans text-base font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg"
        >
          Try again
        </Link>
      </div>
    </section>
  );
}
