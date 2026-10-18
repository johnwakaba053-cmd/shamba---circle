import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AppHeader } from "@/components/AppHeader";
import {
  APPLICATION_COLUMNS,
  DOCUMENT_COLUMNS,
  EDITABLE_STATUSES,
  EDUCATION_COLUMNS,
  EXPERIENCE_COLUMNS,
  QUALIFICATION_COLUMNS,
  isExpertStepId,
  resumeStep,
  type ApplicationParts,
  type EducationEntry,
  type ExpertApplication,
  type ExpertDocument,
  type ExperienceEntry,
  type QualificationEntry,
} from "@/lib/experts";
import { ApplicationWizard } from "./ApplicationWizard";
import { ApplicationStatusView, LoadErrorView } from "./ApplicationStatusView";
import { ExpertIntro } from "./ExpertIntro";

const COOLDOWN_DAYS = 30;

// /experts/apply: the Expert Registration form and the application's
// status, on one route. Which view shows depends on the farmer's latest
// application:
//   none / withdrawn / rejected (after 30 days) -> intro, or the form once
//                                                   they choose to start
//   draft / changes_requested                   -> the step-by-step form
//   submitted / under_review / approved / rejected (within 30 days),
//   or a suspended expert                       -> the status view
// Not linked from the main navigation yet (Experts E2).
export default async function ExpertApply({
  searchParams,
}: {
  searchParams: Promise<{ step?: string }>;
}) {
  const { step } = await searchParams;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sign-in");
  }

  const [applicationResult, expertResult, specialtiesResult, countiesResult] = await Promise.all([
    supabase
      .from("expert_applications")
      .select(APPLICATION_COLUMNS)
      .eq("profile_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase.from("experts").select("status").eq("profile_id", user.id).maybeSingle(),
    supabase.from("expert_specialties").select("id, name").eq("is_active", true).order("sort_order"),
    supabase.from("counties").select("id, name").order("name", { ascending: true }),
  ]);

  const loadFailed = applicationResult.error || expertResult.error || specialtiesResult.error || countiesResult.error;
  const application = (applicationResult.data as ExpertApplication | null) ?? null;
  const expertStatus = (expertResult.data?.status as "active" | "suspended" | undefined) ?? null;

  let content: React.ReactNode;

  if (loadFailed) {
    content = <LoadErrorView />;
  } else if (expertStatus === "suspended") {
    content = <ApplicationStatusView kind="suspended" application={application} />;
  } else if (application && EDITABLE_STATUSES.includes(application.status)) {
    const parts = await loadParts(supabase, application);
    content = parts ? (
      <ApplicationWizard
        profileId={user.id}
        initialParts={parts}
        initialStep={isExpertStepId(step) ? step : resumeStep(parts)}
        specialtyOptions={specialtiesResult.data ?? []}
        counties={countiesResult.data ?? []}
      />
    ) : (
      <LoadErrorView />
    );
  } else if (application && (application.status === "submitted" || application.status === "under_review")) {
    content = <ApplicationStatusView kind="in_review" application={application} />;
  } else if (application?.status === "approved" && expertStatus === "active") {
    content = <ApplicationStatusView kind="approved" application={application} />;
  } else if (application?.status === "rejected" && withinCooldown(application.decided_at)) {
    content = <ApplicationStatusView kind="rejected" application={application} reapplyOn={reapplyDate(application.decided_at)} />;
  } else if (isExpertStepId(step)) {
    // Starting a new application (first time, or after a withdrawal or an
    // expired cooldown). Nothing is saved until "About you" is saved.
    content = (
      <ApplicationWizard
        profileId={user.id}
        initialParts={{ application: null, specialtyIds: [], education: [], qualifications: [], experience: [], documents: [] }}
        initialStep="about"
        specialtyOptions={specialtiesResult.data ?? []}
        counties={countiesResult.data ?? []}
      />
    );
  } else {
    content = <ExpertIntro previous={application} />;
  }

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 pb-20 pt-6 sm:px-10 sm:pt-12">
        <div className="w-full max-w-xl">{content}</div>
      </main>
    </div>
  );
}

async function loadParts(
  supabase: Awaited<ReturnType<typeof createClient>>,
  application: ExpertApplication,
): Promise<ApplicationParts | null> {
  const [specialties, education, qualifications, experience, documents] = await Promise.all([
    supabase.from("expert_application_specialties").select("specialty_id").eq("application_id", application.id),
    supabase.from("expert_education").select(EDUCATION_COLUMNS).eq("application_id", application.id).order("sort_order").order("created_at"),
    supabase.from("expert_qualifications").select(QUALIFICATION_COLUMNS).eq("application_id", application.id).order("created_at"),
    supabase.from("expert_experience").select(EXPERIENCE_COLUMNS).eq("application_id", application.id).order("start_date", { ascending: false }),
    supabase.from("expert_documents").select(DOCUMENT_COLUMNS).eq("application_id", application.id).order("created_at"),
  ]);

  if (specialties.error || education.error || qualifications.error || experience.error || documents.error) {
    return null;
  }

  return {
    application,
    specialtyIds: (specialties.data ?? []).map((row) => row.specialty_id as string),
    education: (education.data ?? []) as EducationEntry[],
    qualifications: (qualifications.data ?? []) as QualificationEntry[],
    experience: (experience.data ?? []) as ExperienceEntry[],
    documents: (documents.data ?? []) as ExpertDocument[],
  };
}

function withinCooldown(decidedAt: string | null): boolean {
  if (!decidedAt) return false;
  return Date.now() < new Date(decidedAt).getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000;
}

function reapplyDate(decidedAt: string | null): string | null {
  if (!decidedAt) return null;
  return new Date(new Date(decidedAt).getTime() + COOLDOWN_DAYS * 24 * 60 * 60 * 1000).toISOString();
}
