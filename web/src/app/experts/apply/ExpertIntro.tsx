import Link from "next/link";
import { BadgeCheck, FileText, GraduationCap, Lock } from "lucide-react";
import type { ExpertApplication } from "@/lib/experts";

// First screen for a farmer with no open application. Nothing is saved
// until they fill in and save the first step.
export function ExpertIntro({ previous }: { previous: ExpertApplication | null }) {
  return (
    <div className="rounded-shamba border border-shamba-line bg-shamba-card p-6 sm:p-8">
      <span className="flex size-11 items-center justify-center rounded-full bg-shamba-green/10 text-shamba-green">
        <BadgeCheck className="size-5" aria-hidden="true" />
      </span>
      <h1 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink">
        Become a Verified Expert
      </h1>
      <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
        Agronomists, vets and other farming professionals can apply to be verified on Shamba Space.
        Our team checks every application before the Verified badge appears on a profile.
      </p>

      {previous?.status === "withdrawn" && (
        <p className="mt-4 rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 text-sm leading-5 text-shamba-ink-soft">
          You withdrew your last application. You can start a new one whenever you&apos;re ready.
        </p>
      )}
      {previous?.status === "rejected" && (
        <p className="mt-4 rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 text-sm leading-5 text-shamba-ink-soft">
          Your last application wasn&apos;t approved. You can apply again now.
        </p>
      )}

      <h2 className="mt-6 font-display text-base font-bold text-shamba-ink">You&apos;ll need</h2>
      <ul className="mt-3 flex flex-col gap-3">
        <IntroItem icon={GraduationCap} text="Your education, qualifications and certificates" />
        <IntroItem icon={FileText} text="Your work experience and a CV as a PDF (up to 10 MB)" />
        <IntroItem icon={Lock} text="Your documents stay private. Only Shamba Space reviewers can see them." />
      </ul>

      <p className="mt-6 font-mono text-[11px] leading-4 text-shamba-ink-soft">
        Your progress is saved after every step, so you can finish later.
      </p>

      <Link
        href="/experts/apply?step=about"
        className="mt-4 flex min-h-11 w-full items-center justify-center rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep"
      >
        Start application
      </Link>
    </div>
  );
}

function IntroItem({ icon: Icon, text }: { icon: typeof Lock; text: string }) {
  return (
    <li className="flex items-start gap-3">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-shamba-bg text-shamba-ink-soft">
        <Icon className="size-4" aria-hidden="true" />
      </span>
      <span className="pt-1.5 text-sm leading-5 text-shamba-ink">{text}</span>
    </li>
  );
}
