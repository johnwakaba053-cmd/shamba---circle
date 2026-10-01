import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Camera,
  MessageCircle,
  MessagesSquare,
  ShieldAlert,
  Sprout,
  Store,
  TrendingUp,
} from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PRODUCT_PILLARS } from "@/components/productPillars";

// "Take part" actions -- the landing page's answer to "can I
// participate, or only read?". Each maps to something that already
// exists in the app today.
const participation = [
  {
    icon: Camera,
    label: "Share your farm",
    description: "Post Reels and Stories from your shamba.",
  },
  {
    icon: MessagesSquare,
    label: "Ask and answer",
    description: "Talk with farmers in communities for your crops and livestock.",
  },
  {
    icon: MessageCircle,
    label: "Message directly",
    description: "Chat privately with other farmers, buyers and sellers.",
  },
  {
    icon: Store,
    label: "Buy and sell",
    description: "List produce, inputs, tools and services in the marketplace.",
  },
];

const alsoInside = [
  { icon: TrendingUp, label: "Market prices" },
  { icon: BookOpen, label: "Farming guides and videos" },
  { icon: ShieldAlert, label: "Pest and disease alerts" },
];

export default async function Home() {
  // The installed PWA opens here (manifest start_url "/"). Only
  // signed-out visitors see this introduction. A signed-in farmer goes
  // straight into the app using the same rule sign-in's
  // routeAfterSignIn() applies: a display name and at least one role
  // mean onboarded (-> /communities); anything else, including a failed
  // read, goes to /onboarding, which itself forwards an already-
  // onboarded farmer on to /communities.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const [{ data: profile, error: profileError }, { count: roleCount, error: rolesError }] =
      await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
        supabase
          .from("user_roles")
          .select("role", { count: "exact", head: true })
          .eq("profile_id", user.id),
      ]);

    const isOnboarded =
      !profileError &&
      !rolesError &&
      Boolean(profile?.display_name?.trim()) &&
      (roleCount ?? 0) > 0;

    redirect(isOnboarded ? "/communities" : "/onboarding");
  }

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4 px-5 py-4 sm:px-10 sm:py-6">
        <div className="flex items-center gap-2">
          <Sprout className="size-6 text-shamba-green" aria-hidden="true" />
          <span className="font-display text-lg font-medium tracking-tight text-shamba-ink">
            Shamba Space
          </span>
        </div>
        <Link
          href="/sign-in"
          className="font-sans text-sm font-semibold text-shamba-green transition-colors hover:text-shamba-green-deep relative touch-target"
        >
          Sign in
        </Link>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-16 px-5 pb-20 sm:gap-20 sm:px-10">
        {/* Hero. Phone order: message -> pillars -> actions, so the four
            product areas are on the first screen without scrolling.
            From lg up: message and actions on the left, pillars on the
            right. */}
        <section className="grid grid-cols-1 gap-6 pt-2 sm:pt-10 lg:grid-cols-2 lg:gap-x-14 lg:gap-y-8">
          <div className="lg:col-start-1 lg:row-start-1 lg:self-end">
            <p className="font-mono text-xs font-medium uppercase tracking-wider text-shamba-ochre">
              For farmers and everyone in agriculture
            </p>
            <h1 className="mt-3 font-display text-4xl font-bold leading-[1.1] tracking-tight text-shamba-ink sm:text-5xl lg:text-6xl">
              Everything farming.
              <br />
              <span className="text-shamba-green">In one space.</span>
            </h1>
            <p className="mt-4 max-w-xl text-base leading-7 text-shamba-ink-soft sm:text-lg sm:leading-8">
              Learn from farmers. Share your farm. Get weather insights,
              communities, farming guides and a marketplace, all in one
              place.
            </p>
          </div>

          <ul
            aria-label="What's in Shamba Space"
            className="grid grid-cols-2 gap-3 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:gap-4"
          >
            {PRODUCT_PILLARS.map(({ key, icon: Icon, label, description, href, tone }) => {
              const cardClass =
                "flex flex-col gap-2 rounded-shamba border border-shamba-line bg-shamba-card p-3 sm:p-5 lg:gap-3";
              const content = (
                <>
                  <span
                    className={`flex size-9 items-center justify-center rounded-full sm:size-11 ${tone}`}
                  >
                    <Icon className="size-5 sm:size-6" aria-hidden="true" />
                  </span>
                  <span className="font-display text-base font-bold leading-tight text-shamba-ink sm:text-lg">
                    {label}
                  </span>
                  <span className="text-xs leading-5 text-shamba-ink-soft sm:text-sm sm:leading-6">
                    {description}
                  </span>
                </>
              );

              // The Weather card opens the Weather screen (signed-out
              // visitors go through sign-in first, like every app page).
              return key === "weather" ? (
                <li key={key} className="flex">
                  <Link
                    href={href}
                    className={`${cardClass} flex-1 transition-colors hover:border-shamba-green`}
                  >
                    {content}
                  </Link>
                </li>
              ) : (
                <li key={key} className={cardClass}>
                  {content}
                </li>
              );
            })}
          </ul>

          <div className="flex flex-col gap-3 lg:col-start-1 lg:row-start-2 lg:self-start">
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href="/sign-in"
                className="inline-flex items-center justify-center gap-2 rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep"
              >
                Join Shamba Space
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
              <a
                href="#take-part"
                className="inline-flex items-center justify-center rounded-shamba border border-shamba-line px-6 py-3 font-sans text-base font-semibold text-shamba-ink transition-colors hover:bg-shamba-card"
              >
                See how it works
              </a>
            </div>
            <p className="text-sm text-shamba-ink-soft">
              Join with just your phone number.
            </p>
          </div>
        </section>

        <section id="take-part" aria-labelledby="take-part-heading" className="scroll-mt-6">
          <h2
            id="take-part-heading"
            className="font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink sm:text-3xl"
          >
            Don&apos;t just read. Take part.
          </h2>
          <p className="mt-2 max-w-xl text-base leading-7 text-shamba-ink-soft">
            Every farmer here can share, ask, answer and trade.
          </p>

          <ul className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            {participation.map(({ icon: Icon, label, description }) => (
              <li
                key={label}
                className="flex items-start gap-4 rounded-shamba border border-shamba-line bg-shamba-card p-5"
              >
                <Icon className="mt-0.5 size-6 shrink-0 text-shamba-green" aria-hidden="true" />
                <span className="flex flex-col gap-1">
                  <span className="font-display text-base font-medium text-shamba-ink">
                    {label}
                  </span>
                  <span className="text-sm leading-6 text-shamba-ink-soft">{description}</span>
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2">
            <span className="font-mono text-xs font-medium uppercase tracking-wider text-shamba-ink-soft">
              Also inside
            </span>
            {alsoInside.map(({ icon: Icon, label }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 text-sm font-semibold text-shamba-ink"
              >
                <Icon className="size-4 text-shamba-ochre" aria-hidden="true" />
                {label}
              </span>
            ))}
          </div>
        </section>

        <section className="flex flex-col items-start gap-4 rounded-shamba bg-shamba-green-deep p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
          <div>
            <h2 className="font-display text-xl font-bold leading-tight text-shamba-card sm:text-2xl">
              Your farming community is waiting.
            </h2>
            <p className="mt-1 text-sm leading-6 text-shamba-card/80">
              Join with your phone number and start in minutes.
            </p>
          </div>
          <Link
            href="/sign-in"
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-shamba bg-shamba-card px-6 py-3 font-sans text-base font-semibold text-shamba-green-deep transition-colors hover:bg-shamba-bg"
          >
            Join Shamba Space
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        </section>
      </main>
    </div>
  );
}
