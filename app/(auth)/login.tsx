import { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  ActivityIndicator,
} from "react-native";

import { Link, router } from "expo-router";

import {
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react-native";

import { useAuth } from "@/context/AuthContext";

import {
  Colors,
  FontFamily,
  BorderRadius,
  Shadows,
} from "@/constants/theme";

import { LinearGradient } from "expo-linear-gradient";

import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

import { supabase } from "@/lib/supabase";

WebBrowser.maybeCompleteAuthSession();

export default function LoginScreen() {
  const {
    signIn,
    session,
    user,
    member,
    loading: authLoading,
    termsAccepted,
    validateCurrentUser,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [showPassword, setShowPassword] = useState(false);

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState<string | null>(null);

  /**
   * Handle an already-authenticated user.
   *
   * There are three important states:
   *
   * 1. Not authenticated
   *    → stay on login
   *
   * 2. Authenticated but terms are not accepted
   *    → go to legal
   *
   * 3. Authenticated and terms are accepted
   *    → go to app
   *
   * We intentionally do NOT treat authentication
   * and legal acceptance as the same thing.
   */
  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (!session || !user || !member) {
      return;
    }

    if (member.status !== "active") {
      return;
    }

    if (termsAccepted === false) {
      router.replace("./legal");
      return;
    }

    if (termsAccepted === true) {
      router.replace("/(tabs)");
      return;
    }

    /**
     * termsAccepted === null means that the legal
     * acceptance status has not been successfully
     * determined yet.
     *
     * Do not send the user into the application
     * until we know their legal status.
     */
  }, [
    session,
    user,
    member,
    termsAccepted,
    authLoading,
  ]);

  /**
   * Email/password login.
   */
  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError(
        "Please enter your email and password."
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await signIn(
        email.trim(),
        password
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      /**
       * IMPORTANT:
       *
       * signIn() already checks the current Terms
       * & Privacy Policy acceptance.
       *
       * We intentionally do not immediately navigate
       * here.
       *
       * AuthContext updates:
       *
       *   session
       *   user
       *   member
       *   termsAccepted
       *
       * and the useEffect above decides whether the
       * user goes to:
       *
       *   ./legal
       *
       * or:
       *
       *   /(tabs)
       */
    } catch (e) {
      console.error(
        "Email login error:",
        e
      );

      setError(
        "An unexpected error occurred while signing in. Please try again."
      );
    } finally {
      setLoading(false);
    }
  };

  /**
   * Google OAuth login.
   */
/**
 * Google OAuth login.
 *
 * Flow:
 *
 * 1. Open Google OAuth through Supabase.
 * 2. Receive the OAuth callback.
 * 3. Create the Supabase session.
 * 4. Validate the authenticated M13 account.
 * 5. AuthContext checks the member status and current
 *    Terms & Conditions / Privacy Policy versions.
 *
 * IMPORTANT:
 *
 * Google authentication does NOT mean the user has
 * accepted M13 Club's legal documents.
 *
 * If the user has not accepted the current legal versions,
 * they remain authenticated but are sent to ./legal.
 */
const signInWithGoogle = async () => {
  if (loading) {
    return;
  }

  try {
    setLoading(true);
    setError(null);

    /**
     * Create the Expo deep-link callback URL.
     */
    const redirectTo =
      Linking.createURL("auth/callback");

    console.log(
      "Google Redirect URL:",
      redirectTo
    );

    /**
     * Start Google OAuth through Supabase.
     */
    const {
      data,
      error: oauthError,
    } =
      await supabase.auth.signInWithOAuth({
        provider: "google",

        options: {
          redirectTo,

          /**
           * We manually open the browser using
           * expo-web-browser.
           */
          skipBrowserRedirect: true,
        },
      });

    if (oauthError) {
      console.error(
        "Google OAuth error:",
        oauthError
      );

      setError(
        oauthError.message
      );

      return;
    }

    if (!data?.url) {
      console.error(
        "Google OAuth did not return a URL."
      );

      setError(
        "No Google authentication URL was returned."
      );

      return;
    }

    console.log(
      "Opening Google OAuth URL."
    );

    /**
     * Open Google authentication in the browser.
     */
    const result =
      await WebBrowser.openAuthSessionAsync(
        data.url,
        redirectTo
      );

    console.log(
      "Google Browser Result:",
      result
    );

    /**
     * User cancelled or the browser flow did not
     * complete successfully.
     */
    if (result.type !== "success") {
      console.log(
        "Google authentication was not completed:",
        result.type
      );

      return;
    }

    /**
     * Supabase returns the authentication tokens
     * in the URL fragment.
     *
     * Example:
     *
     * m13://auth/callback#
     * access_token=...
     * &refresh_token=...
     */
    const hash =
      result.url.split("#")[1];

    if (!hash) {
      console.error(
        "Google callback did not contain a hash."
      );

      setError(
        "No authentication tokens were returned from Google."
      );

      return;
    }

    const params =
      new URLSearchParams(hash);

    const access_token =
      params.get("access_token");

    const refresh_token =
      params.get("refresh_token");

    if (
      !access_token ||
      !refresh_token
    ) {
      console.error(
        "Google callback is missing authentication tokens.",
        {
          access_token:
            !!access_token,

          refresh_token:
            !!refresh_token,
        }
      );

      setError(
        "The Google authentication response was incomplete."
      );

      return;
    }

    console.log(
      "Google tokens received. Creating Supabase session."
    );

    /**
     * Establish the authenticated Supabase session.
     *
     * IMPORTANT:
     *
     * This only establishes authentication.
     *
     * It does NOT mean the user has accepted
     * the M13 Club Terms & Conditions or
     * Privacy Policy.
     */
    const {
      data: sessionData,
      error: sessionError,
    } =
      await supabase.auth.setSession({
        access_token,
        refresh_token,
      });

    if (sessionError) {
      console.error(
        "Supabase session error:",
        sessionError
      );

      setError(
        sessionError.message
      );

      return;
    }

    if (
      !sessionData?.session?.user
    ) {
      console.error(
        "Supabase session was created without a user."
      );

      setError(
        "Unable to retrieve your M13 Club account."
      );

      return;
    }

    console.log(
      "Google Supabase session established:",
      sessionData.session.user.id
    );

    /**
     * Validate the authenticated M13 account.
     *
     * validateCurrentUser() checks:
     *
     * 1. Authenticated Supabase user exists.
     * 2. M13 members record exists.
     * 3. Member status is active.
     * 4. Current Terms & Conditions and
     *    Privacy Policy versions are accepted.
     *
     * It does NOT automatically accept anything.
     */
    const validation =
      await validateCurrentUser();

    /**
     * NEVER navigate before checking validation.error.
     */
    if (validation.error) {
      console.error(
        "Google account validation failed:",
        validation.error
      );

      setError(
        validation.error
      );

      return;
    }

    /**
     * At this point:
     *
     * - Google authentication succeeded.
     * - Supabase session exists.
     * - M13 member exists.
     * - Member status is active.
     * - AuthContext has checked the current legal versions.
     *
     * termsAccepted is updated asynchronously by AuthContext,
     * so we do NOT manually navigate here.
     *
     * The useEffect above watches termsAccepted and will
     * send the user to either:
     *
     *     ./legal
     *
     * or:
     *
     *     /(tabs)
     */
    console.log(
      "Google account successfully validated."
    );

  } catch (e) {
    console.error(
      "Google Login Exception:",
      e
    );

    setError(
      e instanceof Error
        ? e.message
        : "An unexpected error occurred while signing in with Google."
    );
  } finally {
    setLoading(false);
  }
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
      <KeyboardAvoidingView
        behavior={
          Platform.OS === "web"
            ? undefined
            : "padding"
        }
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={
            styles.scrollContent
          }
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View
              style={styles.logoContainer}
            >
              <Text
                style={styles.logoText}
              >
                M13
              </Text>
            </View>

            <Text style={styles.title}>
              Welcome Back
            </Text>

            <Text
              style={styles.subtitle}
            >
              Sign in to your membership
              account
            </Text>
          </View>

          <View
            style={styles.formContainer}
          >
            {error && (
              <View
                style={styles.errorBanner}
              >
                <Text
                  style={styles.errorText}
                >
                  {error}
                </Text>
              </View>
            )}

            <View
              style={styles.inputGroup}
            >
              <Text
                style={styles.label}
              >
                Email Address
              </Text>

              <View
                style={
                  styles.inputWrapper
                }
              >
                <Mail
                  size={20}
                  color={
                    Colors.neutral[400]
                  }
                  strokeWidth={2}
                />

                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={
                    Colors.neutral[500]
                  }
                  value={email}
                  onChangeText={
                    setEmail
                  }
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  editable={!loading}
                />
              </View>
            </View>

            <View
              style={styles.inputGroup}
            >
              <Text
                style={styles.label}
              >
                Password
              </Text>

              <View
                style={
                  styles.inputWrapper
                }
              >
                <Lock
                  size={20}
                  color={
                    Colors.neutral[400]
                  }
                  strokeWidth={2}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={
                    Colors.neutral[500]
                  }
                  value={password}
                  onChangeText={
                    setPassword
                  }
                  secureTextEntry={
                    !showPassword
                  }
                  textContentType="password"
                  editable={!loading}
                />

                <TouchableOpacity
                  onPress={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                  disabled={loading}
                >
                  {showPassword ? (
                    <EyeOff
                      size={20}
                      color={
                        Colors.neutral[400]
                      }
                      strokeWidth={2}
                    />
                  ) : (
                    <Eye
                      size={20}
                      color={
                        Colors.neutral[400]
                      }
                      strokeWidth={2}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                loading &&
                  styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator
                  color={
                    Colors.neutral[0]
                  }
                />
              ) : (
                <>
                  <Text
                    style={
                      styles.buttonText
                    }
                  >
                    Sign In
                  </Text>

                  <ArrowRight
                    size={20}
                    color={
                      Colors.neutral[0]
                    }
                    strokeWidth={2}
                  />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.googleButton,
                loading &&
                  styles.buttonDisabled,
              ]}
              onPress={
                signInWithGoogle
              }
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator
                  color="#222"
                />
              ) : (
                <Text
                  style={
                    styles.googleText
                  }
                >
                  Continue with Google
                </Text>
              )}
            </TouchableOpacity>

            <View
              style={styles.footer}
            >
              <Text
                style={styles.footerText}
              >
                Don't have an account?{" "}
              </Text>

              <Link
                href="./register"
                style={styles.linkText}
              >
                <Text
                  style={styles.linkText}
                >
                  Join the Club
                </Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
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
    minHeight: "100%",
  },

  header: {
    alignItems: "center",
    marginBottom: 40,
  },

  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    backgroundColor:
      Colors.neutral[0],
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 24,
    ...Shadows.lg,
  },

  logoText: {
    fontFamily:
      FontFamily.display,
    fontSize: 28,
    color:
      Colors.primary[950],
  },

  title: {
    fontFamily:
      FontFamily.display,
    fontSize: 32,
    color:
      Colors.neutral[0],
    marginBottom: 8,
  },

  subtitle: {
    fontFamily:
      FontFamily.regular,
    fontSize: 16,
    color:
      Colors.neutral[300],
  },

  formContainer: {
    backgroundColor:
      Colors.neutral[0],
    borderRadius:
      BorderRadius.xl,
    padding: 28,
    ...Shadows.lg,
    maxWidth: 480,
    width: "100%",
    alignSelf: "center",
  },

  errorBanner: {
    backgroundColor:
      Colors.error[50],
    borderWidth: 1,
    borderColor:
      Colors.error[200],
    borderRadius:
      BorderRadius.md,
    padding: 14,
    marginBottom: 20,
  },

  errorText: {
    fontFamily:
      FontFamily.regular,
    fontSize: 14,
    color:
      Colors.error[700],
  },

  inputGroup: {
    marginBottom: 20,
  },

  label: {
    fontFamily:
      FontFamily.medium,
    fontSize: 14,
    color:
      Colors.neutral[700],
    marginBottom: 8,
  },

  inputWrapper: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1.5,
    borderColor:
      Colors.neutral[200],
    borderRadius:
      BorderRadius.md,
    paddingHorizontal: 16,
    height: 56,
    gap: 12,
  },

  input: {
    flex: 1,
    fontFamily:
      FontFamily.regular,
    fontSize: 16,
    color:
      Colors.neutral[900],
  },

  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "center",
    gap: 8,
    backgroundColor:
      Colors.primary[700],
    borderRadius:
      BorderRadius.md,
    height: 56,
    marginTop: 8,
    ...Shadows.md,
  },

  buttonDisabled: {
    opacity: 0.6,
  },

  buttonText: {
    fontFamily:
      FontFamily.semibold,
    fontSize: 17,
    color:
      Colors.neutral[0],
  },

  googleButton: {
    marginTop: 16,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "#ddd",
    padding: 15,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 56,
  },

  googleText: {
    fontWeight: "600",
    color: "#222",
  },

  footer: {
    flexDirection: "row",
    justifyContent:
      "center",
    alignItems: "center",
    marginTop: 24,
  },

  footerText: {
    fontFamily:
      FontFamily.regular,
    fontSize: 15,
    color:
      Colors.neutral[500],
  },

  linkText: {
    fontFamily:
      FontFamily.semibold,
    fontSize: 15,
    color:
      Colors.primary[700],
  },
});