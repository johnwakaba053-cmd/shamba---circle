// Farm Outlook for the Weather screen (Step 4): simple, rule-based farming
// guidance built only from data the screen already has -- the current
// conditions (currentWeather.ts) and the hourly/daily forecast
// (forecast.ts). No extra API calls, no crop-specific agronomy: each tip
// is general guidance the page frames as such, never a recommendation a
// farmer should rely on over their own field or an extension officer.
//
// Pure and synchronous, so it can be reasoned about (and tested) from
// plain inputs. Thresholds are deliberately simple and conservative.

import type { CurrentWeather } from "./currentWeather";
import type { WeatherForecast } from "./forecast";

export type OutlookTone = "warning" | "caution" | "good";

export type OutlookTopic = "rain" | "storm" | "heat" | "cold" | "wind" | "dry" | "disease" | "spraying" | "irrigation";

export type OutlookTip = {
  topic: OutlookTopic;
  tone: OutlookTone;
  title: string;
  detail: string;
};

// Chance-of-rain (%) at which rain counts as likely.
const RAIN_LIKELY = 60;
// Every day and hour below this counts as dry.
const DRY_BELOW = 30;
// Spraying wants a rain-free window this many hours long.
const SPRAY_WINDOW_HOURS = 6;
const SPRAY_RAIN_MAX = 40;
// Wind (km/h): drift risk for spraying, then strong enough to damage.
const WIND_DRIFT = 15;
const WIND_STRONG = 40;
// Temperatures (°C).
const HOT = 30;
const VERY_HOT = 34;
const COLD_NIGHT = 8;
// Warm and humid enough that fungal diseases spread readily.
const HUMID = 85;
const HUMID_WARM = 18;

const TONE_ORDER: Record<OutlookTone, number> = { warning: 0, caution: 1, good: 2 };

// "Today", "tomorrow" or "on Thursday" from WeatherAPI's local "YYYY-MM-DD"
// (noon, so the weekday can't slip across midnight; Kenya is UTC+3).
function whenDay(date: string, index: number): string {
  if (index === 0) return "today";
  if (index === 1) return "tomorrow";
  const instant = new Date(`${date}T12:00:00+03:00`);
  if (Number.isNaN(instant.getTime())) return `on ${date}`;
  return `on ${instant.toLocaleDateString("en-GB", { weekday: "long", timeZone: "Africa/Nairobi" })}`;
}

// "now" or "from about 15:00" from "YYYY-MM-DD HH:mm".
function whenHour(time: string, index: number): string {
  return index === 0 ? "now" : `from about ${time.slice(11, 13)}:00`;
}

