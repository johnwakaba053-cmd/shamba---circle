import {
  CloudLightning,
  CloudRain,
  Droplets,
  Info,
  Leaf,
  Snowflake,
  SprayCan,
  Sun,
  ThermometerSun,
  Wind,
  type LucideIcon,
} from "lucide-react";
import type { CurrentWeather } from "@/lib/weather/currentWeather";
import type { WeatherForecastResult } from "@/lib/weather/forecast";
import { buildFarmOutlook, type OutlookTone, type OutlookTopic } from "@/lib/weather/farmOutlook";

// Weather screen, Step 4: Farm Outlook, below Farm Alerts and in the same
// card style. Turns the current conditions and the forecast the page has
// already fetched (the same forecast promise ForecastSections awaits --
// no second request) into short, general farming tips
// (lib/weather/farmOutlook.ts). If the forecast failed, the forecast
// section already shows the error, so this section stays out of the way.

const TOPIC_ICON: Record<OutlookTopic, LucideIcon> = {
  rain: CloudRain,
  storm: CloudLightning,
  heat: ThermometerSun,
  cold: Snowflake,
  wind: Wind,
  dry: Sun,
  disease: Leaf,
  spraying: SprayCan,
  irrigation: Droplets,
};

// Tone is always spelled out as a label, never shown by colour alone.
const TONE_STYLES: Record<OutlookTone, { label: string; badge: string; icon: string }> = {
  warning: { label: "Take care", badge: "bg-shamba-rust text-shamba-card", icon: "text-shamba-rust" },
  caution: { label: "Heads up", badge: "bg-shamba-ochre text-shamba-card", icon: "text-shamba-ochre" },
  good: { label: "Good to know", badge: "bg-shamba-green text-shamba-card", icon: "text-shamba-green" },
};

const cardClass = "rounded-shamba border border-shamba-line bg-shamba-card p-5 sm:p-6";

export async function FarmOutlookSection({
  countyName,
  current,
  forecast,
}: {
  countyName: string;
  current: CurrentWeather;
  forecast: Promise<WeatherForecastResult>;
}) {
  const result = await forecast;
  if (!result.ok) return null;

  const tips = buildFarmOutlook(current, result.forecast);

  return (
    <section aria-labelledby="farm-outlook-title" className={cardClass}>
      <h2 id="farm-outlook-title" className="font-display text-lg font-bold leading-tight text-shamba-ink">
        Farm Outlook
      </h2>
      <p className="mt-1 text-sm text-shamba-ink-soft">
        What the next few days could mean for work on your farm in {countyName} County.
      </p>

      <ul className="mt-4 flex flex-col gap-3">
        {tips.map((tip) => {
          const Icon = TOPIC_ICON[tip.topic];
          const tone = TONE_STYLES[tip.tone];
          return (
            <li key={tip.topic} className="flex gap-3 rounded-shamba bg-shamba-bg p-4">
              <Icon className={`mt-0.5 size-5 shrink-0 ${tone.icon}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                  <h3 className="font-sans text-sm font-semibold text-shamba-ink">{tip.title}</h3>
                  <span className={`rounded-shamba px-2 py-0.5 font-mono text-xs font-semibold ${tone.badge}`}>
                    {tone.label}
                  </span>
                </div>
                <p className="mt-1 text-sm leading-6 text-shamba-ink-soft">{tip.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>

      <p className="mt-5 flex gap-2 border-t border-shamba-line pt-3 text-xs leading-5 text-shamba-ink-soft">
        <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
        <span>
          General guidance worked out from the forecast, not guaranteed agronomic advice. Forecasts can
          change, so check your own field and ask your local agricultural extension officer before making
          important decisions.
        </span>
      </p>
    </section>
  );
}

// Placeholder in the same shape while the outlook streams in (also used
// by the route's loading.tsx).
export function FarmOutlookSkeleton() {
  return (
    <section role="status" aria-label="Loading farm outlook" className={cardClass}>
      <div className="h-5 w-32 animate-pulse rounded bg-shamba-line" />
      <div className="mt-2 h-4 w-64 max-w-full animate-pulse rounded bg-shamba-line" />
      <div className="mt-4 flex flex-col gap-3">
        {Array.from({ length: 3 }, (_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-shamba bg-shamba-bg" />
        ))}
      </div>
    </section>
  );
}
