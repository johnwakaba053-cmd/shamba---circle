import Link from "next/link";
import { CloudOff, Umbrella } from "lucide-react";
import type {
  DailyForecast,
  HourlyForecast,
  WeatherForecastResult,
} from "@/lib/weather/forecast";
import { WeatherIcon } from "./WeatherIcon";

// Weather screen, Step 2: the hourly strip and the daily forecast, below
// the (unchanged) current-conditions card and in the same card style.
// The page starts the forecast request alongside the current conditions
// and streams these sections in behind <Suspense>, so a slow or failed
// forecast never holds back or breaks the current weather.
export async function ForecastSections({
  forecast,
}: {
  forecast: Promise<WeatherForecastResult>;
}) {
  const result = await forecast;
  if (!result.ok) {
    // Server log only (the message never contains the API key).
    console.error("[weather] forecast unavailable:", result.error);
    return <ForecastErrorCard />;
  }

  return (
    <>
      <HourlyStrip hours={result.forecast.hours} />
      <DailyList days={result.forecast.days} />
    </>
  );
}

const cardClass = "rounded-shamba border border-shamba-line bg-shamba-card p-5 sm:p-6";

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="font-display text-lg font-bold leading-tight text-shamba-ink">
      {children}
    </h2>
  );
}

function RainChance({ percent, className = "" }: { percent: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 whitespace-nowrap text-xs font-semibold text-shamba-blue ${className}`}>
      <Umbrella className="size-3 shrink-0" aria-hidden="true" />
      <span className="sr-only">Chance of rain </span>
      {percent}%
    </span>
  );
}

// "Today", then "Wed", "Thu"... from WeatherAPI's local "YYYY-MM-DD"
// (noon, so the weekday can't slip across midnight; Kenya is UTC+3).
function dayLabel(date: string, index: number, style: "short" | "long"): string {
  if (index === 0) return "Today";
  const instant = new Date(`${date}T12:00:00+03:00`);
  if (Number.isNaN(instant.getTime())) return date;
  return instant.toLocaleDateString("en-GB", { weekday: style, timeZone: "Africa/Nairobi" });
}

// Sideways-scrolling strip on every screen size (24 hours never fit one
// row); a fade on the right edge shows there's more, like the app's nav.
function HourlyStrip({ hours }: { hours: HourlyForecast[] }) {
  return (
    <section aria-labelledby="hourly-title" className={cardClass}>
      <SectionHeading id="hourly-title">Next {hours.length} hours</SectionHeading>

      <div className="relative -mx-5 mt-4 sm:-mx-6">
        <ol className="relative flex snap-x scroll-px-5 gap-1.5 overflow-x-auto px-5 pb-1 sm:scroll-px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:px-6">
          {hours.map((hour, index) => {
            const time = hour.time.slice(11, 16);
            const isNow = index === 0;
            return (
              <li
                key={hour.time}
                className={`flex w-16 shrink-0 snap-start flex-col items-center gap-1.5 rounded-shamba px-1 py-3 ${
                  isNow ? "bg-shamba-bg" : ""
                }`}
              >
                <span
                  className={`text-xs ${isNow ? "font-semibold text-shamba-ink" : "text-shamba-ink-soft"}`}
                >
                  {isNow ? "Now" : time}
                </span>
                <WeatherIcon code={hour.conditionCode} isDay={hour.isDay} className="size-7" />
                <span className="sr-only">{hour.conditionText}</span>
                <span className="font-display text-lg font-bold leading-none text-shamba-ink">
                  {Math.round(hour.temperatureC)}°
                </span>
                <RainChance percent={hour.chanceOfRainPercent} />
              </li>
            );
          })}
        </ol>
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-shamba-card to-transparent"
        />
      </div>
    </section>
  );
}

// Phones: one row per day -- icon, day with its condition underneath,
// rain, high/low. sm and up: one column per day (day, icon, condition,
// rain, high/low), like the reference card's day row; the day/condition
// wrapper dissolves (sm:contents) and `order` puts the icon between them.
// The column count follows however many days the plan returned.
function DailyList({ days }: { days: DailyForecast[] }) {
  return (
    <section aria-labelledby="daily-title" className={cardClass}>
      <SectionHeading id="daily-title">{days.length}-day forecast</SectionHeading>

      <ol
        style={{ "--days": days.length } as React.CSSProperties}
        className="mt-4 flex flex-col gap-1 sm:grid sm:grid-cols-[repeat(var(--days),minmax(0,1fr))] sm:gap-2"
      >
        {days.map((day, index) => {
          const isToday = index === 0;
          return (
            <li
              key={day.date}
              className={`flex items-center gap-3 rounded-shamba px-3 py-2.5 sm:flex-col sm:gap-2 sm:px-2 sm:py-4 sm:text-center ${
                isToday ? "bg-shamba-bg" : ""
              }`}
            >
              <WeatherIcon code={day.conditionCode} isDay className="size-7 shrink-0 sm:order-2 sm:size-10" />
              <span className="flex min-w-0 flex-1 flex-col sm:contents">
                <span className="font-sans text-sm font-semibold text-shamba-ink sm:order-1">
                  <span aria-hidden="true">{dayLabel(day.date, index, "short")}</span>
                  <span className="sr-only">{dayLabel(day.date, index, "long")}</span>
                </span>
                <span className="truncate text-xs text-shamba-ink-soft sm:order-3 sm:line-clamp-2 sm:min-h-8 sm:whitespace-normal">
                  {day.conditionText}
                </span>
              </span>
              <RainChance percent={day.chanceOfRainPercent} className="shrink-0 sm:order-4" />
              <span className="w-16 shrink-0 whitespace-nowrap text-right font-sans text-sm sm:order-5 sm:w-auto sm:text-center">
                <span className="font-bold text-shamba-ink">
                  <span className="sr-only">High </span>
                  {Math.round(day.maxTemperatureC)}°
                </span>{" "}
                <span className="text-shamba-ink-soft">
                  <span className="sr-only">low </span>
                  {Math.round(day.minTemperatureC)}°
                </span>
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function ForecastErrorCard() {
  return (
    <section className={`${cardClass} flex flex-col items-center text-center`}>
      <CloudOff className="size-7 text-shamba-ink-soft" aria-hidden="true" />
      <h2 className="mt-2 font-display text-lg font-bold text-shamba-ink">
        We couldn&apos;t load the forecast
      </h2>
      <p role="alert" className="mt-1 text-sm leading-6 text-shamba-ink-soft">
        The current weather above is still up to date. Try again in a moment.
      </p>
      <Link
        href="/weather"
        className="mt-4 inline-flex items-center justify-center rounded-shamba border border-shamba-line px-6 py-3 font-sans text-base font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg"
      >
        Try again
      </Link>
    </section>
  );
}

// Placeholder in the same shape while the forecast streams in (also used
// by the route's loading.tsx).
export function ForecastSkeleton() {
  return (
    <div role="status" aria-label="Loading forecast" className="flex flex-col gap-4">
      <section className={cardClass}>
        <div className="h-5 w-32 animate-pulse rounded bg-shamba-line" />
        <div className="mt-4 flex gap-1.5 overflow-hidden">
          {Array.from({ length: 8 }, (_, index) => (
            <div key={index} className="h-[6.5rem] w-16 shrink-0 animate-pulse rounded-shamba bg-shamba-bg" />
          ))}
        </div>
      </section>
      <section className={cardClass}>
        <div className="h-5 w-36 animate-pulse rounded bg-shamba-line" />
        <div className="mt-4 flex flex-col gap-1 sm:grid sm:grid-cols-3 sm:gap-2">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="h-11 animate-pulse rounded-shamba bg-shamba-bg sm:h-40" />
          ))}
        </div>
      </section>
    </div>
  );
}
