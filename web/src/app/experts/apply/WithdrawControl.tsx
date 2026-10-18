"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { expertErrorMessage } from "@/lib/experts";

type Status =
  | { kind: "idle" }
  | { kind: "confirming" }
  | { kind: "loading" }
  | { kind: "error"; message: string };

// Withdraws the application through withdraw_expert_application(), after
// an inline confirmation. The farmer can start a new one straight away.
export function WithdrawControl({ applicationId }: { applicationId: string }) {
  const router = useRouter();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const isLoading = status.kind === "loading";

  async function handleWithdraw() {
    if (isLoading) return;
    setStatus({ kind: "loading" });
    try {
      const { error } = await createClient().rpc("withdraw_expert_application", { p_application_id: applicationId });
      if (error) {
        setStatus({ kind: "error", message: expertErrorMessage(error, "We couldn't withdraw your application. Please try again.") });
        return;
      }
      router.replace("/experts/apply");
      router.refresh();
    } catch {
      setStatus({ kind: "error", message: "Something went wrong. Please try again in a moment." });
    }
  }

  if (status.kind === "idle") {
    return (
      <button
        type="button"
        onClick={() => setStatus({ kind: "confirming" })}
        className="inline-flex min-h-11 items-center font-sans text-sm font-semibold text-shamba-rust hover:underline"
      >
        Withdraw application
      </button>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm leading-5 text-shamba-ink">
        Withdraw your application? Our team will stop reviewing it. You can start a new application later.
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={handleWithdraw}
          disabled={isLoading}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-shamba bg-shamba-rust px-4 font-sans text-sm font-semibold text-shamba-card transition-colors hover:bg-shamba-rust/85 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isLoading && <Loader2 className="size-4 animate-spin" aria-hidden="true" />}
          {isLoading ? "Withdrawing…" : "Yes, withdraw"}
        </button>
        <button
          type="button"
          onClick={() => setStatus({ kind: "idle" })}
          disabled={isLoading}
          className="inline-flex min-h-11 items-center justify-center rounded-shamba border border-shamba-line px-4 font-sans text-sm font-semibold text-shamba-ink transition-colors hover:bg-shamba-bg disabled:cursor-not-allowed disabled:opacity-70"
        >
          Keep it
        </button>
      </div>
      {status.kind === "error" && (
        <p role="alert" className="text-sm font-semibold text-shamba-rust">
          {status.message}
        </p>
      )}
    </div>
  );
}
