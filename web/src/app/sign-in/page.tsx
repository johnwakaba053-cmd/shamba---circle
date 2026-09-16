"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ArrowLeft,
  Loader2,
  ShieldCheck,
  Smartphone,
  Sprout,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";

type Step = "phone" | "otp" | "redirecting";

type ActionState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

// Normalizes a Kenyan phone number to E.164 (+254...).
// 0712345678 / 712345678 / +254712345678 all resolve to +254712345678.
function normalizeKenyanPhone(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith("+")) {
    return `+${trimmed.slice(1).replace(/\D/g, "")}`;
  }
  const digits = trimmed.replace(/\D/g, "");
  if (digits.startsWith("254")) {
    return `+${digits}`;
  }
  if (digits.startsWith("0")) {
    return `+254${digits.slice(1)}`;
  }
  return `+254${digits}`;
}

// Routes a freshly-verified user based on onboarding completion:
// a non-empty display_name and at least one user_roles row are both
// required, since profiles rows are auto-created on signup and so
// existing alone. Any read failure falls back to /onboarding rather
// than risk sending an incomplete user straight to /communities.
async function routeAfterSignIn(
  supabase: ReturnType<typeof createClient>,
  router: ReturnType<typeof useRouter>,
  userId: string,
) {
  try {
    const [{ data: profile, error: profileError }, { count: roleCount, error: rolesError }] =
      await Promise.all([
        supabase.from("profiles").select("display_name").eq("id", userId).maybeSingle(),
        supabase
          .from("user_roles")
          .select("role", { count: "exact", head: true })
          .eq("profile_id", userId),
      ]);

    if (profileError || rolesError) {
      router.push("/onboarding");
      return;
    }

    const isOnboarded = Boolean(profile?.display_name?.trim()) && (roleCount ?? 0) > 0;
    router.push(isOnboarded ? "/communities" : "/onboarding");
  } catch {
    router.push("/onboarding");
  }
}

