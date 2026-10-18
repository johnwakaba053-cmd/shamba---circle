import { formatNewsToday } from "@/lib/news";

// The Agriculture Today banner across the top of /news: full width, in
// the brand's deep green with a warm sunrise glow and faint field rows.
// Drawn in CSS -- there's no photo, so nothing to license or load.
export function NewsHero({ now }: { now: Date }) {
  return (
    <section aria-labelledby="news-title" className="relative isolate overflow-hidden bg-shamba-green-deep">
      <span
        aria-hidden="true"
        className="absolute inset-0 -z-10"
        style={{
          backgroundImage: [
            "radial-gradient(ellipse 60% 120% at 88% 0%, color-mix(in srgb, var(--shamba-ochre) 60%, transparent), transparent 70%)",
            "linear-gradient(to bottom, transparent 40%, color-mix(in srgb, var(--shamba-green) 65%, transparent))",
            "repeating-linear-gradient(-14deg, rgb(255 255 255 / 0.05) 0 2px, transparent 2px 20px)",
          ].join(", "),
        }}
      />
      <div className="mx-auto w-full max-w-5xl px-6 py-10 sm:px-10 sm:py-14">
        <p className="font-mono text-xs font-medium uppercase tracking-wider text-shamba-card/80">
          {formatNewsToday(now)}
        </p>
        <h1
          id="news-title"
          className="mt-2 font-display text-4xl font-bold leading-tight tracking-tight text-shamba-card sm:text-5xl"
        >
          Agriculture Today
        </h1>
        <p className="mt-2 text-lg font-semibold leading-7 text-shamba-card/90 sm:text-xl">
          Kenya. Africa. Global. Current agribusiness news.
        </p>
      </div>
    </section>
  );
}
