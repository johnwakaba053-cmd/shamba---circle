import type { ApplicationStatus } from "@/lib/experts";
import {
  APPLICATION_STATUS_META,
  EXPERT_STATUS_META,
  TONE_CLASSES,
  type ExpertStatus,
} from "@/lib/expertReview";

// Status pill used across the admin expert pages. Colour always comes
// with the written status, never instead of it.
export function ApplicationStatusBadge({ status }: { status: ApplicationStatus }) {
  const meta = APPLICATION_STATUS_META[status];
  return <Badge tone={TONE_CLASSES[meta.tone]}>{meta.label}</Badge>;
}

export function ExpertStatusBadge({ status }: { status: ExpertStatus }) {
  const meta = EXPERT_STATUS_META[status];
  return <Badge tone={TONE_CLASSES[meta.tone]}>{meta.label}</Badge>;
}

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 font-mono text-[11px] font-semibold uppercase tracking-wide ${tone}`}
    >
      {children}
    </span>
  );
}
