"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, ChevronRight, Loader2, Sprout, UserRound, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { PRODUCT_PILLARS } from "@/components/productPillars";

const MAX_DISPLAY_NAME_LENGTH = 80;

type Step = "name" | "roles" | "success";

type Role = "farmer" | "buyer" | "seller";
const ALL_ROLES: readonly Role[] = ["farmer", "buyer", "seller"];
const ROLE_LABELS: Record<Role, string> = {
  farmer: "Farmer",
  buyer: "Buyer",
  seller: "Seller",
};
// One plain-language line per role, so "Buyer" vs "Seller" never has to
// be guessed at by someone who's never seen Shamba Space before.
const ROLE_DESCRIPTIONS: Record<Role, string> = {
  farmer: "I grow crops or keep livestock",
  buyer: "I buy produce or farm products",
  seller: "I sell produce, inputs, tools or services",
};

function StepLabel({ step }: { step: 1 | 2 }) {
  return (
    <p className="font-mono text-xs font-medium uppercase tracking-wider text-shamba-ochre">
      Step {step} of 2
    </p>
  );
}

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string }
  | { kind: "success" };

type RolesLoadState =
  | { kind: "loading" }
  | { kind: "loaded" }
  | { kind: "error"; message: string };

export function OnboardingForm({
  userId,
  initialDisplayName,
  hasRoles,
  returnTo = null,
}: {
  userId: string;
  initialDisplayName: string;
  hasRoles: boolean;
  // A validated /reels/<uuid> the farmer was on their way to (a shared
  // Reel link) -- offered as the main next step once they're set up.
  returnTo?: string | null;
}) {
  // A saved name with no roles yet resumes directly at the roles step;
  // no name preserves the existing behavior of starting at the name step.
  // (page.tsx already redirects away if both a name and roles exist, so
  // that combination never actually reaches this component.)
  const [step, setStep] = useState<Step>(
    initialDisplayName && !hasRoles ? "roles" : "name",
  );

  const [displayName, setDisplayName] = useState(initialDisplayName);
  const [status, setStatus] = useState<Status>({ kind: "idle" });

  const [existingRoles, setExistingRoles] = useState<Set<Role>>(new Set());
  const [selectedRoles, setSelectedRoles] = useState<Set<Role>>(new Set());
  const [rolesLoadState, setRolesLoadState] = useState<RolesLoadState>({
    kind: "loading",
  });

  const isLoading = status.kind === "loading";

  useEffect(() => {
    if (step !== "roles") return;
    loadExistingRoles();
    // Only re-run when the roles step is entered, not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function loadExistingRoles() {
    setRolesLoadState({ kind: "loading" });

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from("user_roles")
        .select("role")
        .eq("profile_id", userId);

      if (error) {
        setRolesLoadState({
          kind: "error",
          message: "We couldn't load your current roles. Please try again.",
        });
        return;
      }

      const loaded = new Set(
        (data ?? [])
          .map((row) => row.role as string)
          .filter((role): role is Role =>
            (ALL_ROLES as readonly string[]).includes(role),
          ),
      );
      setExistingRoles(loaded);
      setSelectedRoles(new Set(loaded));
      setRolesLoadState({ kind: "loaded" });
    } catch {
      setRolesLoadState({
        kind: "error",
        message: "We couldn't load your current roles. Please try again.",
      });
    }
  }

  async function handleSaveName(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) return;

    const trimmed = displayName.trim().slice(0, MAX_DISPLAY_NAME_LENGTH);
    if (!trimmed) {
      setStatus({ kind: "error", message: "Enter a display name." });
      return;
    }

    setStatus({ kind: "loading" });

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("profiles")
        .update({ display_name: trimmed })
        .eq("id", userId);

      if (error) {
        setStatus({
          kind: "error",
          message: "We couldn't save your name. Please try again.",
        });
        return;
      }

      setStatus({ kind: "idle" });
      setStep("roles");
    } catch {
      setStatus({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
      });
    }
  }

  function toggleRole(role: Role) {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
  }

  async function handleSaveRoles(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) return;

    if (selectedRoles.size === 0) {
      setStatus({ kind: "error", message: "Select at least one role." });
      return;
    }

    const toAdd = [...selectedRoles].filter((role) => !existingRoles.has(role));
    const toRemove = [...existingRoles].filter((role) => !selectedRoles.has(role));

    setStatus({ kind: "loading" });

    try {
      const supabase = createClient();

      if (toAdd.length > 0) {
        const { error: insertError } = await supabase
          .from("user_roles")
          .insert(toAdd.map((role) => ({ profile_id: userId, role })));

        if (insertError) {
          setStatus({
            kind: "error",
            message: "We couldn't save your roles. Please try again.",
          });
          return;
        }
      }

      if (toRemove.length > 0) {
        const { error: deleteError } = await supabase
          .from("user_roles")
          .delete()
          .eq("profile_id", userId)
          .in("role", toRemove);

        if (deleteError) {
          setStatus({
            kind: "error",
            message: "We couldn't save your roles. Please try again.",
          });
          return;
        }
      }

      setStatus({ kind: "idle" });
      setStep("success");
    } catch {
      setStatus({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
      });
    }
  }

  if (step === "success") {
    const firstName = displayName.trim().split(/\s+/)[0];

    return (
      <>
        <Sprout className="size-7 text-shamba-green" aria-hidden="true" />

        <h1
          role="status"
          className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink"
        >
          Welcome to Shamba Space{firstName ? `, ${firstName}` : ""}!
        </h1>
        <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
          You&apos;re all set. Here&apos;s where to start:
        </p>

        <ul className="mt-5 flex flex-col gap-2">
          {PRODUCT_PILLARS.map(({ key, icon: Icon, label, description, href, tone }) => (
            <li key={key}>
              <Link
                href={href}
                className="flex items-center gap-3 rounded-shamba border border-shamba-line bg-shamba-bg p-3 transition-colors hover:border-shamba-green"
              >
                <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${tone}`}>
                  <Icon className="size-5" aria-hidden="true" />
                </span>
                <span className="flex min-w-0 flex-1 flex-col">
                  <span className="font-sans text-sm font-semibold text-shamba-ink">{label}</span>
                  <span className="text-xs leading-5 text-shamba-ink-soft">{description}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-shamba-ink-soft" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>

        <p className="mt-4 text-sm leading-6 text-shamba-ink-soft">
          Tip: add your county in{" "}
          <Link href="/profile" className="font-semibold text-shamba-green hover:text-shamba-green-deep">
            Profile
          </Link>{" "}
          to get weather alerts for your area.
        </p>

        {returnTo && (
          <Link
            href={returnTo}
            className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep"
          >
            Watch the shared Reel
            <ArrowRight className="size-4" aria-hidden="true" />
          </Link>
        )}

        <Link
          href="/communities"
          className={
            returnTo
              ? "mt-2 inline-flex w-full items-center justify-center gap-2 rounded-shamba border border-shamba-line px-6 py-3 font-sans text-base font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg"
              : "mt-5 inline-flex w-full items-center justify-center gap-2 rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep"
          }
        >
          Find your community
          <ArrowRight className="size-4" aria-hidden="true" />
        </Link>
      </>
    );
  }

  if (step === "roles") {
    if (rolesLoadState.kind === "loading") {
      return (
        <div className="mt-6 flex items-center gap-2 text-sm text-shamba-ink-soft">
          <Loader2 className="size-4 animate-spin" aria-hidden="true" />
          Loading your roles…
        </div>
      );
    }

    if (rolesLoadState.kind === "error") {
      return (
        <div className="mt-6 flex flex-col gap-3">
          <p role="alert" className="text-sm font-semibold text-shamba-rust">
            {rolesLoadState.message}
          </p>
          <button
            type="button"
            onClick={loadExistingRoles}
            className="inline-flex items-center justify-center rounded-shamba border border-shamba-line px-6 py-3 font-sans text-base font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg"
          >
            Try again
          </button>
        </div>
      );
    }

    return (
      <>
        <Users className="size-7 text-shamba-green" aria-hidden="true" />

        <div className="mt-4">
          <StepLabel step={2} />
        </div>
        <h1 className="mt-1 font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink">
          What best describes you?
        </h1>
        <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
          Choose everything that applies — you can be more than one.
        </p>

        <form onSubmit={handleSaveRoles} className="mt-6 flex flex-col gap-4">
          <div className="flex flex-col gap-3">
            {ALL_ROLES.map((role) => (
              <label
                key={role}
                className="flex items-center gap-3 rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink"
              >
                <input
                  type="checkbox"
                  checked={selectedRoles.has(role)}
                  onChange={() => toggleRole(role)}
                  disabled={isLoading}
                  className="size-5 rounded border-shamba-line text-shamba-green focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
                />
                <span className="flex flex-col">
                  <span className="font-semibold">{ROLE_LABELS[role]}</span>
                  <span className="text-sm text-shamba-ink-soft">{ROLE_DESCRIPTIONS[role]}</span>
                </span>
              </label>
            ))}
          </div>

          {status.kind === "error" && (
            <p role="alert" className="text-sm font-semibold text-shamba-rust">
              {status.message}
            </p>
          )}

          <button
            type="submit"
            disabled={isLoading}
            className="inline-flex items-center justify-center gap-2 rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
            {isLoading ? "Saving…" : "Continue"}
          </button>
        </form>
      </>
    );
  }

  return (
    <>
      <UserRound className="size-7 text-shamba-green" aria-hidden="true" />

      <div className="mt-4">
        <StepLabel step={1} />
      </div>
      <h1 className="mt-1 font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink">
        What should we call you?
      </h1>
      <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
        This is the name other farmers will see when you post, comment
        or message.
      </p>

      <form onSubmit={handleSaveName} className="mt-6 flex flex-col gap-4">
      <div className="flex flex-col gap-2">
        <label
          htmlFor="display_name"
          className="font-sans text-sm font-semibold text-shamba-ink"
        >
          Display name
        </label>
        <input
          id="display_name"
          name="display_name"
          type="text"
          autoComplete="name"
          maxLength={MAX_DISPLAY_NAME_LENGTH}
          placeholder="e.g. Amina"
          value={displayName}
          onChange={(event) => setDisplayName(event.target.value)}
          disabled={isLoading}
          className="rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
        />
      </div>

      {status.kind === "error" && (
        <p role="alert" className="text-sm font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}

      <button
        type="submit"
        disabled={isLoading}
        className="inline-flex items-center justify-center gap-2 rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70"
      >
        {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
        {isLoading ? "Saving…" : "Save"}
      </button>
      </form>
    </>
  );
}
