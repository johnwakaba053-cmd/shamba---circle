"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pencil } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { NEWS_REGIONS, NEWS_REGION_LABELS, newsArticlePath, type NewsRegion } from "@/lib/news";
import { DRAFT_SUMMARY_MAX, DRAFT_TITLE_MAX, newsAdminErrorMessage } from "@/lib/newsAdmin";

// Everything admin_save_news_article needs to keep unchanged while the
// admin edits the four fields below (N6c drafts are linked stories: no
// body, the original link kept).
export type DraftForEdit = {
  id: string;
  slug: string;
  title: string;
  summary: string;
  region: NewsRegion;
  categoryId: string;
  origin: string;
  sourceId: string | null;
  externalUrl: string | null;
  countyId: string | null;
  coverImagePath: string | null;
  coverImageAlt: string | null;
  coverImageCredit: string | null;
  format: string;
  byline: string | null;
};

type Mode = "idle" | "editing" | "saving" | "confirming" | "deciding";
type Outcome = { kind: "published" | "rejected" | "saved" } | null;

const PRIMARY =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-shamba bg-shamba-green px-4 py-2 font-sans text-sm font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70";
const SECONDARY =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-shamba border border-shamba-line px-4 py-2 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg disabled:cursor-not-allowed disabled:opacity-70";
const DANGER =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-shamba border border-shamba-rust/40 px-4 py-2 font-sans text-sm font-semibold text-shamba-rust transition-colors hover:bg-shamba-rust/10 disabled:cursor-not-allowed disabled:opacity-70";
const INPUT =
  "w-full rounded-shamba border border-shamba-line bg-shamba-card px-4 py-3 font-sans text-base text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60";
const LABEL = "font-sans text-sm font-semibold text-shamba-ink";

