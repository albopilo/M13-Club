import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { router } from "expo-router";
import { Check, ExternalLink } from "lucide-react-native";
import { LinearGradient } from "expo-linear-gradient";

import {
  Colors,
  FontFamily,
  BorderRadius,
  Shadows,
} from "@/constants/theme";

import { useAuth } from "@/context/AuthContext";
import { recordTermsAcceptance } from "@/lib/terms";

export default function LegalAcceptanceScreen() {
  const {
    user,
    refreshTermsAcceptance,
  } = useAuth();

  const [accepted, setAccepted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Record legal acceptance for the currently
   * authenticated Supabase user.
   *
   * Authentication and legal acceptance are intentionally
   * separate states.
   */
  const handleAccept = async () => {
    if (!accepted) {
      setError(
        "Please agree to the M13 Club Terms & Conditions and Privacy Policy."
      );
      return;
    }

    if (!user?.id) {
      setError(
        "Unable to identify your account. Please sign in again."
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      /*
       * Record the acceptance against the real Supabase
       * authenticated user ID.
       *
       * The current terms/privacy versions are handled
       * inside lib/terms.ts.
       */
      const result = await recordTermsAcceptance(user.id);

      if (result?.error) {
        setError(result.error);
        return;
      }

      /*
       * Re-check the legal status through AuthContext.
       *
       * This keeps AuthContext's termsAccepted state
       * synchronized with the database before entering
       * the application.
       */
      const refreshed = await refreshTermsAcceptance();

      if (refreshed.error) {
        setError(refreshed.error);
        return;
      }

      if (!refreshed.accepted) {
        setError(
          "Your legal acceptance could not be verified. Please try again."
        );
        return;
      }

      /*
       * Only enter the application after the database
       * acceptance has been successfully verified.
       */
      router.replace("/(tabs)");
    } catch (e) {
      console.error("Legal acceptance error:", e);

      setError(
        e instanceof Error
          ? e.message
          : "Unable to save your legal acceptance. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Open Terms & Conditions.
   */
  const openTerms = () => {
    router.push("/(auth)/terms");
  };

  /**
   * Open Privacy Policy.
   */
  const openPrivacy = () => {
    router.push("/(auth)/privacy");
  };

  return (
    <LinearGradient
      colors={[
        Colors.primary[950],
        Colors.primary[800],
        Colors.neutral[900],
      ]}
      style={styles.gradient}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <View style={styles.logoContainer}>
            <Text style={styles.logoText}>M13</Text>
          </View>

          <Text style={styles.title}>
            Before You Continue
          </Text>

          <Text style={styles.subtitle}>
            Please review and accept the M13 Club Terms &
            Conditions and Privacy Policy.
          </Text>
        </View>

        <View style={styles.card}>
          {error && (
            <View style={styles.errorBanner}>
              <Text style={styles.errorText}>
                {error}
              </Text>
            </View>
          )}

          <Text style={styles.heading}>
            Legal Agreement
          </Text>

          <Text style={styles.description}>
            To use M13 Club, you must read and agree to our
            Terms & Conditions and acknowledge our Privacy
            Policy.
          </Text>

          <TouchableOpacity
            style={styles.documentButton}
            onPress={openTerms}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open M13 Club Terms and Conditions"
          >
            <View style={styles.documentTextContainer}>
              <Text style={styles.documentTitle}>
                M13 Club Terms & Conditions
              </Text>

              <Text style={styles.documentSubtitle}>
                Rules for using your account, MC, vouchers,
                transactions, and M13 Club services.
              </Text>
            </View>

            <ExternalLink
              size={20}
              color={Colors.primary[700]}
              strokeWidth={2}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.documentButton}
            onPress={openPrivacy}
            activeOpacity={0.8}
            accessibilityRole="button"
            accessibilityLabel="Open M13 Club Privacy Policy"
          >
            <View style={styles.documentTextContainer}>
              <Text style={styles.documentTitle}>
                M13 Club Privacy Policy
              </Text>

              <Text style={styles.documentSubtitle}>
                How M13 collects, uses, stores, and protects
                your personal information.
              </Text>
            </View>

            <ExternalLink
              size={20}
              color={Colors.primary[700]}
              strokeWidth={2}
            />
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.checkboxRow}
            onPress={() => {
              setAccepted((current) => !current);
              setError(null);
            }}
            activeOpacity={0.8}
            accessibilityRole="checkbox"
            accessibilityState={{
              checked: accepted,
              disabled: loading,
            }}
            disabled={loading}
          >
            <View
              style={[
                styles.checkbox,
                accepted && styles.checkboxChecked,
              ]}
            >
              {accepted && (
                <Check
                  size={18}
                  color={Colors.neutral[0]}
                  strokeWidth={3}
                />
              )}
            </View>

            <Text style={styles.checkboxText}>
              I have read and agree to the M13 Club Terms &
              Conditions and acknowledge the M13 Club
              Privacy Policy.
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.acceptButton,
              (!accepted || loading) &&
                styles.buttonDisabled,
            ]}
            onPress={handleAccept}
            disabled={!accepted || loading}
            activeOpacity={0.85}
            accessibilityRole="button"
            accessibilityState={{
              disabled: !accepted || loading,
            }}
          >
            {loading ? (
              <ActivityIndicator
                color={Colors.neutral[0]}
              />
            ) : (
              <Text style={styles.acceptButtonText}>
                Accept & Continue
              </Text>
            )}
          </TouchableOpacity>

          <Text style={styles.versionText}>
            Terms and Privacy Policy version 1.0
          </Text>
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },

  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 24,
  },

  header: {
    alignItems: "center",
    marginBottom: 28,
  },

  logoContainer: {
    width: 72,
    height: 72,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.neutral[0],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
    ...Shadows.lg,
  },

  logoText: {
    fontFamily: FontFamily.display,
    fontSize: 25,
    color: Colors.primary[950],
  },

  title: {
    fontFamily: FontFamily.display,
    fontSize: 30,
    color: Colors.neutral[0],
    marginBottom: 8,
    textAlign: "center",
  },

  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    color: Colors.neutral[300],
    textAlign: "center",
    maxWidth: 500,
    lineHeight: 22,
  },

  card: {
    backgroundColor: Colors.neutral[0],
    borderRadius: BorderRadius.xl,
    padding: 28,
    maxWidth: 520,
    width: "100%",
    alignSelf: "center",
    ...Shadows.lg,
  },

  errorBanner: {
    backgroundColor: Colors.error[50],
    borderWidth: 1,
    borderColor: Colors.error[200],
    borderRadius: BorderRadius.md,
    padding: 14,
    marginBottom: 20,
  },

  errorText: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: Colors.error[700],
    lineHeight: 20,
  },

  heading: {
    fontFamily: FontFamily.semibold,
    fontSize: 20,
    color: Colors.neutral[900],
    marginBottom: 8,
  },

  description: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    lineHeight: 22,
    color: Colors.neutral[600],
    marginBottom: 20,
  },

  documentButton: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    borderRadius: BorderRadius.md,
    padding: 16,
    marginBottom: 12,
  },

  documentTextContainer: {
    flex: 1,
    paddingRight: 12,
  },

  documentTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    color: Colors.primary[700],
    marginBottom: 4,
  },

  documentSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 19,
    color: Colors.neutral[500],
  },

  checkboxRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginTop: 16,
    marginBottom: 20,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.neutral[300],
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
    marginTop: 1,
  },

  checkboxChecked: {
    backgroundColor: Colors.primary[700],
    borderColor: Colors.primary[700],
  },

  checkboxText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 14,
    lineHeight: 21,
    color: Colors.neutral[700],
  },

  acceptButton: {
    height: 56,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary[700],
    alignItems: "center",
    justifyContent: "center",
    ...Shadows.md,
  },

  acceptButtonText: {
    fontFamily: FontFamily.semibold,
    fontSize: 17,
    color: Colors.neutral[0],
  },

  buttonDisabled: {
    opacity: 0.5,
  },

  versionText: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.neutral[400],
    textAlign: "center",
    marginTop: 16,
  },
});