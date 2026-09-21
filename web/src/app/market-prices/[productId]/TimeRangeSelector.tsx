"use client";

import { useRouter, useSearchParams } from "next/navigation";

const RANGE_OPTIONS: { value: string; label: string }[] = [
  { value: "7", label: "7 Days" },
  { value: "30", label: "30 Days" },
  { value: "90", label: "3 Months" },
  { value: "180", label: "6 Months" },
  { value: "365", label: "1 Year" },
  { value: "all", label: "All" },
];

export function TimeRangeSelector({
  productId,
  selectedRange,
}: {
  productId: string;
  selectedRange: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();

  function handleSelect(value: string) {
    const params = new URLSearchParams(searchParams.toString());
    params.set("range", value);
    router.push(`/market-prices/${productId}?${params.toString()}`);
  }

  return (
    <div className="flex flex-wrap gap-2" role="group" aria-label="Time range">
      {RANGE_OPTIONS.map((option) => {
        const isActive = option.value === selectedRange;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => handleSelect(option.value)}
            aria-pressed={isActive}
            className={
              isActive
                ? "rounded-shamba bg-shamba-green px-3 py-1.5 font-sans text-xs font-semibold text-shamba-card"
                : "rounded-shamba border border-shamba-line px-3 py-1.5 font-sans text-xs font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink"
            }
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
