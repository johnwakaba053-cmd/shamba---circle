"use client";

import { Loader2, Pencil, Trash2 } from "lucide-react";
import type { ApplicationParts, ExpertStepId } from "@/lib/experts";

// Shared pieces of the Expert Registration steps, in the same style as
// Farm Records' forms (FarmForm, recordParts) so the app reads as one.

export type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

export type StepProps = {
  profileId: string;
  parts: ApplicationParts;
  setParts: (update: (current: ApplicationParts) => ApplicationParts) => void;
  goTo: (step: ExpertStepId) => void;
};

export const INPUT_CLASS =
  "w-full rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60";

export const LABEL_CLASS = "font-sans text-sm font-semibold text-shamba-ink";

const PRIMARY_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70";

export const SECONDARY_BUTTON_CLASS =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-shamba border border-shamba-line px-4 py-2 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg disabled:cursor-not-allowed disabled:opacity-70";

export function Optional() {
  return <span className="font-normal text-shamba-ink-soft">(optional)</span>;
}

export function Field({
  id,
  label,
  optional = false,
  hint,
  children,
}: {
  id: string;
  label: string;
  optional?: boolean;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className={LABEL_CLASS}>
        {label} {optional && <Optional />}
      </label>
      {children}
      {hint && <p className="text-xs leading-4 text-shamba-ink-soft">{hint}</p>}
    </div>
  );
}

export function CharactersLeft({ value, max }: { value: string; max: number }) {
  return <span className="font-mono text-xs text-shamba-ink-soft">{max - value.length} characters left</span>;
}

export function ErrorText({ status }: { status: Status }) {
  if (status.kind !== "error") return null;
  return (
    <p role="alert" className="text-sm font-semibold text-shamba-rust">
      {status.message}
    </p>
  );
}

// Back + primary action at the foot of a step. Full width and stacked on
// phones (primary on top, nearest the thumb), side by side from sm.
export function StepActions({
  onBack,
  primaryLabel,
  busyLabel = "Saving…",
  busy = false,
  disabled = false,
  primaryType = "submit",
  onPrimary,
}: {
  onBack?: () => void;
  primaryLabel: string;
  busyLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  primaryType?: "submit" | "button";
  onPrimary?: () => void;
}) {
  return (
    <div className="mt-2 flex flex-col-reverse gap-3 border-t border-shamba-line pt-4 sm:flex-row sm:items-center sm:justify-between">
      {onBack ? (
        <button type="button" onClick={onBack} disabled={busy} className={SECONDARY_BUTTON_CLASS}>
          Back
        </button>
      ) : (
        <span />
      )}
      <button type={primaryType} onClick={onPrimary} disabled={busy || disabled} className={PRIMARY_BUTTON_CLASS}>
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {busy ? busyLabel : primaryLabel}
      </button>
    </div>
  );
}

// One saved entry in a list step (education, qualification, experience):
// its summary lines plus Edit / Remove.
export function EntryRow({
  title,
  lines,
  onEdit,
  onRemove,
  removing,
  disabled,
}: {
  title: string;
  lines: React.ReactNode[];
  onEdit: () => void;
  onRemove: () => void;
  removing: boolean;
  disabled: boolean;
}) {
  return (
    <li className="flex items-start justify-between gap-3 py-3">
      <div className="min-w-0">
        <p className="break-words font-sans text-base font-semibold leading-6 text-shamba-ink">{title}</p>
        {lines.map((line, index) => (
          <p key={index} className="break-words text-sm leading-5 text-shamba-ink-soft">
            {line}
          </p>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        <button
          type="button"
          onClick={onEdit}
          disabled={disabled}
          aria-label={`Edit ${title}`}
          className="inline-flex size-11 items-center justify-center rounded-full text-shamba-ink-soft transition-colors hover:bg-shamba-bg hover:text-shamba-ink disabled:cursor-not-allowed disabled:opacity-60"
        >
          <Pencil className="size-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onRemove}
          disabled={disabled}
          aria-label={`Remove ${title}`}
          className="inline-flex size-11 items-center justify-center rounded-full text-shamba-ink-soft transition-colors hover:bg-shamba-bg hover:text-shamba-rust disabled:cursor-not-allowed disabled:opacity-60"
        >
          {removing ? <Loader2 className="size-4 animate-spin" aria-hidden="true" /> : <Trash2 className="size-4" aria-hidden="true" />}
        </button>
      </div>
    </li>
  );
}

// The buttons at the foot of an inline entry form. No Cancel while the
// list is empty: the form is the only thing in the step then.
export function EntryFormActions({ busy, onCancel, saveLabel = "Save" }: { busy: boolean; onCancel?: () => void; saveLabel?: string }) {
  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {onCancel && (
        <button type="button" onClick={onCancel} disabled={busy} className={SECONDARY_BUTTON_CLASS}>
          Cancel
        </button>
      )}
      <button
        type="submit"
        disabled={busy}
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-shamba bg-shamba-green px-4 py-2 font-sans text-sm font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70"
      >
        {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {busy ? "Saving…" : saveLabel}
      </button>
    </div>
  );
}

// Trimmed text, or null when empty -- optional text columns store NULL,
// never "".
export function textOrNull(value: string): string | null {
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

// "" -> null; otherwise a whole number in [min, max], or an error.
export function parseWholeNumber(
  value: string,
  min: number,
  max: number,
  label: string,
): { ok: true; value: number | null } | { ok: false; message: string } {
  const trimmed = value.trim();
  if (!trimmed) return { ok: true, value: null };
  if (!/^\d+$/.test(trimmed)) return { ok: false, message: `${label} must be a whole number.` };
  const number = Number(trimmed);
  if (number < min || number > max) return { ok: false, message: `${label} must be between ${min} and ${max}.` };
  return { ok: true, value: number };
}
