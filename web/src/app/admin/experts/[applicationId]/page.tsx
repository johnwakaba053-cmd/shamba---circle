import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, FileText, ImageIcon } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import {
  DOCUMENT_COLUMNS,
  EDUCATION_COLUMNS,
  EXPERIENCE_COLUMNS,
  QUALIFICATION_COLUMNS,
  educationLevelLabel,
  formatDay,
  formatFileSize,
  formatMonth,
  type EducationEntry,
  type ExperienceEntry,
  type ExpertDocument,
  type QualificationEntry,
} from "@/lib/experts";
import {
  ADMIN_APPLICATION_COLUMNS,
  APPLICANT_ACTIONS,
  DOCUMENT_KIND_LABELS,
  EXPERT_RECORD_COLUMNS,
  REVIEW_ACTION_LABELS,
  REVIEW_EVENT_COLUMNS,
  applicationActions,
  expertActions,
  shortApplicationId,
  type AdminApplication,
  type ExpertRecord,
  type ReviewEvent,
} from "@/lib/expertReview";
import { requireAdmin } from "@/lib/staff";
import { ApplicationStatusBadge, ExpertStatusBadge } from "../StatusBadge";
import { AdminDocumentButton } from "./AdminDocumentButton";
import { ReviewActions } from "./ReviewActions";

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// /admin/experts/[applicationId]: one expert application, read-only, with
// the admin's review controls (Experts E3). Admins only (requireAdmin);
// the admin-only RLS policies from E1 are what actually allow these reads.
// A private applicant's name is never shown -- only a public profile's
// name, exactly as get_public_profile() returns it to anyone.
export default async function ExpertApplicationReview({
  params,
}: {
  params: Promise<{ applicationId: string }>;
}) {
  const { applicationId } = await params;
  const { supabase, user } = await requireAdmin();

  if (!UUID_PATTERN.test(applicationId)) {
    notFound();
  }

  const { data: applicationData, error: applicationError } = await supabase
    .from("expert_applications")
    .select(ADMIN_APPLICATION_COLUMNS)
    .eq("id", applicationId)
    .maybeSingle();

  if (applicationError) {
    return <Shell><LoadError /></Shell>;
  }
  if (!applicationData) {
    notFound();
  }

  const application = applicationData as AdminApplication;

  const [
    specialtiesResult,
    specialtyNamesResult,
    educationResult,
    qualificationsResult,
    experienceResult,
    documentsResult,
    eventsResult,
    expertResult,
    countyResult,
    publicProfileResult,
  ] = await Promise.all([
    supabase.from("expert_application_specialties").select("specialty_id").eq("application_id", application.id),
    supabase.from("expert_specialties").select("id, name"),
    supabase.from("expert_education").select(EDUCATION_COLUMNS).eq("application_id", application.id).order("sort_order").order("created_at"),
    supabase.from("expert_qualifications").select(QUALIFICATION_COLUMNS).eq("application_id", application.id).order("created_at"),
    supabase.from("expert_experience").select(EXPERIENCE_COLUMNS).eq("application_id", application.id).order("start_date", { ascending: false }),
    supabase.from("expert_documents").select(DOCUMENT_COLUMNS).eq("application_id", application.id).order("created_at"),
    supabase.from("expert_review_events").select(REVIEW_EVENT_COLUMNS).eq("application_id", application.id).order("created_at", { ascending: true }),
    supabase.from("experts").select(EXPERT_RECORD_COLUMNS).eq("profile_id", application.profile_id).maybeSingle(),
    application.county_id
      ? supabase.from("counties").select("name").eq("id", application.county_id).maybeSingle()
      : Promise.resolve({ data: null, error: null }),
    supabase.rpc("get_public_profile", { p_profile_id: application.profile_id }).maybeSingle(),
  ]);

  const partsFailed =
    specialtiesResult.error ||
    educationResult.error ||
    qualificationsResult.error ||
    experienceResult.error ||
    documentsResult.error ||
    eventsResult.error ||
    expertResult.error;

  if (partsFailed) {
    return <Shell><LoadError /></Shell>;
  }

  const specialtyNames = new Map((specialtyNamesResult.data ?? []).map((row) => [row.id as string, row.name as string]));
  const specialties = (specialtiesResult.data ?? []).map(
    (row) => specialtyNames.get(row.specialty_id as string) ?? (row.specialty_id as string),
  );
  const education = (educationResult.data ?? []) as EducationEntry[];
  const qualifications = (qualificationsResult.data ?? []) as QualificationEntry[];
  const experience = (experienceResult.data ?? []) as ExperienceEntry[];
  const documents = (documentsResult.data ?? []) as ExpertDocument[];
  const events = (eventsResult.data ?? []) as ReviewEvent[];
  const expert = (expertResult.data as ExpertRecord | null) ?? null;
  const countyName = (countyResult.data as { name: string } | null)?.name ?? null;
  const publicProfile = publicProfileResult.data as { display_name: string | null; is_public: boolean } | null;
  const publicName = publicProfile?.is_public ? publicProfile.display_name : null;

  // Admins can't act on their own application or expert status -- the
  // database refuses it (cannot_review_own_expert_application); the
  // Review panel is replaced by a notice so the buttons never show.
  const isOwnApplication = application.profile_id === user.id;

  // Suspend / reinstate act on the person, but they're offered only on the
  // application their current expert record was approved from, so there's
  // one obvious place to manage it.
  const isCurrentExpertApplication = expert?.application_id === application.id;
  const decisionActions = applicationActions(application.status);
  const statusActions = isCurrentExpertApplication ? expertActions(expert.status) : [];
  const approveBlockedReason =
    expert?.status === "suspended"
      ? "Approve isn't available: this person's Verified Expert status is suspended. Reinstate them first."
      : null;

  const actorNames = await loadActorNames(
    supabase,
    events.map((event) => event.actor_profile_id),
    user.id,
    application.profile_id,
  );

  const documentsById = new Map(documents.map((document) => [document.id, document]));
  const cv = documents.find((document) => document.kind === "cv") ?? null;
  const otherDocuments = documents.filter((document) => document.kind !== "cv");
  const reference = shortApplicationId(application.id);

  return (
    <Shell>
      <Link
        href="/admin/experts"
        className="inline-flex min-h-11 items-center gap-1.5 self-start font-sans text-sm font-semibold text-shamba-green hover:text-shamba-green-deep"
      >
        <ArrowLeft className="size-4" aria-hidden="true" />
        Expert verification
      </Link>

      {/* Who and where it stands */}
      <section className="rounded-shamba border border-shamba-line bg-shamba-card p-5 sm:p-6">
        <p className="font-mono text-xs font-semibold uppercase tracking-wide text-shamba-ochre">
          Expert application · {reference}
        </p>
        <h1 className="mt-1 break-words font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink">
          {application.professional_title ?? "Untitled application"}
        </h1>
        <div className="mt-3 flex flex-wrap gap-2">
          <ApplicationStatusBadge status={application.status} />
          {expert && <ExpertStatusBadge status={expert.status} />}
        </div>

        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Detail term="Applicant">
            {publicName ? (
              <Link
                href={`/profile/${application.profile_id}`}
                className="font-semibold text-shamba-green hover:text-shamba-green-deep"
              >
                {publicName}
              </Link>
            ) : (
              <span>Private profile (name hidden)</span>
            )}
          </Detail>
          <Detail term="County">{countyName ?? "Not given"}</Detail>
          <Detail term="Started">{formatDay(application.created_at)}</Detail>
          <Detail term="Submitted">{application.submitted_at ? formatDay(application.submitted_at) : "Not yet"}</Detail>
          {application.decided_at && <Detail term="Decided">{formatDay(application.decided_at)}</Detail>}
          {expert && (
            <Detail term="Expert since">
              {formatDay(expert.verified_at)}
              {expert.status === "suspended" && expert.suspended_at ? ` · suspended ${formatDay(expert.suspended_at)}` : ""}
            </Detail>
          )}
        </dl>

        {application.applicant_note && (application.status === "changes_requested" || application.status === "rejected") && (
          <NoteBox label="Message sent to the applicant" note={application.applicant_note} />
        )}

        {expert && !isCurrentExpertApplication && (
          <p className="mt-4 text-sm leading-5 text-shamba-ink-soft">
            This person&apos;s expert record comes from a different application.{" "}
            <Link
              href={`/admin/experts/${expert.application_id}`}
              className="font-semibold text-shamba-green hover:text-shamba-green-deep"
            >
              Manage their expert status there
            </Link>
            .
          </p>
        )}
      </section>

      {isOwnApplication ? (
        <section className="rounded-shamba border border-shamba-ochre/40 bg-shamba-ochre/10 p-5 sm:p-6">
          <SectionTitle>Review</SectionTitle>
          <p className="mt-2 text-sm leading-5 text-shamba-ink">
            This is your application. Another admin must review it.
          </p>
        </section>
      ) : (decisionActions.length > 0 || statusActions.length > 0) && (
        <section className="rounded-shamba border border-shamba-line bg-shamba-card p-5 sm:p-6">
          <SectionTitle>Review</SectionTitle>
          <div className="mt-3">
            <ReviewActions
              applicationId={application.id}
              profileId={application.profile_id}
              applicationActions={decisionActions}
              expertActions={statusActions}
              approveBlockedReason={approveBlockedReason}
            />
          </div>
        </section>
      )}

      <Section title="About">
        {application.headline && (
          <p className="break-words font-sans text-base font-semibold leading-6 text-shamba-ink">{application.headline}</p>
        )}
        {application.bio && (
          <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-shamba-ink-soft">{application.bio}</p>
        )}
        <dl className="mt-4 grid grid-cols-1 gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
          <Detail term="Years of experience">
            {application.years_experience != null ? application.years_experience : "Not given"}
          </Detail>
          <Detail term="Languages">
            {application.languages && application.languages.length > 0 ? application.languages.join(", ") : "Not given"}
          </Detail>
          <Detail term="Registration body">{application.registration_body ?? "None given"}</Detail>
          <Detail term="Registration number">{application.registration_number ?? "None given"}</Detail>
        </dl>
      </Section>

      <Section title="Specialties">
        {specialties.length === 0 ? (
          <Empty>None chosen.</Empty>
        ) : (
          <ul className="flex flex-wrap gap-2">
            {specialties.map((name) => (
              <li
                key={name}
                className="rounded-full border border-shamba-line bg-shamba-bg px-3 py-1 font-sans text-sm text-shamba-ink"
              >
                {name}
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="Education">
        {education.length === 0 ? (
          <Empty>No education added.</Empty>
        ) : (
          <EntryList>
            {education.map((entry) => (
              <Entry
                key={entry.id}
                title={`${educationLevelLabel(entry.level)} · ${entry.field_of_study}`}
                lines={[entry.institution, yearRange(entry.start_year, entry.end_year)]}
              />
            ))}
          </EntryList>
        )}
      </Section>

      <Section title="Qualifications and certificates">
        {qualifications.length === 0 ? (
          <Empty>No qualifications added.</Empty>
        ) : (
          <EntryList>
            {qualifications.map((entry) => {
              const linked = entry.document_id ? documentsById.get(entry.document_id) ?? null : null;
              return (
                <Entry
                  key={entry.id}
                  title={entry.title}
                  lines={[
                    entry.issuing_body,
                    entry.credential_number ? `Credential number: ${entry.credential_number}` : null,
                    dateRange("Issued", entry.issued_on, "expires", entry.expires_on),
                  ]}
                >
                  {linked ? (
                    <AdminDocumentButton documentId={linked.id} label={`Open ${linked.file_name}`} />
                  ) : entry.document_id ? (
                    <p className="text-sm text-shamba-ink-soft">Certificate file no longer available.</p>
                  ) : null}
                </Entry>
              );
            })}
          </EntryList>
        )}
      </Section>

      <Section title="Work experience">
        {experience.length === 0 ? (
          <Empty>No work experience added.</Empty>
        ) : (
          <EntryList>
            {experience.map((entry) => (
              <Entry
                key={entry.id}
                title={entry.role_title}
                lines={[
                  entry.organisation,
                  `${formatMonth(entry.start_date)} to ${entry.end_date ? formatMonth(entry.end_date) : "now"}`,
                ]}
              >
                {entry.description && (
                  <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-shamba-ink-soft">
                    {entry.description}
                  </p>
                )}
              </Entry>
            ))}
          </EntryList>
        )}
      </Section>

      <Section title="CV and documents">
        {application.documents_purged_at ? (
          <Empty>
            Files were deleted on {formatDay(application.documents_purged_at)} under the 12-month retention rule.
          </Empty>
        ) : documents.length === 0 ? (
          <Empty>No files uploaded.</Empty>
        ) : (
          <>
            <p className="mb-3 text-sm leading-5 text-shamba-ink-soft">
              Files are private. Each link is made when you tap Open and works for 60 seconds.
            </p>
            <ul className="flex flex-col gap-3">
              {[...(cv ? [cv] : []), ...otherDocuments].map((document) => (
                <DocumentRow key={document.id} document={document} />
              ))}
            </ul>
            {!cv && <p className="mt-3 text-sm font-semibold text-shamba-rust">No CV on this application.</p>}
          </>
        )}
        {application.purge_after && !application.documents_purged_at && (
          <p className="mt-3 font-mono text-xs text-shamba-ink-soft">
            Files will be deleted after {formatDay(application.purge_after)}.
          </p>
        )}
      </Section>

      <Section title="Review history">
        {events.length === 0 ? (
          <Empty>No review activity yet.</Empty>
        ) : (
          <ol className="flex flex-col divide-y divide-shamba-line">
            {events.map((event) => (
              <li key={event.id} className="py-3 first:pt-0 last:pb-0">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                  <p className="font-sans text-sm font-semibold text-shamba-ink">{REVIEW_ACTION_LABELS[event.action]}</p>
                  <p className="font-mono text-xs text-shamba-ink-soft">{formatDay(event.created_at)}</p>
                </div>
                <p className="text-sm text-shamba-ink-soft">
                  By{" "}
                  {APPLICANT_ACTIONS.includes(event.action)
                    ? "the applicant"
                    : actorNames.get(event.actor_profile_id ?? "") ?? "an admin"}
                </p>
                {event.applicant_note && <NoteBox label="Message to the applicant" note={event.applicant_note} />}
                {event.internal_note && <NoteBox label="Internal note (admins only)" note={event.internal_note} internal />}
              </li>
            ))}
          </ol>
        )}
      </Section>
    </Shell>
  );
}

// Reviewer names for the history: "you" for the signed-in admin, the
// public name for a public profile, otherwise "an admin".
async function loadActorNames(
  supabase: Awaited<ReturnType<typeof requireAdmin>>["supabase"],
  actorIds: (string | null)[],
  currentUserId: string,
  applicantId: string,
): Promise<Map<string, string>> {
  const names = new Map<string, string>();
  const others = [...new Set(actorIds.filter((id): id is string => Boolean(id)))].filter(
    (id) => id !== currentUserId && id !== applicantId,
  );
  names.set(currentUserId, "you");

  const results = await Promise.all(
    others.map((id) => supabase.rpc("get_public_profile", { p_profile_id: id }).maybeSingle()),
  );
  others.forEach((id, index) => {
    const row = results[index].data as { display_name: string | null; is_public: boolean } | null;
    if (row?.is_public && row.display_name) names.set(id, row.display_name);
  });
  return names;
}

function yearRange(start: number | null, end: number | null): string | null {
  if (start && end) return `${start} to ${end}`;
  if (end) return `Finished ${end}`;
  if (start) return `Started ${start}`;
  return null;
}

function dateRange(startLabel: string, start: string | null, endLabel: string, end: string | null): string | null {
  const parts = [start ? `${startLabel} ${formatMonth(start)}` : null, end ? `${endLabel} ${formatMonth(end)}` : null].filter(Boolean);
  return parts.length > 0 ? parts.join(", ") : null;
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 pb-20 pt-6 sm:px-10 sm:pt-12">
        <div className="flex w-full max-w-2xl flex-col gap-4">{children}</div>
      </main>
    </div>
  );
}

function LoadError() {
  return (
    <div className="rounded-shamba border border-shamba-line bg-shamba-card p-6">
      <h1 className="font-display text-xl font-bold text-shamba-ink">We couldn&apos;t load this application</h1>
      <p role="alert" className="mt-2 text-base leading-6 text-shamba-ink-soft">
        Check your connection and try again.
      </p>
      <Link
        href="/admin/experts"
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-shamba border border-shamba-line px-6 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg"
      >
        Back to Expert verification
      </Link>
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <h2 className="font-display text-lg font-bold leading-tight text-shamba-ink">{children}</h2>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-shamba border border-shamba-line bg-shamba-card p-5 sm:p-6">
      <SectionTitle>{title}</SectionTitle>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function Detail({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="font-mono text-[11px] font-semibold uppercase tracking-wide text-shamba-ink-soft">{term}</dt>
      <dd className="mt-0.5 break-words text-shamba-ink">{children}</dd>
    </div>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm leading-5 text-shamba-ink-soft">{children}</p>;
}

function EntryList({ children }: { children: React.ReactNode }) {
  return <ul className="flex flex-col divide-y divide-shamba-line">{children}</ul>;
}

function Entry({
  title,
  lines,
  children,
}: {
  title: string;
  lines: (string | null)[];
  children?: React.ReactNode;
}) {
  return (
    <li className="py-3 first:pt-0 last:pb-0">
      <p className="break-words font-sans text-base font-semibold leading-6 text-shamba-ink">{title}</p>
      {lines.filter(Boolean).map((line, index) => (
        <p key={index} className="break-words text-sm leading-5 text-shamba-ink-soft">
          {line}
        </p>
      ))}
      {children}
    </li>
  );
}

function NoteBox({ label, note, internal = false }: { label: string; note: string; internal?: boolean }) {
  return (
    <div
      className={`mt-3 rounded-shamba border px-4 py-3 ${
        internal ? "border-shamba-ochre/40 bg-shamba-ochre/10" : "border-shamba-line bg-shamba-bg"
      }`}
    >
      <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-shamba-ink-soft">{label}</p>
      <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 text-shamba-ink">{note}</p>
    </div>
  );
}

function DocumentRow({ document }: { document: ExpertDocument }) {
  const Icon = document.mime_type === "application/pdf" ? FileText : ImageIcon;
  return (
    <li className="rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3">
      <div className="flex items-start gap-3">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-shamba-green/10 text-shamba-green">
          <Icon className="size-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-wide text-shamba-ink-soft">
            {DOCUMENT_KIND_LABELS[document.kind]}
          </p>
          <p className="break-all font-sans text-sm font-semibold leading-5 text-shamba-ink">{document.file_name}</p>
          <p className="font-mono text-xs text-shamba-ink-soft">{formatFileSize(document.size_bytes)}</p>
          <AdminDocumentButton documentId={document.id} />
        </div>
      </div>
    </li>
  );
}
