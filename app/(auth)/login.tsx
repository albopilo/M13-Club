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
  Alert,
} from 'react-native';
import { Link, router } from 'expo-router';
import { Mail, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { Colors, FontFamily, BorderRadius, Shadows } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
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
  validateCurrentUser,
} = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);


useEffect(() => {
  if (authLoading) return;

  if (session && member?.status === "active") {
    router.replace("/(tabs)");
  }
}, [session, member, authLoading]);

  const handleLogin = async () => {
    if (!email.trim() || !password) {
      setError('Please enter your email and password.');
      return;
    }

    setLoading(true);
    setError(null);
    const { error } = await signIn(email.trim(), password);
    setLoading(false);

if (error) {
  setError(error);
}
  };

const signInWithGoogle = async () => {
  try {
    const redirectTo = Linking.createURL("auth/callback");

    console.log("Redirect URL:", redirectTo);

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo,
        skipBrowserRedirect: true,
      },
    });

    if (error) {
      Alert.alert(error.message);
      return;
    }

    if (!data?.url) {
      Alert.alert("No OAuth URL returned.");
      return;
    }

    const result = await WebBrowser.openAuthSessionAsync(
      data.url,
      redirectTo
    );

    console.log("Browser Result:", result);

    if (result.type !== "success") {
      return;
    }

    const hash = result.url.split("#")[1];

    if (!hash) {
      Alert.alert("No tokens returned from Google.");
      return;
    }

    const params = new URLSearchParams(hash);

    const access_token = params.get("access_token");
    const refresh_token = params.get("refresh_token");

    if (!access_token || !refresh_token) {
      Alert.alert("Missing access token.");
      return;
    }

const {
  data: sessionData,
  error: sessionError,
} = await supabase.auth.setSession({
  access_token,
  refresh_token,
});

if (sessionError) {
  Alert.alert(sessionError.message);
  return;
}

const validation = await validateCurrentUser();

if (validation.error) {
  setError(validation.error);
  return;
}

router.replace("/(tabs)");


} catch (e) {
  console.error("Google Exception:", e);
  Alert.alert("Google Login Error", JSON.stringify(e));
}
};

  return (
    <LinearGradient
      colors={[Colors.primary[950], Colors.primary[800], Colors.neutral[900]]}
      style={styles.gradient}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === 'web' ? undefined : 'padding'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>M13</Text>
            </View>
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>Sign in to your membership account</Text>
          </View>

          <View style={styles.formContainer}>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <View style={styles.inputWrapper}>
                <Mail size={20} color={Colors.neutral[400]} strokeWidth={2} />
                <TextInput
                  style={styles.input}
                  placeholder="you@example.com"
                  placeholderTextColor={Colors.neutral[500]}
                  value={email}
                  onChangeText={setEmail}
                  autoCapitalize="none"
                  autoCorrect={false}
                  keyboardType="email-address"
                  textContentType="emailAddress"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <View style={styles.inputWrapper}>
                <Lock size={20} color={Colors.neutral[400]} strokeWidth={2} />
                <TextInput
                  style={styles.input}
                  placeholder="Enter your password"
                  placeholderTextColor={Colors.neutral[500]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  textContentType="password"
                />
                <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                  {showPassword ? (
                    <EyeOff size={20} color={Colors.neutral[400]} strokeWidth={2} />
                  ) : (
                    <Eye size={20} color={Colors.neutral[400]} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.button, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator color={Colors.neutral[0]} />
              ) : (
                <>
                  <Text style={styles.buttonText}>Sign In</Text>
                  <ArrowRight size={20} color={Colors.neutral[0]} strokeWidth={2} />
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity
    style={styles.googleButton}
    onPress={signInWithGoogle}
>
    <Text style={styles.googleText}>
        Continue with Google
    </Text>
</TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don't have an account? </Text>
              <Link href="/(auth)/register" style={styles.linkText}>
                <Text style={styles.linkText}>Join the Club</Text>
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
    justifyContent: 'center',
    padding: 24,
    minHeight: '100%',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logoContainer: {
    width: 80,
    height: 80,
    borderRadius: BorderRadius.xl,
    backgroundColor: Colors.neutral[0],
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
    ...Shadows.lg,
  },
  logoText: {
    fontFamily: FontFamily.display,
    fontSize: 28,
    color: Colors.primary[950],
  },
  title: {
    fontFamily: FontFamily.display,
    fontSize: 32,
    color: Colors.neutral[0],
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 16,
    color: Colors.neutral[300],
  },
  formContainer: {
    backgroundColor: Colors.neutral[0],
    borderRadius: BorderRadius.xl,
    padding: 28,
    ...Shadows.lg,
    maxWidth: 480,
    width: '100%',
    alignSelf: 'center',
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
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.neutral[700],
    marginBottom: 8,
  },
  inputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    borderRadius: BorderRadius.md,
    paddingHorizontal: 16,
    height: 56,
    gap: 12,
  },
  input: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 16,
    color: Colors.neutral[900],
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: Colors.primary[700],
    borderRadius: BorderRadius.md,
    height: 56,
    marginTop: 8,
    ...Shadows.md,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  buttonText: {
    fontFamily: FontFamily.semibold,
    fontSize: 17,
    color: Colors.neutral[0],
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 24,
  },
  footerText: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    color: Colors.neutral[500],
  },
  linkText: {
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    color: Colors.primary[700],
  },
  googleButton: {
    marginTop:16,
    backgroundColor:"#ffffff",
    borderWidth:1,
    borderColor:"#ddd",
    padding:15,
    borderRadius:10,
    alignItems:"center",
},

googleText:{
    fontWeight:"600",
    color:"#222",
},
});
