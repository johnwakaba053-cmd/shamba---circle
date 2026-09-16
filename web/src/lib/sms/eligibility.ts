import { createAdminClient } from "@/lib/supabase/admin";
import { normalizeKenyanPhone } from "./phone";

export type DryRunEligibilityResult = {
  alertId: string;
  totalFarmers: number;
  eligibleWithValidPhone: number;
  excludedMissingOrInvalidPhone: number;
  excludedAlreadyDelivered: number;
  excludedDoesNotMatchRules: number;
};

// Server-only, read-only. Computes who WOULD receive an SMS for this
// alert right now -- never sends anything, never writes to
// alert_deliveries. Uses the service-role client because it needs
// get_eligible_farmers_for_alert(), the cross-farmer matching function
// that is deliberately unreachable from a normal farmer session (see
// the Stage 6A migration).
//
// IMPORTANT: "alert preference enabled" (what
// get_eligible_farmers_for_alert / alert_matches_farmer checks) is NOT
// the same thing as SMS consent. This function answers "does this
// alert apply to this farmer under the existing in-app matching
// rules," not "has this farmer agreed to receive text messages." That
// distinction is deliberate and unresolved -- see the accompanying
// report. No SMS is sent as a result of this computation regardless.
export async function computeDryRunEligibility(
  alertId: string,
): Promise<DryRunEligibilityResult> {
  const supabase = createAdminClient();

  const [{ count: totalFarmers }, { data: matchingFarmers, error: matchError }] =
    await Promise.all([
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.rpc("get_eligible_farmers_for_alert", { p_alert_id: alertId }),
    ]);

  if (matchError) {
    throw new Error(`get_eligible_farmers_for_alert failed: ${matchError.message}`);
  }

  const matches = (matchingFarmers ?? []) as { profile_id: string; phone: string | null }[];

  const validPhoneProfileIds: string[] = [];
  let invalidPhoneCount = 0;

  for (const farmer of matches) {
    // Never logged, never stored, never returned -- used only to
    // decide which bucket this farmer falls into.
    const normalized = normalizeKenyanPhone(farmer.phone);
    if (normalized) {
      validPhoneProfileIds.push(farmer.profile_id);
    } else {
      invalidPhoneCount += 1;
    }
  }

  let alreadyDeliveredCount = 0;
  if (validPhoneProfileIds.length > 0) {
    const { count } = await supabase
      .from("alert_deliveries")
      .select("profile_id", { count: "exact", head: true })
      .eq("alert_id", alertId)
      .eq("channel", "sms")
      .in("profile_id", validPhoneProfileIds);
    alreadyDeliveredCount = count ?? 0;
  }

  const total = totalFarmers ?? 0;

  return {
    alertId,
    totalFarmers: total,
    eligibleWithValidPhone: validPhoneProfileIds.length - alreadyDeliveredCount,
    excludedMissingOrInvalidPhone: invalidPhoneCount,
    excludedAlreadyDelivered: alreadyDeliveredCount,
    excludedDoesNotMatchRules: total - matches.length,
  };
}
