// Agriculture Today admin draft review (News N6c): shared helpers for the
// /admin/news screen. Every write goes through the N2/N4/N6c admin
// functions, which check is_admin() and write news_audit_events; these
// helpers only shape data and words.

export const DRAFT_TITLE_MAX = 200;
export const DRAFT_SUMMARY_MAX = 500;

type DbError = { message: string; code?: string };

// Plain-words messages for the errors the admin news functions raise.
export function newsAdminErrorMessage(error: DbError): string {
  switch (error.message) {
    case "not_authorized":
      return "Only admins can review Agriculture Today drafts. Sign in with an admin account.";
    case "news_summary_needs_rewrite":
      return "The summary is too close to the publisher's own text. Rewrite it in your own words, then publish.";
    case "news_article_incomplete":
      return "This story is missing what its format needs (a video story needs its video). It can't be published yet.";
    case "news_article_not_found":
      return "This draft no longer exists. Reload the page.";
    case "news_media_conflict":
      return "That change doesn't fit this story's media. Reload the page and try again.";
  }
  if (error.code === "23505") {
    return "Another story already uses this web address. Reload the page and try again.";
  }
  if (error.code === "23514") {
    return `Check the headline (up to ${DRAFT_TITLE_MAX} characters) and summary (up to ${DRAFT_SUMMARY_MAX}).`;
  }
  return "We couldn't save that. Check your connection and try again.";
}

// "8 Oct 2026, 13:26" in Kenya time, like the rest of the app.
export function formatSourceTime(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    timeZone: "Africa/Nairobi",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
