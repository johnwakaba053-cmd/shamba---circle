import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { AppHeader } from "@/components/AppHeader";
import { formatDay } from "@/lib/experts";
import {
  MAX_QUEUE_LIMIT,
  QUEUE_APPLICATION_COLUMNS,
  QUEUE_EXPERT_COLUMNS,
  QUEUE_PAGE_SIZE,
  QUEUE_TABS,
  isQueueTabId,
  shortApplicationId,
  type QueueApplication,
  type QueueExpert,
  type QueueTabId,
} from "@/lib/expertReview";
import { requireAdmin } from "@/lib/staff";
import { ApplicationStatusBadge, ExpertStatusBadge } from "./StatusBadge";

type Supabase = Awaited<ReturnType<typeof requireAdmin>>["supabase"];

// /admin/experts: the Expert verification queue (Experts E3). Admins
// only -- everyone else gets a 404 (requireAdmin). Not in the main
// navigation; admins reach it from their Profile menu.
//
// Applicants are identified by professional title, county and a short
// application ID, never by a private profile's name (admins can't read
// private profiles, and this page doesn't work around that).
export default async function ExpertVerificationQueue({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; limit?: string }>;
}) {
  const { supabase, user } = await requireAdmin();
  const params = await searchParams;
  const tab: QueueTabId = isQueueTabId(params.tab) ? params.tab : "review";
  const limit = parseLimit(params.limit);

  const [counts, countiesResult, list] = await Promise.all([
    loadCounts(supabase),
    supabase.from("counties").select("id, name"),
    tab === "experts" ? loadExperts(supabase, limit) : loadApplications(supabase, tab, limit),
  ]);

  const countyNames = new Map((countiesResult.data ?? []).map((county) => [county.id as string, county.name as string]));
  const activeTab = QUEUE_TABS.find((item) => item.id === tab)!;

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <AppHeader />
      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-4 pb-20 pt-6 sm:px-10 sm:pt-12">
        <div className="flex w-full max-w-2xl flex-col gap-5">
          <div>
            <p className="font-mono text-xs font-semibold uppercase tracking-wide text-shamba-ochre">Admin</p>
            <h1 className="mt-1 font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink sm:text-3xl">
              Expert verification
            </h1>
            <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
              Check each application&apos;s details and documents, then approve it, ask for changes or reject it.
            </p>
          </div>

          <nav aria-label="Application status" className="flex flex-wrap gap-2">
            {QUEUE_TABS.map((item) => {
              const selected = item.id === tab;
              const count = counts[item.id];
              return (
                <Link
                  key={item.id}
                  href={item.id === "review" ? "/admin/experts" : `/admin/experts?tab=${item.id}`}
                  aria-current={selected ? "page" : undefined}
                  className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-4 font-sans text-sm font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-shamba-green ${
                    selected
                      ? "border-shamba-green bg-shamba-green text-shamba-card"
                      : "border-shamba-line bg-shamba-card text-shamba-ink hover:bg-shamba-bg"
                  }`}
                >
                  {item.label}
                  {count !== null && (
                    <span className={`font-mono text-xs ${selected ? "text-shamba-card" : "text-shamba-ink-soft"}`}>{count}</span>
                  )}
                </Link>
              );
            })}
          </nav>

          {list.error ? (
            <div className="rounded-shamba border border-shamba-line bg-shamba-card p-6">
              <p role="alert" className="text-sm font-semibold text-shamba-rust">
                We couldn&apos;t load this list. Check your connection and try again.
              </p>
            </div>
          ) : list.kind === "applications" ? (
            list.rows.length === 0 ? (
              <EmptyState tabLabel={activeTab.label} />
            ) : (
              <ul className="flex flex-col gap-3">
                {list.rows.map((application) => (
                  <li key={application.id}>
                    <QueueCard
                      href={`/admin/experts/${application.id}`}
                      title={application.professional_title ?? "Untitled application"}
                      badge={<ApplicationStatusBadge status={application.status} />}
                      details={[
                        application.county_id ? countyNames.get(application.county_id) ?? null : null,
                        list.specialties.get(application.id) ?? null,
                      ]}
                      footer={`${shortApplicationId(application.id)} · ${queueDate(application, tab)}`}
                      isOwn={application.profile_id === user.id}
                    />
                  </li>
                ))}
              </ul>
            )
          ) : list.rows.length === 0 ? (
            <EmptyState tabLabel={activeTab.label} />
          ) : (
            <ul className="flex flex-col gap-3">
              {list.rows.map((expert) => (
                <li key={expert.profile_id}>
                  <QueueCard
                    href={`/admin/experts/${expert.application_id}`}
                    title={expert.professional_title}
                    badge={<ExpertStatusBadge status={expert.status} />}
                    details={[expert.county_id ? countyNames.get(expert.county_id) ?? null : null]}
                    footer={`${shortApplicationId(expert.application_id)} · ${
                      expert.status === "suspended" && expert.suspended_at
                        ? `Suspended ${formatDay(expert.suspended_at)}`
                        : `Verified ${formatDay(expert.verified_at)}`
                    }`}
                    isOwn={expert.profile_id === user.id}
                  />
                </li>
              ))}
            </ul>
          )}

          {!list.error && list.hasMore && (
            <Link
              href={`/admin/experts?${new URLSearchParams({ ...(tab === "review" ? {} : { tab }), limit: String(limit + QUEUE_PAGE_SIZE) })}`}
              scroll={false}
              className="inline-flex min-h-11 items-center justify-center self-center rounded-shamba border border-shamba-line bg-shamba-card px-6 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg"
            >
              Show more
            </Link>
          )}
        </div>
      </main>
    </div>
  );
}

function QueueCard({
  href,
  title,
  badge,
  details,
  footer,
  isOwn,
}: {
  href: string;
  title: string;
  badge: React.ReactNode;
  details: (string | null)[];
  footer: string;
  isOwn: boolean;
}) {
  const detailText = details.filter(Boolean).join(" · ");
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-shamba border border-shamba-line bg-shamba-card px-4 py-4 transition-colors hover:border-shamba-green-deep focus:outline-none focus:ring-2 focus:ring-shamba-green"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
          <p className="min-w-0 break-words font-sans text-base font-semibold leading-6 text-shamba-ink">{title}</p>
          {badge}
          {/* Admins can't review their own application (enforced in the
              database); marked so it's obvious in the queue. */}
          {isOwn && (
            <span className="font-mono text-[11px] font-semibold uppercase tracking-wide text-shamba-ochre">
              Your application
            </span>
          )}
        </div>
        {detailText && <p className="mt-1 break-words text-sm leading-5 text-shamba-ink-soft">{detailText}</p>}
        <p className="mt-1.5 font-mono text-xs text-shamba-ink-soft">{footer}</p>
      </div>
      <ChevronRight className="size-5 shrink-0 text-shamba-ink-soft" aria-hidden="true" />
    </Link>
  );
}

function EmptyState({ tabLabel }: { tabLabel: string }) {
  return (
    <div className="rounded-shamba border border-shamba-line bg-shamba-card p-6 text-center">
      <p className="text-base leading-6 text-shamba-ink-soft">Nothing in &ldquo;{tabLabel}&rdquo; right now.</p>
    </div>
  );
}

function parseLimit(value: string | undefined): number {
  const parsed = Number.parseInt(value ?? "", 10);
  if (!Number.isFinite(parsed) || parsed < QUEUE_PAGE_SIZE) return QUEUE_PAGE_SIZE;
  return Math.min(parsed, MAX_QUEUE_LIMIT);
}

function queueDate(application: QueueApplication, tab: QueueTabId): string {
  if (tab === "review" && application.submitted_at) return `Submitted ${formatDay(application.submitted_at)}`;
  if (application.decided_at) return `Decided ${formatDay(application.decided_at)}`;
  return `Updated ${formatDay(application.updated_at)}`;
}

// One head-only count per tab. A failed count shows no number rather
// than a wrong one.
async function loadCounts(supabase: Supabase): Promise<Record<QueueTabId, number | null>> {
  const results = await Promise.all(
    QUEUE_TABS.map((tab) =>
      tab.id === "experts"
        ? supabase.from("experts").select("profile_id", { count: "exact", head: true })
        : supabase
            .from("expert_applications")
            .select("id", { count: "exact", head: true })
            .in("status", tab.statuses as string[]),
    ),
  );
  return Object.fromEntries(
    QUEUE_TABS.map((tab, index) => [tab.id, results[index].error ? null : results[index].count ?? 0]),
  ) as Record<QueueTabId, number | null>;
}

type ApplicationList = {
  kind: "applications";
  error: boolean;
  rows: QueueApplication[];
  specialties: Map<string, string>;
  hasMore: boolean;
};

async function loadApplications(supabase: Supabase, tab: QueueTabId, limit: number): Promise<ApplicationList> {
  const statuses = QUEUE_TABS.find((item) => item.id === tab)!.statuses as string[];
  let query = supabase.from("expert_applications").select(QUEUE_APPLICATION_COLUMNS).in("status", statuses);
  // The review queue is first come, first served; the others show the
  // most recent first.
  query =
    tab === "review"
      ? query.order("submitted_at", { ascending: true, nullsFirst: false }).order("created_at", { ascending: true })
      : query.order("updated_at", { ascending: false });

  const { data, error } = await query.limit(limit + 1);
  if (error) return { kind: "applications", error: true, rows: [], specialties: new Map(), hasMore: false };

  const rows = (data ?? []).slice(0, limit) as QueueApplication[];
  const specialties = await loadSpecialtyNames(
    supabase,
    rows.map((row) => row.id),
  );

  return { kind: "applications", error: false, rows, specialties, hasMore: (data ?? []).length > limit };
}

// "Crops, Soil health" per application, for the queue cards. Falls back
// to no specialties line if either lookup fails.
async function loadSpecialtyNames(supabase: Supabase, applicationIds: string[]): Promise<Map<string, string>> {
  if (applicationIds.length === 0) return new Map();
  const [links, names] = await Promise.all([
    supabase.from("expert_application_specialties").select("application_id, specialty_id").in("application_id", applicationIds),
    supabase.from("expert_specialties").select("id, name"),
  ]);
  if (links.error || names.error) return new Map();

  const nameById = new Map((names.data ?? []).map((row) => [row.id as string, row.name as string]));
  const byApplication = new Map<string, string[]>();
  for (const link of links.data ?? []) {
    const name = nameById.get(link.specialty_id as string);
    if (!name) continue;
    const list = byApplication.get(link.application_id as string) ?? [];
    list.push(name);
    byApplication.set(link.application_id as string, list);
  }
  return new Map([...byApplication].map(([id, list]) => [id, list.join(", ")]));
}

type ExpertList = { kind: "experts"; error: boolean; rows: QueueExpert[]; hasMore: boolean };

async function loadExperts(supabase: Supabase, limit: number): Promise<ExpertList> {
  const { data, error } = await supabase
    .from("experts")
    .select(QUEUE_EXPERT_COLUMNS)
    .order("status", { ascending: false }) // 'suspended' before 'active'
    .order("verified_at", { ascending: false })
    .limit(limit + 1);
  if (error) return { kind: "experts", error: true, rows: [], hasMore: false };
  return { kind: "experts", error: false, rows: (data ?? []).slice(0, limit) as QueueExpert[], hasMore: (data ?? []).length > limit };
}