export function buildFarmOutlook(current: CurrentWeather, forecast: WeatherForecast): OutlookTip[] {
  const { hours, days } = forecast;
  const tips: OutlookTip[] = [];

  const next24MaxRain = Math.max(current.chanceOfRainPercent, ...hours.map((hour) => hour.chanceOfRainPercent));
  const firstRainyHour = hours.findIndex((hour) => hour.chanceOfRainPercent >= RAIN_LIKELY);
  const rainSoon = firstRainyHour !== -1;
  const laterRainyDay = days.findIndex((day, index) => index > 0 && day.chanceOfRainPercent >= RAIN_LIKELY);
  const stormy = [current.conditionText, ...hours.map((hour) => hour.conditionText), ...days.map((day) => day.conditionText)].some(
    (text) => /thunder/i.test(text),
  );
  const isDry = next24MaxRain < DRY_BELOW && days.every((day) => day.chanceOfRainPercent < DRY_BELOW);

  const hottest = days.reduce((best, day, index) => (day.maxTemperatureC > days[best].maxTemperatureC ? index : best), 0);
  const maxTemp = Math.max(current.temperatureC, days[hottest].maxTemperatureC);
  const coldest = days.reduce((best, day, index) => (day.minTemperatureC < days[best].minTemperatureC ? index : best), 0);
  const minTemp = days[coldest].minTemperatureC;

  // Rain
  if (rainSoon) {
    tips.push({
      topic: "rain",
      tone: "caution",
      title: `Rain likely ${whenHour(hours[firstRainyHour].time, firstRainyHour)}`,
      detail:
        "Hold off on top-dressing fertiliser and spraying until it passes, so they aren't washed off. Clear drainage channels and bring in harvested produce that is drying outside.",
    });
  } else if (laterRainyDay !== -1) {
    tips.push({
      topic: "rain",
      tone: "good",
      title: `Rain expected ${whenDay(days[laterRainyDay].date, laterRainyDay)}`,
      detail:
        "A chance to finish land preparation and plan planting or top-dressing so the rain can work it into the soil. Get field work that needs dry ground done before then.",
    });
  }

  if (stormy) {
    tips.push({
      topic: "storm",
      tone: "warning",
      title: "Thunderstorms possible",
      detail:
        "Avoid working in open fields or sheltering under lone trees during storms. Keep livestock in shelter and secure loose roofing, nets and tools.",
    });
  }

  // Dry conditions
  if (isDry) {
    tips.push({
      topic: "dry",
      tone: "caution",
      title: "Dry days ahead",
      detail:
        "Little rain is forecast. Mulch to hold soil moisture, prioritise water for young plants and nurseries, and make sure livestock always have clean water.",
    });
  }

  // Heat
  if (maxTemp >= HOT) {
    tips.push({
      topic: "heat",
      tone: maxTemp >= VERY_HOT ? "warning" : "caution",
      title: `Hot ${current.temperatureC >= HOT ? "now" : whenDay(days[hottest].date, hottest)} (up to ${Math.round(maxTemp)}°C)`,
      detail:
        "Work, harvest and water in the cooler morning and evening. Give livestock shade and extra water, and watch young plants and poultry for heat stress.",
    });
  }

  // Cold nights (mainly highland counties)
  if (minTemp <= COLD_NIGHT) {
    tips.push({
      topic: "cold",
      tone: "caution",
      // A day's low is often the early morning already past, so no "today".
      title: `Cold nights ahead (down to ${Math.round(minTemp)}°C)`,
      detail:
        "Cover seedlings and nursery beds overnight if you can, and keep young animals and chicks warm and out of the wind.",
    });
  }

  // Wind
  if (current.windKph >= WIND_STRONG) {
    tips.push({
      topic: "wind",
      tone: "warning",
      title: `Strong wind now (${current.windKph} km/h)`,
      detail:
        "Stake tall crops like maize and bananas where you can, and secure greenhouse covers, shade nets and roofing.",
    });
  }

  // Disease pressure
  if (current.humidityPercent >= HUMID && current.temperatureC >= HUMID_WARM) {
    tips.push({
      topic: "disease",
      tone: "caution",
      title: "Warm and humid",
      detail:
        "Conditions favour fungal diseases such as blight and mildew. Check leaves regularly, especially on tomatoes and potatoes, and remove badly affected plants early.",
    });
  }

  // Spraying -- always shown: whether now is a reasonable window.
  const sprayWindow = hours.slice(0, SPRAY_WINDOW_HOURS);
  const rainInWindow = sprayWindow.some((hour) => hour.chanceOfRainPercent > SPRAY_RAIN_MAX);
  const reasonsNotToSpray = [
    current.windKph >= WIND_DRIFT ? `wind is ${current.windKph} km/h, so spray may drift` : null,
    rainInWindow ? `rain may fall in the next ${SPRAY_WINDOW_HOURS} hours and wash it off` : null,
    current.temperatureC >= HOT ? "it is hot, so spray can evaporate or scorch leaves" : null,
  ].filter((reason): reason is string => reason !== null);
  tips.push(
    reasonsNotToSpray.length > 0
      ? {
          topic: "spraying",
          tone: "caution",
          title: "Not a good time to spray",
          detail: `Wait if you can: ${reasonsNotToSpray.join("; ")}. Always follow the product label and wear protective gear.`,
        }
      : {
          topic: "spraying",
          tone: "good",
          title: "Reasonable conditions for spraying",
          detail: `Calm and dry for the next ${SPRAY_WINDOW_HOURS} hours. Early morning or late afternoon is best. Always follow the product label and wear protective gear.`,
        },
  );

  // Irrigation -- always shown.
  tips.push(
    rainSoon
      ? {
          topic: "irrigation",
          tone: "good",
          title: "You may be able to skip watering",
          detail: "Rain is likely in the next 24 hours. Check the soil after it falls before irrigating again.",
        }
      : isDry || maxTemp >= HOT
        ? {
            topic: "irrigation",
            tone: "caution",
            title: "Plan to irrigate",
            detail:
              "Water early in the morning or in the evening so less is lost to evaporation, and water at the roots rather than over the leaves.",
          }
        : {
            topic: "irrigation",
            tone: "good",
            title: "Water as usual",
            detail: "Check soil moisture a finger's depth down before watering; irrigate only where it feels dry.",
          },
  );

  // Stable sort: warnings first, then cautions, then the good news.
  return tips.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}
