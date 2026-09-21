"use client";

import { useEffect, useId, useRef, useState } from "react";
import type { PriceObservation } from "@/lib/priceHistory";

// Hand-rolled SVG line chart -- this project has five runtime
// dependencies total and no charting library, so a new one isn't added
// for a single chart (matches the same reasoning behind the
// dependency-free KAMIS xlsx parser). X positions are spaced by index,
// not by elapsed time: real KAMIS reporting is sparse and irregular, and
// evenly-spaced points avoid a time-proportional axis implying a smooth
// continuous timeline that doesn't exist. A line segment is only drawn
// between two consecutive REAL points for the same series -- a gap
// (missing wholesale or retail on a given date) breaks the line rather
// than being interpolated across, so nothing not actually observed is
// ever implied as data.
//
// The SVG's viewBox width tracks the container's actual measured CSS
// pixel width (via ResizeObserver), rather than a fixed constant like
// 640 scaled by CSS. With a fixed viewBox, a narrow phone container
// (~300-330px) shrinks the whole drawing to roughly half scale, so a
// "10px" SVG font renders at an illegible ~5px -- while the same fixed
// viewBox looks fine on desktop. Measuring the real width and using it
// as the viewBox width makes 1 SVG unit equal to 1 real CSS pixel at
// every screen size, so a given fontSize is always that many actual
// pixels tall, on a phone or a desktop, without needing a separate
// mobile/desktop font size or a different chart structure.

const HEIGHT = 220;
const PADDING = { top: 16, right: 16, bottom: 28, left: 52 };
const FALLBACK_WIDTH = 640; // used only for the first paint, before ResizeObserver reports a real width

function formatKsh(value: number): string {
  return `KSh ${value.toLocaleString("en-KE", { maximumFractionDigits: 2 })}`;
}

function formatDisplayDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-GB", { day: "2-digit", month: "short" });
}

type Series = {
  key: "wholesale" | "retail";
  label: string;
  color: string;
  values: (number | null)[];
};

