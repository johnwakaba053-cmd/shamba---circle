import type { WeatherApiAlert } from "./weatherApiClient";

export type NormalizedWeatherAlert = {
  countyId: string;
  subtypeId: "heavy_rain" | "extreme_weather";
  severity: "info" | "advisory" | "warning" | "severe";
  title: string;
  message: string;
  externalRef: string;
  startsAt: string; // ISO 8601
  expiresAt: string | null; // ISO 8601, null = open-ended
  metadata: Record<string, unknown>;
};

// This stage only supports these two weather subtypes, deliberately --
// dry_spell/rain aren't produced from provider "alerts" (a forecast
// showing ordinary rain is not a hazard alert), and extreme_weather is
// reserved for genuinely severe provider-flagged events, not upgraded
// into from a plain rain forecast.
const EXTREME_KEYWORDS = [
  "extreme",
  "severe storm",
  "severe thunderstorm",
  "cyclone",
  "hurricane",
  "typhoon",
  "tornado",
  "extreme heat",
  "extreme cold",
  "storm surge",
  "high wind",
  "gale",
];

const HEAVY_RAIN_KEYWORDS = ["heavy rain", "flood", "flash flood", "rainfall", "downpour"];

// CAP (Common Alerting Protocol) message types -- WeatherAPI aggregates
// CAP alerts from national meteorological agencies. Only "Alert" and
// "Update" represent an active hazard; "Cancel"/"Ack"/"Error" are not
// something this stage treats as a new alert to surface to a farmer.
const INGESTIBLE_MSG_TYPES = new Set(["alert", "update"]);

function classifySubtype(text: string): "heavy_rain" | "extreme_weather" | null {
  const lower = text.toLowerCase();
  if (EXTREME_KEYWORDS.some((keyword) => lower.includes(keyword))) return "extreme_weather";
  if (HEAVY_RAIN_KEYWORDS.some((keyword) => lower.includes(keyword))) return "heavy_rain";
  return null;
}

// CAP's severity vocabulary is a fixed set (Minor/Moderate/Severe/
// Extreme/Unknown). "Unknown" is itself a valid CAP value meaning the
// source didn't specify -- mapped to the safest non-info tier rather
// than guessed higher. Anything outside that vocabulary is rejected
// (returns null, alert is skipped) rather than mapped, since there is no
// documented, confident mapping for a value we don't recognize --
// per the instruction to use a conservative value or reject rather than
// exaggerate.
function mapSeverity(raw: string): "info" | "advisory" | "warning" | "severe" | null {
  switch (raw.trim().toLowerCase()) {
    case "extreme":
    case "severe":
      return "severe";
    case "moderate":
      return "warning";
    case "minor":
      return "advisory";
    case "unknown":
      return "advisory";
    default:
      return null;
  }
}

function toIsoOrNull(value: string | undefined | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function slug(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Deterministic, not random: the same underlying provider alert (same
// county queried, same event, same effective/expires window) always
// produces the same external_ref, so re-running ingestion upserts the
// existing alerts row instead of inserting a duplicate -- alerts.
// external_ref already has a partial unique index (Stage 1). WeatherAPI's
// Alerts API does not expose a stable per-alert id (see docs), so this
// is built from the fields that actually identify a distinct event.
export function buildExternalRef(countyId: string, alert: WeatherApiAlert): string {
  return [
    "weatherapi",
    countyId,
    slug(alert.event || alert.headline || "alert"),
    slug(alert.effective || ""),
    slug(alert.expires || ""),
  ].join(":");
}

export type NormalizeResult =
  | { ok: true; alert: NormalizedWeatherAlert }
  | { ok: false; reason: string };

// ok:false whenever the alert should NOT be ingested -- an unclear
// subtype (not confidently heavy_rain or extreme_weather), an
// unmappable severity, a non-hazard CAP message type, a missing
// effective start time, or an empty message body. `reason` is a
// diagnostic string for ingestion stats/debugging only, never stored or
// shown to a farmer. Never throws: every rejection is a normal, silent
// skip, since "zero qualifying alerts for this county" is an expected,
// valid outcome, not an error.
export function normalizeWeatherAlert(countyId: string, alert: WeatherApiAlert): NormalizeResult {
  if (alert.msgtype && !INGESTIBLE_MSG_TYPES.has(alert.msgtype.trim().toLowerCase())) {
    return { ok: false, reason: `non-hazard msgtype "${alert.msgtype}"` };
  }

  const subtypeId = classifySubtype(`${alert.event ?? ""} ${alert.headline ?? ""}`);
  if (!subtypeId) {
    return { ok: false, reason: `no confident subtype match for event "${alert.event}"` };
  }

  const severity = mapSeverity(alert.severity ?? "");
  if (!severity) {
    return { ok: false, reason: `unmappable severity "${alert.severity}"` };
  }

  const startsAt = toIsoOrNull(alert.effective);
  if (!startsAt) {
    return { ok: false, reason: `missing/invalid effective time "${alert.effective}"` };
  }

  const expiresAt = toIsoOrNull(alert.expires);

  const title = (alert.headline || alert.event || "Weather Alert").slice(0, 200);
  const message = (alert.desc || alert.instruction || alert.headline || "").trim();
  if (!message) {
    return { ok: false, reason: "empty message body" };
  }

  return {
    ok: true,
    alert: {
      countyId,
      subtypeId,
      severity,
      title,
      message: message.slice(0, 4000),
      externalRef: buildExternalRef(countyId, alert),
      startsAt,
      expiresAt,
      metadata: {
        provider: "weatherapi.com",
        event: alert.event || null,
        urgency: alert.urgency || null,
        certainty: alert.certainty || null,
        areas: alert.areas || null,
        category: alert.category || null,
        msgtype: alert.msgtype || null,
        // WeatherAPI's own "note" field -- per its docs this can carry
        // timing/source context (sometimes including the originating
        // authority), preserved verbatim rather than re-labeled, since
        // we can't confidently assert it always identifies an authority.
        note: alert.note || null,
        instruction: alert.instruction || null,
      },
    },
  };
}
