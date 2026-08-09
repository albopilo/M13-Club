import { useState } from 'react';
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
} from 'react-native';
import { Link, router } from 'expo-router';
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Eye,
  EyeOff,
  Phone,
  Check,
  ExternalLink,
} from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import {
  Colors,
  FontFamily,
  BorderRadius,
  Shadows,
} from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

export default function RegisterScreen() {
  const { signUp } = useAuth();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  const [showPassword, setShowPassword] = useState(false);

  const [acceptedLegal, setAcceptedLegal] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !password) {
      setError('Please fill in all required fields.');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (!acceptedLegal) {
      setError(
        'Please agree to the M13 Club Terms & Conditions and Privacy Policy.'
      );
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await signUp(
        email.trim(),
        password,
        fullName.trim()
      );

      if (result.error) {
        setError(result.error);
        return;
      }

      /*
       * The account has been created successfully.
       *
       * Legal acceptance will be handled by the authenticated
       * legal acceptance flow so that the acceptance is tied to
       * the actual Supabase user ID.
       */
      router.replace('/(auth)/legal');
    } catch (e) {
      console.error('Registration error:', e);

      setError(
        'An unexpected error occurred while creating your account. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  };

  const openTerms = () => {
    router.push('//terms');
  };

  const openPrivacy = () => {
    router.push('//privacy');
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
        behavior={Platform.OS === 'web' ? undefined : 'padding'}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.header}>
            <View style={styles.logoContainer}>
              <Text style={styles.logoText}>M13</Text>
            </View>

            <Text style={styles.title}>Join M13 Club</Text>

            <Text style={styles.subtitle}>
              Create your membership account
            </Text>
          </View>

          <View style={styles.formContainer}>
            {error && (
              <View style={styles.errorBanner}>
                <Text style={styles.errorText}>{error}</Text>
              </View>
            )}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name *</Text>

              <View style={styles.inputWrapper}>
                <User
                  size={20}
                  color={Colors.neutral[400]}
                  strokeWidth={2}
                />

                <TextInput
                  style={styles.input}
                  placeholder="John Doe"
                  placeholderTextColor={Colors.neutral[500]}
                  value={fullName}
                  onChangeText={setFullName}
                  textContentType="name"
                  autoCapitalize="words"
                  autoCorrect={false}
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address *</Text>

              <View style={styles.inputWrapper}>
                <Mail
                  size={20}
                  color={Colors.neutral[400]}
                  strokeWidth={2}
                />

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
              <Text style={styles.label}>Phone Number</Text>

              <View style={styles.inputWrapper}>
                <Phone
                  size={20}
                  color={Colors.neutral[400]}
                  strokeWidth={2}
                />

                <TextInput
                  style={styles.input}
                  placeholder="+60 12 345 6789"
                  placeholderTextColor={Colors.neutral[500]}
                  value={phone}
                  onChangeText={setPhone}
                  keyboardType="phone-pad"
                  textContentType="telephoneNumber"
                />
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password *</Text>

              <View style={styles.inputWrapper}>
                <Lock
                  size={20}
                  color={Colors.neutral[400]}
                  strokeWidth={2}
                />

                <TextInput
                  style={styles.input}
                  placeholder="At least 6 characters"
                  placeholderTextColor={Colors.neutral[500]}
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
                  autoCapitalize="none"
                  autoCorrect={false}
                />

                <TouchableOpacity
                  onPress={() =>
                    setShowPassword(!showPassword)
                  }
                  activeOpacity={0.7}
                >
                  {showPassword ? (
                    <EyeOff
                      size={20}
                      color={Colors.neutral[400]}
                      strokeWidth={2}
                    />
                  ) : (
                    <Eye
                      size={20}
                      color={Colors.neutral[400]}
                      strokeWidth={2}
                    />
                  )}
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>
                Confirm Password *
              </Text>

              <View style={styles.inputWrapper}>
                <Lock
                  size={20}
                  color={Colors.neutral[400]}
                  strokeWidth={2}
                />

                <TextInput
                  style={styles.input}
                  placeholder="Re-enter password"
                  placeholderTextColor={Colors.neutral[500]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  secureTextEntry={!showPassword}
                  textContentType="newPassword"
                  autoCapitalize="none"
                  autoCorrect={false}
                />
              </View>
            </View>

            {/* Legal acceptance */}
            <View style={styles.legalContainer}>
              <Text style={styles.legalHeading}>
                Legal Agreement
              </Text>

              <Text style={styles.legalDescription}>
                Before creating your account, please review
                and agree to the M13 Club Terms & Conditions and
                Privacy Policy.
              </Text>

              <TouchableOpacity
                style={styles.documentButton}
                onPress={openTerms}
                activeOpacity={0.8}
              >
                <View style={styles.documentTextContainer}>
                  <Text style={styles.documentTitle}>
                    M13 Club Terms & Conditions
                  </Text>

                  <Text style={styles.documentSubtitle}>
                    Rules for your account, MC, vouchers,
                    transactions, and use of M13 Club.
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
                  setAcceptedLegal(!acceptedLegal);
                  setError(null);
                }}
                activeOpacity={0.8}
                accessibilityRole="checkbox"
                accessibilityState={{
                  checked: acceptedLegal,
                }}
              >
                <View
                  style={[
                    styles.checkbox,
                    acceptedLegal &&
                      styles.checkboxChecked,
                  ]}
                >
                  {acceptedLegal && (
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
            </View>

            <TouchableOpacity
              style={[
                styles.button,
                (loading || !acceptedLegal) &&
                  styles.buttonDisabled,
              ]}
              onPress={handleRegister}
              disabled={loading || !acceptedLegal}
              activeOpacity={0.85}
            >
              {loading ? (
                <ActivityIndicator
                  color={Colors.neutral[0]}
                />
              ) : (
                <>
                  <Text style={styles.buttonText}>
                    Create Account
                  </Text>

                  <ArrowRight
                    size={20}
                    color={Colors.neutral[0]}
                    strokeWidth={2}
                  />
                </>
              )}
            </TouchableOpacity>

            <View style={styles.footer}>
              <Text style={styles.footerText}>
                Already a member?{' '}
              </Text>

              <Link
                href="/(auth)/login"
                style={styles.linkText}
              >
                <Text style={styles.linkText}>
                  Sign In
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
    justifyContent: 'center',
    padding: 24,
    minHeight: '100%',
  },

  header: {
    alignItems: 'center',
    marginBottom: 32,
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
    fontSize: 30,
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
    marginBottom: 16,
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

  legalContainer: {
    marginTop: 4,
    marginBottom: 8,
  },

  legalHeading: {
    fontFamily: FontFamily.semibold,
    fontSize: 17,
    color: Colors.neutral[900],
    marginBottom: 6,
  },

  legalDescription: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    lineHeight: 20,
    color: Colors.neutral[600],
    marginBottom: 14,
  },

  documentButton: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.neutral[200],
    borderRadius: BorderRadius.md,
    padding: 14,
    marginBottom: 10,
  },

  documentTextContainer: {
    flex: 1,
    paddingRight: 12,
  },

  documentTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    color: Colors.primary[700],
    marginBottom: 3,
  },

  documentSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    lineHeight: 18,
    color: Colors.neutral[500],
  },

  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginTop: 8,
    marginBottom: 18,
  },

  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: Colors.neutral[300],
    alignItems: 'center',
    justifyContent: 'center',
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
    fontSize: 13,
    lineHeight: 20,
    color: Colors.neutral[700],
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
    opacity: 0.5,
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
});