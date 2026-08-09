import { supabase } from "@/lib/supabase";
import { TERMS_VERSION } from "@/content/terms-and-conditions";
import { PRIVACY_VERSION } from "@/content/privacy-policy";

export async function hasAcceptedCurrentTerms(
  userId: string
): Promise<boolean> {
  const { data, error } = await supabase
    .from("terms_acceptances")
    .select("id")
    .eq("user_id", userId)
    .eq("terms_version", TERMS_VERSION)
    .eq("privacy_version", PRIVACY_VERSION)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return !!data;
}

export async function recordTermsAcceptance(
  userId: string
): Promise<{ error: string | null }> {
  const { error } = await supabase
    .from("terms_acceptances")
    .insert({
      user_id: userId,
      terms_version: TERMS_VERSION,
      privacy_version: PRIVACY_VERSION,
    });

  if (error) {
    return {
      error: error.message,
    };
  }

  return {
    error: null,
  };
}