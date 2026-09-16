"use client";

import { useState } from "react";
import { Bug, Check, CloudSun, ExternalLink, TrendingUp } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
  is_read: boolean;
  read_at: string | null;
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
  const [isRead, setIsRead] = useState(alert.is_read);
  const [isMarking, setIsMarking] = useState(false);
  const [markFailed, setMarkFailed] = useState(false);

  const TypeIcon = ALERT_TYPE_ICON[alert.alert_type] ?? CloudSun;
  const typeLabel = ALERT_TYPE_LABELS[alert.alert_type] ?? alert.alert_type;
  const subtypeLabel = ALERT_SUBTYPE_LABELS[alert.subtype_id] ?? alert.subtype_id;
  const severityStyle =
    SEVERITY_STYLES[alert.severity] ?? "border-2 border-shamba-line text-shamba-ink-soft";
  const severityLabel = SEVERITY_LABELS[alert.severity] ?? alert.severity;

  // Idempotent server-side (mark_alert_as_read no-ops on an
  // already-read alert), but guarding here too avoids a pointless
  // network call every time an already-read card is clicked again.
  async function handleMarkRead() {
    if (isRead || isMarking) return;

    setIsMarking(true);
    setMarkFailed(false);

    try {
      const supabase = createClient();
      const { error } = await supabase.rpc("mark_alert_as_read", {
        p_alert_id: alert.id,
      });

      if (error) {
        // Never shown to the user (that would expose raw DB/implementation
        // detail) -- console-only, so a real failure is actually visible
        // in DevTools instead of silently swallowed.
        console.error("mark_alert_as_read failed", alert.id, error);
        setMarkFailed(true);
        return;
      }

      setIsRead(true);
    } catch (err) {
      console.error("mark_alert_as_read threw", alert.id, err);
      setMarkFailed(true);
    } finally {
      setIsMarking(false);
    }
  }

  return (
    // Only the explicit "Mark as read" button triggers the RPC -- not a
    // click handler on the card itself. This element already contains a
    // real link (the source), and layering a second click target on a
    // non-interactive wrapper around that link is an easy source of
    // ambiguous/inconsistent behavior (and a nested-interactive-control
    // accessibility smell) for no real benefit over a single, obvious
    // button.
    <article
      className={`flex flex-col gap-3 rounded-shamba border p-4 ${
        isRead ? "border-shamba-line bg-shamba-card" : "border-shamba-green bg-shamba-card"
      }`}
    >
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

      <div className="flex items-start justify-between gap-2">
        <h2
          className={`font-display text-base leading-tight text-shamba-ink ${
            isRead ? "font-medium" : "font-bold"
          }`}
        >
          {alert.title}
        </h2>

        {!isRead && (
          <span className="shrink-0 rounded-shamba bg-shamba-green px-2 py-1 font-mono text-xs font-semibold text-shamba-card">
            Unread
          </span>
        )}
      </div>

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

      <div className="flex items-center justify-between gap-2">
        {isRead ? (
          <span className="inline-flex items-center gap-1 text-xs text-shamba-ink-soft">
            <Check className="size-3" aria-hidden="true" />
            Read
          </span>
        ) : (
          <button
            type="button"
            onClick={handleMarkRead}
            disabled={isMarking}
            className="text-xs font-semibold text-shamba-green underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isMarking ? "Marking as read…" : "Mark as read"}
          </button>
        )}

        {markFailed && (
          <p role="alert" className="text-xs font-semibold text-shamba-rust">
            Couldn&apos;t update. Please try again.
          </p>
        )}
      </div>
    </article>
  );
}
