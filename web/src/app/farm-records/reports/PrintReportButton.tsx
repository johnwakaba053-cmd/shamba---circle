"use client";

import { Printer } from "lucide-react";

export function PrintReportButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-shamba bg-shamba-green px-5 py-3 font-sans text-sm font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep sm:w-auto"
    >
      <Printer className="size-4" aria-hidden="true" />
      Print or save as PDF
    </button>
  );
}
