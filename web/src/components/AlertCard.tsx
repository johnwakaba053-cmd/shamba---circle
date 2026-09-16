import { Bug, CloudSun, ExternalLink, TrendingUp } from "lucide-react";

export type Alert = {
  id: string;
  alert_type: string;
  subtype_id: string;
  title: string;
  message: string;
  severity: string;
  source_name: string | null;
  source_url: string | null;
  metadata: Record<string, unknown> | null;
  starts_at: string;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

// Alert type + subtype labels/icons are small fixed vocabularies (same
// shape as the per-page icon maps already used on Communities/Feed),
// kept local to this component rather than fetched from
// alert_subtypes -- the RPC never returns a joined subtype name, and
// this stage's only personalized-data dependency should stay
// get_my_alerts() alone.
const ALERT_TYPE_LABELS: Record<string, string> = {
  weather: "Weather",
  pest_disease: "Pest & Disease",
  market_price: "Market Prices",
};

const ALERT_TYPE_ICON: Record<string, typeof CloudSun> = {
  weather: CloudSun,
  pest_disease: Bug,
  market_price: TrendingUp,
};

const ALERT_SUBTYPE_LABELS: Record<string, string> = {
  rain: "Rain",
  heavy_rain: "Heavy Rain",
  dry_spell: "Dry Spell",
  extreme_weather: "Extreme Weather",
  crop_disease: "Crop Disease",
  crop_pest: "Crop Pest",
  livestock_disease: "Livestock Disease",
  livestock_pest: "Livestock Pest/Health",
  market_price_change: "Price Change",
};

// Text label always renders alongside color, so severity is never
// communicated by color alone. Visual weight escalates across the four
// values (calm blue -> filled rust) without inventing a fifth level.
const SEVERITY_STYLES: Record<string, string> = {
  info: "bg-shamba-blue text-shamba-card",
  advisory: "bg-shamba-ochre text-shamba-card",
  warning: "border-2 border-shamba-rust text-shamba-rust",
  severe: "bg-shamba-rust text-shamba-card",
};

const SEVERITY_LABELS: Record<string, string> = {
  info: "Info",
  advisory: "Advisory",
  warning: "Warning",
  severe: "Severe",
};

export function AlertCard({ alert }: { alert: Alert }) {
  const TypeIcon = ALERT_TYPE_ICON[alert.alert_type] ?? CloudSun;
  const typeLabel = ALERT_TYPE_LABELS[alert.alert_type] ?? alert.alert_type;
  const subtypeLabel = ALERT_SUBTYPE_LABELS[alert.subtype_id] ?? alert.subtype_id;
  const severityStyle =
    SEVERITY_STYLES[alert.severity] ?? "border-2 border-shamba-line text-shamba-ink-soft";
  const severityLabel = SEVERITY_LABELS[alert.severity] ?? alert.severity;

  return (
    <article className="flex flex-col gap-3 rounded-shamba border border-shamba-line bg-shamba-card p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2 font-mono text-xs font-semibold text-shamba-ink-soft">
          <TypeIcon className="size-4 text-shamba-green" aria-hidden="true" />
          {typeLabel} · {subtypeLabel}
        </div>

        <span
          className={`rounded-shamba px-2 py-1 font-mono text-xs font-semibold ${severityStyle}`}
        >
          {severityLabel}
        </span>
      </div>

      <h2 className="font-display text-base font-semibold leading-tight text-shamba-ink">
        {alert.title}
      </h2>

      <p className="whitespace-pre-wrap text-sm leading-6 text-shamba-ink-soft">
        {alert.message}
      </p>

      <div className="mt-1 flex flex-col gap-1 border-t border-shamba-line pt-3 text-xs text-shamba-ink-soft">
        <p>
          Posted {new Date(alert.starts_at).toLocaleDateString()}
          {alert.expires_at
            ? ` · Valid until ${new Date(alert.expires_at).toLocaleDateString()}`
            : " · Ongoing"}
        </p>

        {(alert.source_name || alert.source_url) && (
          <p>
            Source:{" "}
            {alert.source_url ? (
              <a
                href={alert.source_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 font-semibold text-shamba-blue transition-colors hover:text-shamba-green-deep"
              >
                {alert.source_name ?? alert.source_url}
                <ExternalLink className="size-3" aria-hidden="true" />
              </a>
            ) : (
              <span className="font-semibold">{alert.source_name}</span>
            )}
          </p>
        )}
      </div>
    </article>
  );
}