export default function SignIn() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phone, setPhone] = useState("");
  const [normalizedPhone, setNormalizedPhone] = useState("");
  const [otp, setOtp] = useState("");
  const [actionState, setActionState] = useState<ActionState>({ kind: "idle" });

  const isLoading = actionState.kind === "loading";

  async function handleSendCode(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) return;

    if (!phone.trim()) {
      setActionState({ kind: "error", message: "Enter your phone number." });
      return;
    }

    setActionState({ kind: "loading" });

    try {
      const supabase = createClient();
      const phoneForRequest = normalizeKenyanPhone(phone);
      const { error } = await supabase.auth.signInWithOtp({
        phone: phoneForRequest,
      });

      if (error) {
        setActionState({
          kind: "error",
          message: "We couldn't send a verification code. Please check your number and try again.",
        });
        return;
      }

      setNormalizedPhone(phoneForRequest);
      setOtp("");
      setActionState({ kind: "idle" });
      setStep("otp");
    } catch {
      setActionState({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
      });
    }
  }

  async function handleVerify(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (isLoading) return;

    if (otp.trim().length !== 6) {
      setActionState({ kind: "error", message: "Enter the 6-digit code." });
      return;
    }

    setActionState({ kind: "loading" });

    try {
      const supabase = createClient();
      const { data, error } = await supabase.auth.verifyOtp({
        phone: normalizedPhone,
        token: otp,
        type: "sms",
      });

      if (error || !data.session) {
        setActionState({
          kind: "error",
          message: "That code didn't work. Please check it and try again.",
        });
        return;
      }

      setActionState({ kind: "idle" });
      setStep("redirecting");
      await routeAfterSignIn(supabase, router, data.session.user.id);
    } catch {
      setActionState({
        kind: "error",
        message: "Something went wrong. Please try again in a moment.",
      });
    }
  }

  function handleChangeNumber() {
    setStep("phone");
    setOtp("");
    setActionState({ kind: "idle" });
  }

  return (
    <div className="flex flex-1 flex-col bg-shamba-bg">
      <header className="mx-auto flex w-full max-w-5xl items-center gap-2 px-6 py-6 sm:px-10">
        <Sprout className="size-6 text-shamba-green" aria-hidden="true" />
        <span className="font-display text-lg font-medium tracking-tight text-shamba-ink">
          Shamba Circle
        </span>
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center px-6 pb-20 pt-8 sm:px-10 sm:pt-16">
        <div className="w-full max-w-sm rounded-shamba border border-shamba-line bg-shamba-card p-6 sm:p-8">
          {step === "phone" && (
            <>
              <Smartphone className="size-7 text-shamba-green" aria-hidden="true" />

              <h1 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink">
                Join with your phone number
              </h1>
              <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
                We&apos;ll text you a code to confirm it&apos;s really you.
                Standard SMS rates may apply.
              </p>

              <form onSubmit={handleSendCode} className="mt-6 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="phone"
                    className="font-sans text-sm font-semibold text-shamba-ink"
                  >
                    Phone number
                  </label>
                  <input
                    id="phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    placeholder="+254 7XX XXX XXX"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    disabled={isLoading}
                    className="rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 font-sans text-base text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
                  />
                  <span className="text-sm text-shamba-ink-soft">
                    e.g. +254 712 345 678
                  </span>
                </div>

                {actionState.kind === "error" && (
                  <p role="alert" className="text-sm font-semibold text-shamba-rust">
                    {actionState.message}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  {isLoading ? "Sending…" : "Send verification code"}
                </button>
              </form>
            </>
          )}

          {step === "otp" && (
            <>
              <ShieldCheck className="size-7 text-shamba-green" aria-hidden="true" />

              <h1 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink">
                Enter your verification code
              </h1>
              <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
                We sent a 6-digit code by text to the phone number you
                entered.
              </p>

              <form onSubmit={handleVerify} className="mt-6 flex flex-col gap-4">
                <div className="flex flex-col gap-2">
                  <label
                    htmlFor="otp"
                    className="font-sans text-sm font-semibold text-shamba-ink"
                  >
                    Verification code
                  </label>
                  <input
                    id="otp"
                    name="otp"
                    type="text"
                    inputMode="numeric"
                    pattern="[0-9]*"
                    autoComplete="one-time-code"
                    maxLength={6}
                    placeholder="123456"
                    value={otp}
                    onChange={(event) =>
                      setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    disabled={isLoading}
                    className="rounded-shamba border border-shamba-line bg-shamba-bg px-4 py-3 text-center font-mono text-lg tracking-[0.3em] text-shamba-ink placeholder:text-shamba-ink-soft focus:outline-none focus:ring-2 focus:ring-shamba-green disabled:opacity-60"
                  />
                </div>

                {actionState.kind === "error" && (
                  <p role="alert" className="text-sm font-semibold text-shamba-rust">
                    {actionState.message}
                  </p>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  className="inline-flex items-center justify-center gap-2 rounded-shamba bg-shamba-green px-6 py-3 font-sans text-base font-semibold text-shamba-card transition-colors hover:bg-shamba-green-deep disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
                  {isLoading ? "Verifying…" : "Verify"}
                </button>

                <button
                  type="button"
                  onClick={handleChangeNumber}
                  disabled={isLoading}
                  className="inline-flex items-center justify-center gap-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink disabled:cursor-not-allowed disabled:opacity-70"
                >
                  <ArrowLeft className="size-4" aria-hidden="true" />
                  Change phone number
                </button>
              </form>
            </>
          )}

          {step === "redirecting" && (
            <>
              <Loader2 className="size-7 animate-spin text-shamba-green" aria-hidden="true" />

              <h1 className="mt-4 font-display text-2xl font-bold leading-tight tracking-tight text-shamba-ink">
                Taking you in…
              </h1>
              <p className="mt-2 text-base leading-6 text-shamba-ink-soft">
                Just a moment while we get things ready.
              </p>
            </>
          )}
        </div>

        {step === "phone" && (
          <Link
            href="/"
            className="mt-6 inline-flex items-center gap-2 font-sans text-sm font-semibold text-shamba-ink-soft transition-colors hover:text-shamba-ink"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            Back to Shamba Circle
          </Link>
        )}
      </main>
    </div>
  );
}
