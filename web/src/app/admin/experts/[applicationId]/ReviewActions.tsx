"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  MAX_REVIEW_NOTE_LENGTH,
  isStaleStateError,
  reviewErrorMessage,
  type AdminAction,
} from "@/lib/expertReview";
import { CharactersLeft, INPUT_CLASS, LABEL_CLASS, SECONDARY_BUTTON_CLASS } from "@/app/experts/apply/formParts";

type Mode =
  | { kind: "idle" }
  | { kind: "open"; action: AdminAction }
  | { kind: "loading"; action: AdminAction };

type Copy = {
  button: string;
  heading?: string;
  explain?: string;
  submit?: string;
  done: string;
  style: "primary" | "secondary" | "danger";
  // E1 requires a message to the applicant for these two.
  needsApplicantNote?: boolean;
};

const COPY: Record<AdminAction, Copy> = {
  start_review: {
    button: "Start review",
    done: "Review started. The application now shows as being reviewed.",
    style: "primary",
  },
  request_changes: {
    button: "Request changes",
    heading: "Ask the applicant for changes",
    explain:
      "The application goes back to the applicant to edit and send again. They get a notification and see your message.",
    submit: "Send request",
    done: "Changes requested. The applicant has been notified.",
    style: "secondary",
    needsApplicantNote: true,
  },
  approve: {
    button: "Approve",
    heading: "Approve this application?",
    explain:
      "This publishes their expert profile (title, headline, bio, county, years of experience, languages, specialties and a summary of their education and qualifications) and shows the Verified badge. Documents, credential numbers and registration numbers stay private. They get a notification.",
    submit: "Approve",
    done: "Approved. The applicant is now a Verified Expert and has been notified.",
    style: "primary",
  },
  reject: {
    button: "Reject",
    heading: "Reject this application",
    explain:
      "The applicant gets a notification and sees your message. They can apply again 30 days from today. Their documents are deleted after 12 months.",
    submit: "Reject application",
    done: "Rejected. The applicant has been notified.",
    style: "danger",
    needsApplicantNote: true,
  },
  suspend: {
    button: "Suspend expert",
    heading: "Suspend this expert?",
    explain:
      "Their Verified badge and expert profile are hidden, and they can't send a new application until they're reinstated. They get a notification.",
    submit: "Suspend",
    done: "Expert suspended. They have been notified.",
    style: "danger",
  },
  reinstate: {
    button: "Reinstate expert",
    heading: "Reinstate this expert?",
    explain: "Their Verified badge and expert profile are shown again. They get a notification.",
    submit: "Reinstate",
    done: "Expert reinstated. They have been notified.",
    style: "primary",
  },
};

const BUTTON_CLASSES: Record<Copy["style"], string> = {
  primary:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-shamba bg-shamba-green px-4 py-2 font-sans text-sm font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70",
  secondary: SECONDARY_BUTTON_CLASS,
  danger:
    "inline-flex min-h-11 items-center justify-center gap-2 rounded-shamba border border-shamba-rust/40 px-4 py-2 font-sans text-sm font-semibold text-shamba-rust transition-colors hover:bg-shamba-rust/10 disabled:cursor-not-allowed disabled:opacity-70",
};

