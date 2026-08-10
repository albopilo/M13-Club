import {
  useEffect,
  useState,
} from "react";

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

import {
  Link,
  router,
} from "expo-router";

import {
  Mail,
  Lock,
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react-native";

import {
  useAuth,
} from "@/context/AuthContext";

import {
  Colors,
  FontFamily,
  BorderRadius,
  Shadows,
} from "@/constants/theme";

import {
  LinearGradient,
} from "expo-linear-gradient";

import * as WebBrowser from "expo-web-browser";
import * as Linking from "expo-linking";

import {
  supabase,
} from "@/lib/supabase";

/**
 * Completes AuthSession browser flows when applicable.
 */
WebBrowser.maybeCompleteAuthSession();

/**
 * Production website.
 *
 * IMPORTANT:
 *
 * We intentionally use the website root for WEB OAuth.
 *
 * We do NOT use:
 *
 * https://m13club.netlify.app/auth/callback
 *
 * because that route does not exist in the current
 * web application.
 */
const PRODUCTION_WEB_URL =
  "https://m13club.netlify.app";

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

  const [email, setEmail] =
    useState("");

  const [password, setPassword] =
    useState("");

  const [showPassword, setShowPassword] =
    useState(false);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState<string | null>(null);

  /**
   * Handle an already authenticated user.
   *
   * Authentication and legal acceptance are separate.
   *
   * false -> Legal
   * true  -> App
   * null  -> wait
   */
  useEffect(() => {
    if (authLoading) {
      return;
    }

    if (
      !session ||
      !user ||
      !member
    ) {
      return;
    }

    if (
      member.status !==
      "active"
    ) {
      return;
    }

    if (
      termsAccepted === false
    ) {
      console.log(
        "Authenticated user has not accepted current legal versions."
      );

      router.replace(
        "./legal"
      );

      return;
    }

    if (
      termsAccepted === true
    ) {
      console.log(
        "Authenticated user has accepted current legal versions."
      );

      router.replace(
        "/(tabs)"
      );

      return;
    }

    /**
     * termsAccepted === null
     *
     * Do nothing.
     *
     * AuthContext is still determining the legal state.
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
   *
   * Navigation is intentionally NOT performed here.
   *
   * AuthContext receives the Supabase auth event and
   * determines the member/legal state.
   */
  const handleLogin =
    async () => {
      if (
        !email.trim() ||
        !password
      ) {
        setError(
          "Please enter your email and password."
        );

        return;
      }

      if (loading) {
        return;
      }

      setLoading(true);
      setError(null);

      try {
        const result =
          await signIn(
            email.trim(),
            password
          );

        if (
          result.error
        ) {
          setError(
            result.error
          );

          return;
        }

        /**
         * Do not navigate here.
         *
         * AuthContext will receive SIGNED_IN,
         * validate the member, check legal acceptance,
         * and update:
         *
         * session
         * user
         * member
         * termsAccepted
         *
         * The useEffect above then chooses:
         *
         * ./legal
         *
         * or:
         *
         * /(tabs)
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
   *
   * PLATFORM BEHAVIOR
   *
   * Android:
   *
   * 1. Create native deep-link callback.
   * 2. Ask Supabase for Google OAuth URL.
   * 3. Open browser.
   * 4. Browser returns to native app.
   * 5. Extract tokens.
   * 6. Establish Supabase session.
   * 7. Validate M13 account.
   *
   * Web:
   *
   * 1. Redirect to Google through Supabase.
   * 2. Supabase redirects to the production site root.
   * 3. Supabase client restores the session.
   * 4. AuthContext handles member/legal state.
   *
   * Google authentication NEVER means
   * Terms/Privacy acceptance.
   */
  const signInWithGoogle =
    async () => {
      if (loading) {
        return;
      }

      try {
        setLoading(true);
        setError(null);

        /**
         * =====================================================
         * WEB
         * =====================================================
         *
         * Do not create /auth/callback on production web.
         *
         * The current application does not have that route.
         */
        if (
          Platform.OS ===
          "web"
        ) {
          console.log(
            "Google OAuth platform: WEB"
          );

          console.log(
            "Google Web Redirect URL:",
            PRODUCTION_WEB_URL
          );

          const {
            data,
            error:
              oauthError,
          } =
            await supabase.auth.signInWithOAuth(
              {
                provider:
                  "google",

                options: {
                  redirectTo:
                    PRODUCTION_WEB_URL,

                  /**
                   * We perform the browser redirect
                   * ourselves.
                   */
                  skipBrowserRedirect:
                    true,
                },
              }
            );

          if (
            oauthError
          ) {
            console.error(
              "Google Web OAuth error:",
              oauthError
            );

            setError(
              oauthError.message
            );

            return;
          }

          if (
            !data?.url
          ) {
            console.error(
              "Google Web OAuth did not return a URL."
            );

            setError(
              "No Google authentication URL was returned."
            );

            return;
          }

          console.log(
            "Redirecting browser to Google OAuth."
          );

          /**
           * Full browser navigation.
           *
           * After Google authentication,
           * Supabase redirects back to:
           *
           * https://m13club.netlify.app
           *
           * The Supabase client restores the session,
           * and AuthContext handles the rest.
           */
          window.location.assign(
            data.url
          );

          return;
        }

        /**
         * =====================================================
         * NATIVE / ANDROID
         * =====================================================
         *
         * This is still an OAuth callback mechanism,
         * but it is NOT an Expo Router page.
         *
         * It is a native deep link handled by
         * WebBrowser/AuthSession.
         */
        const redirectTo =
          Linking.createURL(
            "auth/callback"
          );

        console.log(
          "Google Native Redirect URL:",
          redirectTo
        );

        /**
         * Start Google OAuth through Supabase.
         */
        const {
          data,
          error:
            oauthError,
        } =
          await supabase.auth.signInWithOAuth(
            {
              provider:
                "google",

              options: {
                redirectTo,

                /**
                 * Native app opens the browser
                 * manually.
                 */
                skipBrowserRedirect:
                  true,
              },
            }
          );

        if (
          oauthError
        ) {
          console.error(
            "Google OAuth error:",
            oauthError
          );

          setError(
            oauthError.message
          );

          return;
        }

        if (
          !data?.url
        ) {
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
         * Open Google authentication.
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
         * User cancelled or the browser flow
         * did not complete.
         */
        if (
          result.type !==
          "success"
        ) {
          console.log(
            "Google authentication was not completed:",
            result.type
          );

          return;
        }

        /**
         * Supabase returns the authentication
         * response in the URL fragment.
         *
         * Example:
         *
         * m13://auth/callback#
         * access_token=...
         * &refresh_token=...
         */
        const hash =
          result.url.split(
            "#"
          )[1];

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
          new URLSearchParams(
            hash
          );

        const access_token =
          params.get(
            "access_token"
          );

        const refresh_token =
          params.get(
            "refresh_token"
          );

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
         * Establish authenticated Supabase session.
         *
         * This authenticates the user only.
         *
         * It does NOT accept legal documents.
         */
        const {
          data:
            sessionData,
          error:
            sessionError,
        } =
          await supabase.auth.setSession(
            {
              access_token,
              refresh_token,
            }
          );

        if (
          sessionError
        ) {
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
          sessionData.session
            .user.id
        );

        /**
         * Explicitly validate the M13 account.
         *
         * This checks:
         *
         * 1. Supabase user
         * 2. members row
         * 3. member status
         * 4. current Terms/Privacy acceptance
         */
        const validation =
          await validateCurrentUser();

        if (
          validation.error
        ) {
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
         * DO NOT navigate manually.
         *
         * AuthContext has updated termsAccepted.
         *
         * The useEffect above will send the user to:
         *
         * ./legal
         *
         * or:
         *
         * /(tabs)
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
      style={
        styles.gradient
      }
    >
      <KeyboardAvoidingView
        behavior={
          Platform.OS ===
          "web"
            ? undefined
            : "padding"
        }
        style={{
          flex: 1,
        }}
      >
        <ScrollView
          contentContainerStyle={
            styles.scrollContent
          }
          keyboardShouldPersistTaps="handled"
        >
          <View
            style={
              styles.header
            }
          >
            <View
              style={
                styles.logoContainer
              }
            >
              <Text
                style={
                  styles.logoText
                }
              >
                M13
              </Text>
            </View>

            <Text
              style={
                styles.title
              }
            >
              Welcome Back
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Sign in to your membership
              account
            </Text>
          </View>

          <View
            style={
              styles.formContainer
            }
          >
            {error && (
              <View
                style={
                  styles.errorBanner
                }
              >
                <Text
                  style={
                    styles.errorText
                  }
                >
                  {error}
                </Text>
              </View>
            )}

            <View
              style={
                styles.inputGroup
              }
            >
              <Text
                style={
                  styles.label
                }
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
                  style={
                    styles.input
                  }
                  placeholder="you@example.com"
                  placeholderTextColor={
                    Colors.neutral[500]
                  }
                  value={
                    email
                  }
                  onChangeText={
                    setEmail
                  }
                  autoCapitalize="none"
                  autoCorrect={
                    false
                  }
                  keyboardType="email-address"
                  textContentType="emailAddress"
                  editable={
                    !loading
                  }
                />
              </View>
            </View>

            <View
              style={
                styles.inputGroup
              }
            >
              <Text
                style={
                  styles.label
                }
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
                  style={
                    styles.input
                  }
                  placeholder="Enter your password"
                  placeholderTextColor={
                    Colors.neutral[500]
                  }
                  value={
                    password
                  }
                  onChangeText={
                    setPassword
                  }
                  secureTextEntry={
                    !showPassword
                  }
                  textContentType="password"
                  editable={
                    !loading
                  }
                />

                <TouchableOpacity
                  onPress={() =>
                    setShowPassword(
                      !showPassword
                    )
                  }
                  disabled={
                    loading
                  }
                >
                  {showPassword ? (
                    <EyeOff
                      size={20}
                      color={
                        Colors.neutral[400]
                      }
                      strokeWidth={
                        2
                      }
                    />
                  ) : (
                    <Eye
                      size={20}
                      color={
                        Colors.neutral[400]
                      }
                      strokeWidth={
                        2
                      }
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
              onPress={
                handleLogin
              }
              disabled={
                loading
              }
              activeOpacity={
                0.85
              }
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
              disabled={
                loading
              }
              activeOpacity={
                0.85
              }
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
              style={
                styles.footer
              }
            >
              <Text
                style={
                  styles.footerText
                }
              >
                Don't have an account?{" "}
              </Text>

              <Link
                href="./register"
                style={
                  styles.linkText
                }
              >
                <Text
                  style={
                    styles.linkText
                  }
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

const styles =
  StyleSheet.create({
    gradient: {
      flex: 1,
    },

    scrollContent: {
      flexGrow: 1,
      justifyContent:
        "center",
      padding: 24,
      minHeight:
        "100%",
    },

    header: {
      alignItems:
        "center",
      marginBottom: 40,
    },

    logoContainer: {
      width: 80,
      height: 80,
      borderRadius:
        BorderRadius.xl,
      backgroundColor:
        Colors.neutral[0],
      alignItems:
        "center",
      justifyContent:
        "center",
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
      alignSelf:
        "center",
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
      flexDirection:
        "row",
      alignItems:
        "center",
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
      flexDirection:
        "row",
      alignItems:
        "center",
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
      backgroundColor:
        "#ffffff",
      borderWidth: 1,
      borderColor:
        "#ddd",
      padding: 15,
      borderRadius: 10,
      alignItems:
        "center",
      justifyContent:
        "center",
      minHeight: 56,
    },

    googleText: {
      fontWeight: "600",
      color: "#222",
    },

    footer: {
      flexDirection:
        "row",
      justifyContent:
        "center",
      alignItems:
        "center",
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