export function PriceHistoryChart({
  observations,
  unit,
}: {
  observations: PriceObservation[];
  unit: string;
}) {
  const gradientId = useId();
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(FALLBACK_WIDTH);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const observer = new ResizeObserver((entries) => {
      const measured = entries[0]?.contentRect.width;
      if (measured && measured > 0) setWidth(measured);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const hasWholesale = observations.some((o) => o.wholesale !== null);
  const hasRetail = observations.some((o) => o.retail !== null);

  if (observations.length === 0 || (!hasWholesale && !hasRetail)) {
    return null;
  }

  const series: Series[] = [
    ...(hasWholesale
      ? [{ key: "wholesale" as const, label: "Wholesale", color: "var(--shamba-green)", values: observations.map((o) => o.wholesale) }]
      : []),
    ...(hasRetail
      ? [{ key: "retail" as const, label: "Retail", color: "var(--shamba-blue)", values: observations.map((o) => o.retail) }]
      : []),
  ];

  const allValues = series.flatMap((s) => s.values).filter((v): v is number => v !== null);
  const minValue = Math.min(...allValues);
  const maxValue = Math.max(...allValues);
  const valueRange = maxValue - minValue || 1;
  const yPad = valueRange * 0.1;
  const yMin = Math.max(0, minValue - yPad);
  const yMax = maxValue + yPad;

  const plotWidth = width - PADDING.left - PADDING.right;
  const plotHeight = HEIGHT - PADDING.top - PADDING.bottom;

  const xForIndex = (index: number) =>
    observations.length === 1
      ? PADDING.left + plotWidth / 2
      : PADDING.left + (index / (observations.length - 1)) * plotWidth;
  const yForValue = (value: number) =>
    PADDING.top + plotHeight - ((value - yMin) / (yMax - yMin)) * plotHeight;

  const yTicks = [yMin, yMin + (yMax - yMin) / 2, yMax];

  function pathForSeries(values: (number | null)[]): string {
    const segments: string[] = [];
    let currentSegment: string[] = [];
    values.forEach((value, index) => {
      if (value === null) {
        if (currentSegment.length > 1) segments.push(currentSegment.join(" "));
        currentSegment = [];
        return;
      }
      currentSegment.push(`${xForIndex(index)},${yForValue(value)}`);
    });
    if (currentSegment.length > 1) segments.push(currentSegment.join(" "));
    return segments.join(" M");
  }

  // Show fewer x-axis date labels on a narrower measured width so they
  // never overlap, rather than a fixed count regardless of screen size.
  const maxLabels = width < 400 ? 4 : width < 560 ? 5 : 6;
  const labelEvery = Math.max(1, Math.ceil(observations.length / maxLabels));

  return (
    <div ref={containerRef} className="w-full">
      <svg
        viewBox={`0 0 ${width} ${HEIGHT}`}
        width={width}
        height={HEIGHT}
        className="w-full"
        role="img"
        aria-label={`Price history chart in ${unit}. Exact values are listed in the table below the chart.`}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--shamba-line)" stopOpacity="0.5" />
            <stop offset="100%" stopColor="var(--shamba-line)" stopOpacity="0" />
          </linearGradient>
        </defs>

        {yTicks.map((tick) => (
          <g key={tick}>
            <line
              x1={PADDING.left}
              x2={width - PADDING.right}
              y1={yForValue(tick)}
              y2={yForValue(tick)}
              stroke="var(--shamba-line)"
              strokeWidth={1}
            />
            <text x={PADDING.left - 8} y={yForValue(tick) + 4} textAnchor="end" fontSize={12} fill="var(--shamba-ink-soft)">
              {Math.round(tick).toLocaleString("en-KE")}
            </text>
          </g>
        ))}

        {observations.map((obs, index) =>
          index % labelEvery === 0 ? (
            <text
              key={obs.recordedAt}
              x={xForIndex(index)}
              y={HEIGHT - 6}
              textAnchor="middle"
              fontSize={12}
              fill="var(--shamba-ink-soft)"
            >
              {formatDisplayDate(obs.recordedAt)}
            </text>
          ) : null,
        )}

        {series.map((s) => (
          <path key={s.key} d={`M${pathForSeries(s.values)}`} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
        ))}

        {series.map((s) =>
          s.values.map((value, index) =>
            value === null ? null : (
              <circle
                key={`${s.key}-${index}`}
                cx={xForIndex(index)}
                cy={yForValue(value)}
                r={hoverIndex === index ? 4.5 : 3}
                fill={s.color}
                stroke="var(--shamba-card)"
                strokeWidth={1.5}
                onMouseEnter={() => setHoverIndex(index)}
                onFocus={() => setHoverIndex(index)}
                tabIndex={0}
                role="button"
                aria-label={`${s.label} on ${formatDisplayDate(observations[index].recordedAt)}: ${formatKsh(value)} per ${unit}`}
              >
                <title>
                  {s.label} · {formatDisplayDate(observations[index].recordedAt)}: {formatKsh(value)}/{unit}
                </title>
              </circle>
            ),
          ),
        )}

        {hoverIndex !== null && (
          <line
            x1={xForIndex(hoverIndex)}
            x2={xForIndex(hoverIndex)}
            y1={PADDING.top}
            y2={HEIGHT - PADDING.bottom}
            stroke="var(--shamba-ink-soft)"
            strokeWidth={1}
            strokeDasharray="3 3"
          />
        )}
      </svg>

      {hoverIndex !== null && (
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 rounded-shamba border border-shamba-line bg-shamba-card px-3 py-2 text-xs text-shamba-ink">
          <span className="font-semibold">{formatDisplayDate(observations[hoverIndex].recordedAt)}</span>
          {observations[hoverIndex].wholesale !== null && (
            <span style={{ color: "var(--shamba-green)" }}>
              Wholesale: {formatKsh(observations[hoverIndex].wholesale as number)}/{unit}
            </span>
          )}
          {observations[hoverIndex].retail !== null && (
            <span style={{ color: "var(--shamba-blue)" }}>
              Retail: {formatKsh(observations[hoverIndex].retail as number)}/{unit}
            </span>
          )}
        </div>
      )}

      <div className="mt-2 flex flex-wrap gap-4 text-xs text-shamba-ink-soft">
        {series.map((s) => (
          <span key={s.key} className="inline-flex items-center gap-1.5">
            <span className="inline-block h-0.5 w-4 rounded-full" style={{ backgroundColor: s.color }} aria-hidden="true" />
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}
