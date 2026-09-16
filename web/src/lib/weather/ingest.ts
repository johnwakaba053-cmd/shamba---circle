import { createAdminClient } from "@/lib/supabase/admin";
import { fetchWeatherAlerts } from "./weatherApiClient";
import { normalizeWeatherAlert } from "./normalize";
import { KENYA_COUNTY_LOCATIONS } from "./countyLocations";

export type IngestWeatherAlertsResult = {
  countiesQueried: string[];
  countiesProcessed: number;
  countiesFailed: number;
  providerAlertsSeen: number;
  alertsQualified: number;
  alertsUpserted: number;
  errors: string[];
  countyBreakdown: Record<
    string,
    { providerAlertsSeen: number; qualified: number; upserted: number }
  >;
  rejectedAlerts: Array<{
    countyId: string;
    event: string;
    headline: string;
    severity: string;
    msgtype: string;
    reason: string;
  }>;
};

// Server-only orchestration: WeatherAPI -> validate/normalize -> alerts
// table. Never exposed to the browser directly -- only reachable via the
// internal, secret-gated route handler (or a future scheduled job).
// Deliberately does not throw on a per-county or per-alert failure: one
// bad county/alert should not abort the rest of the run, so every
// failure is recorded in `errors` and ingestion continues.
//
// `countyIds` optionally restricts the run to a subset (e.g. for a
// manual test), instead of always querying all 47 counties -- useful to
// avoid unnecessary provider API calls. Omit it (or pass nothing) to
// process every configured county, which is what a real scheduled run
// would do.
export async function ingestWeatherAlerts(
  countyIds?: string[],
): Promise<IngestWeatherAlertsResult> {
  const result: IngestWeatherAlertsResult = {
    countiesQueried: [],
    countiesProcessed: 0,
    countiesFailed: 0,
    providerAlertsSeen: 0,
    alertsQualified: 0,
    alertsUpserted: 0,
    errors: [],
    countyBreakdown: {},
    rejectedAlerts: [],
  };

  if (!process.env.WEATHER_API_KEY) {
    result.errors.push("WEATHER_API_KEY is not configured; ingestion did not run.");
    return result;
  }

  const supabase = createAdminClient();

  const targetCounties = countyIds?.length
    ? Object.entries(KENYA_COUNTY_LOCATIONS).filter(([id]) => countyIds.includes(id))
    : Object.entries(KENYA_COUNTY_LOCATIONS);

  for (const [countyId, location] of targetCounties) {
    result.countiesQueried.push(countyId);
    result.countyBreakdown[countyId] = { providerAlertsSeen: 0, qualified: 0, upserted: 0 };

    const response = await fetchWeatherAlerts(location.lat, location.lon);

    if (!response.ok) {
      result.countiesFailed += 1;
      result.errors.push(`${countyId}: ${response.error}`);
      continue;
    }

    result.countiesProcessed += 1;
    result.providerAlertsSeen += response.alerts.length;
    result.countyBreakdown[countyId].providerAlertsSeen = response.alerts.length;

    for (const providerAlert of response.alerts) {
      const normalized = normalizeWeatherAlert(countyId, providerAlert);

      if (!normalized.ok) {
        result.rejectedAlerts.push({
          countyId,
          event: providerAlert.event ?? "",
          headline: providerAlert.headline ?? "",
          severity: providerAlert.severity ?? "",
          msgtype: providerAlert.msgtype ?? "",
          reason: normalized.reason,
        });
        continue;
      }

      result.alertsQualified += 1;
      result.countyBreakdown[countyId].qualified += 1;

      // Upsert on external_ref (Stage 1's partial unique index) so
      // re-running ingestion updates an already-seen alert (e.g. a
      // revised expiry) instead of inserting a duplicate row.
      const { data: upserted, error: upsertError } = await supabase
        .from("alerts")
        .upsert(
          {
            alert_type: "weather",
            subtype_id: normalized.alert.subtypeId,
            title: normalized.alert.title,
            message: normalized.alert.message,
            severity: normalized.alert.severity,
            source_name: "WeatherAPI.com",
            source_url: null,
            external_ref: normalized.alert.externalRef,
            metadata: normalized.alert.metadata,
            is_published: true,
            starts_at: normalized.alert.startsAt,
            expires_at: normalized.alert.expiresAt,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "external_ref" },
        )
        .select("id")
        .single();

      if (upsertError || !upserted) {
        result.errors.push(
          `${countyId}/${normalized.alert.externalRef}: ${upsertError?.message ?? "upsert returned no row"}`,
        );
        continue;
      }

      const { error: scopeError } = await supabase
        .from("alert_counties")
        .upsert(
          { alert_id: upserted.id, county_id: countyId },
          { onConflict: "alert_id,county_id" },
        );

      if (scopeError) {
        result.errors.push(
          `${countyId}/${normalized.alert.externalRef} scope: ${scopeError.message}`,
        );
        continue;
      }

      result.alertsUpserted += 1;
      result.countyBreakdown[countyId].upserted += 1;
    }
  }

  return result;
}