// The admin decision controls for one application, plus suspend /
// reinstate for the expert it made. Every change goes through E1's review
// functions (which check is_admin() and log a review event); nothing is
// written directly. After a change the server page is refreshed, so the
// status, history and available actions always come from the database.
export function ReviewActions({
  applicationId,
  profileId,
  applicationActions,
  expertActions,
  approveBlockedReason,
}: {
  applicationId: string;
  profileId: string;
  applicationActions: AdminAction[];
  expertActions: AdminAction[];
  approveBlockedReason: string | null;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>({ kind: "idle" });
  const [applicantNote, setApplicantNote] = useState("");
  const [internalNote, setInternalNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const busy = mode.kind === "loading";

  function open(action: AdminAction) {
    setError(null);
    setDone(null);
    setApplicantNote("");
    setInternalNote("");
    if (action === "start_review") {
      void run(action);
    } else {
      setMode({ kind: "open", action });
    }
  }

  function cancel() {
    setMode({ kind: "idle" });
    setError(null);
  }

  async function run(action: AdminAction) {
    if (busy) return;
    const copy = COPY[action];
    if (copy.needsApplicantNote && applicantNote.trim() === "") {
      setError("Write a message to the applicant before sending this.");
      return;
    }

    setMode({ kind: "loading", action });
    setError(null);

    const supabase = createClient();
    const internal = internalNote.trim() || null;
    const applicant = applicantNote.trim();

    try {
      const { error: rpcError } = await callReviewFunction(supabase, action, {
        applicationId,
        profileId,
        applicant,
        internal,
      });

      if (rpcError) {
        setError(reviewErrorMessage(rpcError));
        if (isStaleStateError(rpcError)) {
          setMode({ kind: "idle" });
          router.refresh();
        } else {
          setMode(action === "start_review" ? { kind: "idle" } : { kind: "open", action });
        }
        return;
      }

      setMode({ kind: "idle" });
      setDone(copy.done);
      router.refresh();
    } catch {
      setError("Something went wrong. Please try again in a moment.");
      setMode(action === "start_review" ? { kind: "idle" } : { kind: "open", action });
    }
  }

  const activeAction = mode.kind === "idle" ? null : mode.action;
  const formAction = activeAction && activeAction !== "start_review" ? activeAction : null;

  return (
    <div className="flex flex-col gap-4">
      {done && (
        <p role="status" className="rounded-shamba bg-shamba-green/10 px-4 py-3 text-sm font-semibold text-shamba-green-deep">
          {done}
        </p>
      )}

      {!formAction && (
        <>
          {applicationActions.length > 0 && (
            <ActionGroup title="Decision">
              {applicationActions.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => open(action)}
                  disabled={busy || (action === "approve" && approveBlockedReason !== null)}
                  className={BUTTON_CLASSES[COPY[action].style]}
                >
                  {busy && activeAction === action && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  {COPY[action].button}
                </button>
              ))}
            </ActionGroup>
          )}
          {applicationActions.includes("approve") && approveBlockedReason && (
            <p className="text-sm leading-5 text-shamba-ink-soft">{approveBlockedReason}</p>
          )}

          {expertActions.length > 0 && (
            <ActionGroup title="Verified Expert status">
              {expertActions.map((action) => (
                <button
                  key={action}
                  type="button"
                  onClick={() => open(action)}
                  disabled={busy}
                  className={BUTTON_CLASSES[COPY[action].style]}
                >
                  {COPY[action].button}
                </button>
              ))}
            </ActionGroup>
          )}
        </>
      )}

      {formAction && (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void run(formAction);
          }}
          className="flex flex-col gap-4 rounded-shamba border border-shamba-line bg-shamba-bg p-4"
        >
          <div>
            <h3 className="font-display text-lg font-bold leading-tight text-shamba-ink">{COPY[formAction].heading}</h3>
            <p className="mt-1 text-sm leading-5 text-shamba-ink-soft">{COPY[formAction].explain}</p>
          </div>

          {COPY[formAction].needsApplicantNote && (
            <div className="flex flex-col gap-2">
              <label htmlFor="review-applicant-note" className={LABEL_CLASS}>
                Message to the applicant
              </label>
              <p id="review-applicant-note-hint" className="text-xs leading-4 text-shamba-ink-soft">
                Required. The applicant sees this exactly as written.
              </p>
              <textarea
                id="review-applicant-note"
                value={applicantNote}
                onChange={(event) => setApplicantNote(event.target.value.slice(0, MAX_REVIEW_NOTE_LENGTH))}
                maxLength={MAX_REVIEW_NOTE_LENGTH}
                rows={4}
                required
                aria-describedby="review-applicant-note-hint"
                disabled={busy}
                className={`${INPUT_CLASS} bg-shamba-card`}
              />
              <CharactersLeft value={applicantNote} max={MAX_REVIEW_NOTE_LENGTH} />
            </div>
          )}

          <div className="flex flex-col gap-2">
            <label htmlFor="review-internal-note" className={LABEL_CLASS}>
              Internal note <span className="font-normal text-shamba-ink-soft">(optional, admins only)</span>
            </label>
            <textarea
              id="review-internal-note"
              value={internalNote}
              onChange={(event) => setInternalNote(event.target.value.slice(0, MAX_REVIEW_NOTE_LENGTH))}
              maxLength={MAX_REVIEW_NOTE_LENGTH}
              rows={3}
              disabled={busy}
              className={`${INPUT_CLASS} bg-shamba-card`}
            />
            <CharactersLeft value={internalNote} max={MAX_REVIEW_NOTE_LENGTH} />
          </div>

          {error && (
            <p role="alert" className="text-sm font-semibold text-shamba-rust">
              {error}
            </p>
          )}

          <div className="flex flex-col-reverse gap-3 border-t border-shamba-line pt-4 sm:flex-row sm:justify-end">
            <button type="button" onClick={cancel} disabled={busy} className={SECONDARY_BUTTON_CLASS}>
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy || (COPY[formAction].needsApplicantNote === true && applicantNote.trim() === "")}
              className={BUTTON_CLASSES[COPY[formAction].style === "secondary" ? "primary" : COPY[formAction].style]}
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {COPY[formAction].submit}
            </button>
          </div>
        </form>
      )}

      {!formAction && error && (
        <p role="alert" className="text-sm font-semibold text-shamba-rust">
          {error}
        </p>
      )}
    </div>
  );
}

function ActionGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-shamba-ink-soft">{title}</p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

function callReviewFunction(
  supabase: ReturnType<typeof createClient>,
  action: AdminAction,
  values: { applicationId: string; profileId: string; applicant: string; internal: string | null },
) {
  switch (action) {
    case "start_review":
      return supabase.rpc("start_expert_review", { p_application_id: values.applicationId });
    case "request_changes":
      return supabase.rpc("request_expert_application_changes", {
        p_application_id: values.applicationId,
        p_applicant_note: values.applicant,
        p_internal_note: values.internal,
      });
    case "reject":
      return supabase.rpc("reject_expert_application", {
        p_application_id: values.applicationId,
        p_applicant_note: values.applicant,
        p_internal_note: values.internal,
      });
    case "approve":
      return supabase.rpc("approve_expert_application", {
        p_application_id: values.applicationId,
        p_internal_note: values.internal,
      });
    case "suspend":
      return supabase.rpc("suspend_expert", { p_profile_id: values.profileId, p_internal_note: values.internal });
    case "reinstate":
      return supabase.rpc("reinstate_expert", { p_profile_id: values.profileId, p_internal_note: values.internal });
  }
}
