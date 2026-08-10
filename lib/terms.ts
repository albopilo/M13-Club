import { supabase } from "@/lib/supabase";

import { TERMS_VERSION } from "@/content/terms-and-conditions";
import { PRIVACY_VERSION } from "@/content/privacy-policy";

export async function hasAcceptedCurrentTerms(
  userId: string
): Promise<boolean> {
  console.log("========== TERMS CHECK ==========");
  console.log("Terms user ID:", userId);
  console.log("Terms version:", TERMS_VERSION);
  console.log("Privacy version:", PRIVACY_VERSION);

  const { data, error } = await supabase
    .from("terms_acceptances")
    .select("id, user_id, terms_version, privacy_version, accepted_at")
    .eq("user_id", userId)
    .eq("terms_version", TERMS_VERSION)
    .eq("privacy_version", PRIVACY_VERSION)
    .maybeSingle();

  console.log("Terms query data:", data);
  console.log("Terms query error:", error);

  if (error) {
    console.error("TERMS QUERY FAILED:", error);
    throw error;
  }

  const accepted = !!data;

  console.log("Terms accepted result:", accepted);
  console.log("================================");

  return accepted;
}

export async function recordTermsAcceptance(
  userId: string
): Promise<{ error: string | null }> {
  console.log("========== RECORD TERMS ==========");
  console.log("Recording acceptance for:", userId);
  console.log("Terms version:", TERMS_VERSION);
  console.log("Privacy version:", PRIVACY_VERSION);

  const { error } = await supabase
    .from("terms_acceptances")
    .insert({
      user_id: userId,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
    });

  console.log("Record terms error:", error);
  console.log("==================================");

  if (error) {
    return {
      error: error.message,
    };
  }

  return {
    error: null,
  };
}