// Edit / publish / reject for one imported draft. Each action calls the
// existing admin function with the admin's own session -- the same model
// as the Experts review screen: the function checks is_admin() and writes
// the audit log; nothing is written directly.
//   Edit     admin_save_news_article (headline, summary, region, topic)
//   Publish  admin_publish_news_article -- live now, for everyone
//   Reject   admin_archive_news_article -- hidden, kept on record, and
//            never imported again (its external_ref stays)
export function DraftActions({
  draft,
  categories,
}: {
  draft: DraftForEdit;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>("idle");
  const [outcome, setOutcome] = useState<Outcome>(null);
  const [error, setError] = useState<string | null>(null);
  // Which decision the confirm panel is for.
  const [decision, setDecision] = useState<"published" | "rejected">("published");
  const [title, setTitle] = useState(draft.title);
  const [summary, setSummary] = useState(draft.summary);
  const [region, setRegion] = useState<NewsRegion>(draft.region);
  const [categoryId, setCategoryId] = useState(draft.categoryId);
  const busy = mode === "saving" || mode === "deciding";
  const showForm = mode === "editing" || mode === "saving";

  async function save() {
    if (!title.trim() || !summary.trim()) {
      setError("Write a headline and a summary before saving.");
      return;
    }
    setMode("saving");
    setError(null);
    const supabase = createClient();
    const { error: rpcError } = await supabase.rpc("admin_save_news_article", {
      p_article_id: draft.id,
      p_slug: draft.slug,
      p_category_id: categoryId,
      p_region: region,
      p_title: title,
      p_summary: summary,
      p_origin: draft.origin,
      p_body: null,
      p_source_id: draft.sourceId,
      p_external_url: draft.externalUrl,
      p_county_id: region === "kenya" ? draft.countyId : null,
      p_cover_image_path: draft.coverImagePath,
      p_cover_image_alt: draft.coverImageAlt,
      p_cover_image_credit: draft.coverImageCredit,
      p_format: draft.format,
      p_byline: draft.byline,
    });
    if (rpcError) {
      setError(newsAdminErrorMessage(rpcError));
      setMode("editing");
      return;
    }
    setOutcome({ kind: "saved" });
    setMode("idle");
    router.refresh();
  }

  async function decide(kind: "published" | "rejected") {
    setMode("deciding");
    setError(null);
    const supabase = createClient();
    const { error: rpcError } =
      kind === "published"
        ? await supabase.rpc("admin_publish_news_article", { p_article_id: draft.id })
        : await supabase.rpc("admin_archive_news_article", { p_article_id: draft.id });
    if (rpcError) {
      setError(newsAdminErrorMessage(rpcError));
      setMode("idle");
      return;
    }
    // The card stays (no refresh) so the admin sees what happened; the
    // story leaves the draft list the next time the page loads.
    setOutcome({ kind });
    setMode("idle");
  }

  if (outcome?.kind === "published" || outcome?.kind === "rejected") {
    return (
      <p role="status" className="flex flex-wrap items-center gap-2 rounded-shamba bg-shamba-green/10 px-4 py-3 text-sm font-semibold text-shamba-green-deep">
        <Check className="size-4" aria-hidden="true" />
        {outcome.kind === "published" ? (
          <>
            Published. It&apos;s live on Agriculture Today.
            <Link href={newsArticlePath(draft.slug)} className="underline underline-offset-2">
              View story
            </Link>
          </>
        ) : (
          "Rejected. It's off the review list, hidden from readers, and won't be imported again."
        )}
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {outcome?.kind === "saved" && mode === "idle" && (
        <p role="status" className="rounded-shamba bg-shamba-green/10 px-4 py-2 text-sm font-semibold text-shamba-green-deep">
          Changes saved. Still a draft.
        </p>
      )}
      {error && (
        <p role="alert" className="rounded-shamba bg-shamba-card px-4 py-2 text-sm font-semibold text-shamba-rust">
          {error}
        </p>
      )}

      {showForm ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            void save();
          }}
          className="flex flex-col gap-4 rounded-shamba border border-shamba-line bg-shamba-bg p-4"
        >
          <div className="flex flex-col gap-2">
            <label htmlFor={`title-${draft.id}`} className={LABEL}>
              Headline
            </label>
            <input
              id={`title-${draft.id}`}
              value={title}
              onChange={(event) => setTitle(event.target.value.slice(0, DRAFT_TITLE_MAX))}
              maxLength={DRAFT_TITLE_MAX}
              required
              disabled={busy}
              className={INPUT}
            />
          </div>
          <div className="flex flex-col gap-2">
            <label htmlFor={`summary-${draft.id}`} className={LABEL}>
              Summary
            </label>
            <p id={`summary-hint-${draft.id}`} className="text-xs leading-5 text-shamba-ink-soft">
              In your own words: one or two sentences on why this matters to farmers. Don&apos;t copy the
              publisher&apos;s text.
            </p>
            <textarea
              id={`summary-${draft.id}`}
              value={summary}
              onChange={(event) => setSummary(event.target.value.slice(0, DRAFT_SUMMARY_MAX))}
              maxLength={DRAFT_SUMMARY_MAX}
              rows={4}
              required
              aria-describedby={`summary-hint-${draft.id}`}
              disabled={busy}
              className={INPUT}
            />
            <span className="font-mono text-xs text-shamba-ink-soft">
              {DRAFT_SUMMARY_MAX - summary.length} characters left
            </span>
          </div>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <label htmlFor={`region-${draft.id}`} className={LABEL}>
                Region
              </label>
              <select
                id={`region-${draft.id}`}
                value={region}
                onChange={(event) => setRegion(event.target.value as NewsRegion)}
                disabled={busy}
                className={`${INPUT} min-h-11`}
              >
                {NEWS_REGIONS.map((value) => (
                  <option key={value} value={value}>
                    {NEWS_REGION_LABELS[value]}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-2">
              <label htmlFor={`category-${draft.id}`} className={LABEL}>
                Topic
              </label>
              <select
                id={`category-${draft.id}`}
                value={categoryId}
                onChange={(event) => setCategoryId(event.target.value)}
                disabled={busy}
                className={`${INPUT} min-h-11`}
              >
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="submit" disabled={busy} className={PRIMARY}>
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              Save changes
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                setTitle(draft.title);
                setSummary(draft.summary);
                setRegion(draft.region);
                setCategoryId(draft.categoryId);
                setError(null);
                setMode("idle");
              }}
              className={SECONDARY}
            >
              Cancel
            </button>
          </div>
        </form>
      ) : mode === "confirming" || mode === "deciding" ? (
        <div className="flex flex-col gap-3 rounded-shamba border border-shamba-line bg-shamba-bg p-4">
          <p className="text-sm leading-6 text-shamba-ink">
            {decision === "published"
              ? "Publish this story now? It appears on Agriculture Today straight away, for everyone, with your summary and a link to the original."
              : "Reject this draft? It leaves the review list and stays hidden from readers. It's kept on record, so the importer won't bring it back."}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy}
              onClick={() => void decide(decision)}
              className={decision === "rejected" ? DANGER : PRIMARY}
            >
              {busy && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
              {decision === "rejected" ? "Reject draft" : "Publish now"}
            </button>
            <button type="button" disabled={busy} onClick={() => setMode("idle")} className={SECONDARY}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => { setError(null); setDecision("published"); setMode("confirming"); }} className={PRIMARY}>
            Publish
          </button>
          <button type="button" onClick={() => { setError(null); setOutcome(null); setMode("editing"); }} className={SECONDARY}>
            <Pencil className="size-4" aria-hidden="true" />
            Edit
          </button>
          <button type="button" onClick={() => { setError(null); setDecision("rejected"); setMode("confirming"); }} className={DANGER}>
            Reject
          </button>
        </div>
      )}
    </div>
  );
}

