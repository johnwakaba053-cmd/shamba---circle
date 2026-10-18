import Link from "next/link";
import { AlertTriangle, BadgeCheck, Clock, XCircle } from "lucide-react";
import { formatDay, type ExpertApplication } from "@/lib/experts";
import { WithdrawControl } from "./WithdrawControl";

type Kind = "in_review" | "approved" | "rejected" | "suspended";

// The application's status once it can no longer be edited. Reviewer
// notes shown here are only the note meant for the applicant; internal
// review notes never reach this page.
export function ApplicationStatusView({
  kind,
  application,
  reapplyOn = null,
}: {
  kind: Kind;
  application: ExpertApplication | null;
  reapplyOn?: string | null;
}) {
  return (
    <div className="rounded-shamba border border-shamba-line bg-shamba-card p-6 sm:p-8">
      <p className="font-mono text-xs font-semibold uppercase tracking-wide text-shamba-ochre">Expert application</p>

      {kind === "in_review" && application && (
        <>
          <StatusHeading icon={Clock} tone="bg-shamba-blue/10 text-shamba-blue">
            {application.status === "under_review" ? "Being reviewed" : "Submitted"}
          </StatusHeading>
          <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
            Thank you. Our team is checking your details and documents. We&apos;ll send you a notification when
            there&apos;s a decision or if we need anything else from you.
          </p>
          {application.submitted_at && (
            <p className="mt-4 font-mono text-xs text-shamba-ink-soft">Submitted {formatDay(application.submitted_at)}</p>
          )}
          <div className="mt-6 border-t border-shamba-line pt-4">
            <WithdrawControl applicationId={application.id} />
          </div>
        </>
      )}

      {kind === "approved" && (
        <>
          <StatusHeading icon={BadgeCheck} tone="bg-shamba-green/10 text-shamba-green">
            You&apos;re a Verified Expert
          </StatusHeading>
          <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
            Your application was approved. Farmers will see the Verified badge on your profile.
          </p>
          {application?.decided_at && (
            <p className="mt-4 font-mono text-xs text-shamba-ink-soft">Approved {formatDay(application.decided_at)}</p>
          )}
        </>
      )}

      {kind === "rejected" && application && (
        <>
          <StatusHeading icon={XCircle} tone="bg-shamba-rust/10 text-shamba-rust">
            Not approved this time
          </StatusHeading>
          <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
            We weren&apos;t able to verify your application.
          </p>
          {application.applicant_note && <ReviewerNote note={application.applicant_note} />}
          {reapplyOn && (
            <p className="mt-4 font-mono text-xs text-shamba-ink-soft">You can apply again from {formatDay(reapplyOn)}</p>
          )}
        </>
      )}

      {kind === "suspended" && (
        <>
          <StatusHeading icon={AlertTriangle} tone="bg-shamba-rust/10 text-shamba-rust">
            Verified Expert status suspended
          </StatusHeading>
          <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
            Your Verified badge is hidden while our team looks into your account, and you can&apos;t send a new
            application for now. We&apos;ll send you a notification when this changes.
          </p>
        </>
      )}

      <Link
        href="/profile"
        className="mt-6 inline-flex min-h-11 items-center font-sans text-sm font-semibold text-shamba-green hover:text-shamba-green-deep"
      >
        Back to your profile
      </Link>
    </div>
  );
}

export function ReviewerNote({ note }: { note: string }) {
  return (
    <div className="mt-4 rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-shamba-ink-soft">Message from our team</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-shamba-ink">{note}</p>
    </div>
  );
}

export function LoadErrorView() {
  return (
    <div className="rounded-shamba border border-shamba-line bg-shamba-card p-6 sm:p-8">
      <h1 className="font-display text-xl font-bold text-shamba-ink">We couldn&apos;t load your application</h1>
      <p role="alert" className="mt-2 text-base leading-6 text-shamba-ink-soft">
        Check your connection and try again. Nothing you saved has been lost.
      </p>
      <Link
        href="/experts/apply"
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-shamba border border-shamba-line px-6 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg"
      >
        Try again
      </Link>
    </div>
  );
}

function StatusHeading({
  icon: Icon,
  tone,
  children,
}: {
  icon: typeof Clock;
  tone: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 flex items-center gap-3">
      <span className={`flex size-11 shrink-0 items-center justify-center rounded-full ${tone}`}>
        <Icon className="size-5" aria-hidden="true" />
      </span>
      <h1 className="font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink">{children}</h1>
    </div>
  );
}
