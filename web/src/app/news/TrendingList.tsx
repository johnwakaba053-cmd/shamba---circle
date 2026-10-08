import Link from "next/link";
import { formatNewsDate, newsArticlePath, type NewsCardData } from "@/lib/news";
import { NewsFormatBadge } from "./NewsFormatBadge";

// Trending: a compact numbered list -- deliberately unlike Featured's
// big cards, so the two never read as the same thing. Mono ledger
// numerals (DESIGN.md's Ledger Rule). Each row is one link with a 44px
// minimum height. flex-1: in the /news top row it stretches to match the
// Featured story beside it.
export function TrendingList({ articles }: { articles: NewsCardData[] }) {
  return (
    <ol className="flex flex-1 flex-col divide-y divide-shamba-line rounded-shamba border border-shamba-line bg-shamba-card">
      {articles.map((article, index) => (
        <li key={article.id}>
          <Link
            href={newsArticlePath(article.slug)}
            className="group flex min-h-11 items-start gap-3 rounded-shamba px-4 py-3 transition-colors hover:bg-shamba-bg"
          >
            <span aria-hidden="true" className="w-6 shrink-0 pt-0.5 font-mono text-lg font-medium leading-6 text-shamba-ochre">
              {index + 1}
            </span>
            <span className="flex min-w-0 flex-col gap-1">
              <span className="font-display text-base font-bold leading-snug text-shamba-ink group-hover:text-shamba-green-deep">
                {article.title}
              </span>
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-xs text-shamba-ink-soft">
                {article.news_categories?.name ?? "News"}
                <span aria-hidden="true">·</span>
                <time dateTime={article.published_at}>{formatNewsDate(article.published_at)}</time>
                <NewsFormatBadge format={article.format} />
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ol>
  );
}
