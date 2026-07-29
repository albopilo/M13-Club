import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { Ticket, CheckCircle, X, Gift } from 'lucide-react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useAuth } from '@/context/AuthContext';
import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, BorderRadius, Shadows, Spacing } from '@/constants/theme';

export default function VouchersScreen() {
  const { member, refreshMember } = useAuth();
  const [showRedeem, setShowRedeem] = useState(false);
  const [code, setCode] = useState('');
  const [redeeming, setRedeeming] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);

  const handleRedeem = async () => {
    if (!code.trim()) return;
    setRedeeming(true);
    setResult(null);
    const { data, error } = await supabase.rpc('redeem_voucher', { p_code: code.trim().toUpperCase() });
    setRedeeming(false);

    if (error) {
      setResult({ success: false, message: error.message });
    } else if (data) {
      const r = data as { success: boolean; error?: string; amount?: number };
      if (r.success) {
        setResult({ success: true, message: `MC ${r.amount} added to your wallet!` });
        setCode('');
        refreshMember();
      } else {
        setResult({ success: false, message: r.error || 'Redemption failed' });
      }
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Vouchers</Text>
        <Text style={styles.pageSubtitle}>Redeem a code to add credit to your wallet</Text>
      </View>

      <LinearGradient
        colors={[Colors.accent[500], Colors.accent[700]]}
        style={styles.heroCard}
      >
        <View style={styles.heroIcon}>
          <Gift size={32} color={Colors.neutral[0]} strokeWidth={2} />
        </View>
        <Text style={styles.heroTitle}>Have a voucher code?</Text>
        <Text style={styles.heroDesc}>
          Enter your code to instantly add credit to your M13 Club wallet.
        </Text>
        <TouchableOpacity
          style={styles.heroButton}
          onPress={() => { setShowRedeem(true); setResult(null); setCode(''); }}
          activeOpacity={0.85}
        >
          <Ticket size={20} color={Colors.accent[700]} strokeWidth={2} />
          <Text style={styles.heroButtonText}>Redeem a Code</Text>
        </TouchableOpacity>
      </LinearGradient>

      <View style={styles.infoCard}>
        <Text style={styles.infoTitle}>How it works</Text>
        <View style={styles.infoStep}>
          <View style={styles.stepNumber}><Text style={styles.stepNumberText}>1</Text></View>
          <Text style={styles.stepText}>Receive a voucher code from M13 Club promotions or staff.</Text>
        </View>
        <View style={styles.infoStep}>
          <View style={styles.stepNumber}><Text style={styles.stepNumberText}>2</Text></View>
          <Text style={styles.stepText}>Tap "Redeem a Code" and enter your code.</Text>
        </View>
        <View style={styles.infoStep}>
          <View style={styles.stepNumber}><Text style={styles.stepNumberText}>3</Text></View>
          <Text style={styles.stepText}>Credit is added to your wallet instantly.</Text>
        </View>
      </View>

      <Modal
        visible={showRedeem}
        transparent
        animationType="fade"
        onRequestClose={() => setShowRedeem(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Redeem Voucher</Text>
              <TouchableOpacity onPress={() => setShowRedeem(false)}>
                <X size={24} color={Colors.neutral[500]} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalLabel}>Enter Voucher Code</Text>
            <TextInput
              style={styles.modalInput}
              placeholder="e.g. WELCOME50"
              placeholderTextColor={Colors.neutral[400]}
              value={code}
              onChangeText={setCode}
              autoCapitalize="characters"
              autoCorrect={false}
            />

            {result && (
              <View style={[styles.resultBanner, result.success ? styles.resultSuccess : styles.resultError]}>
                {result.success ? (
                  <CheckCircle size={20} color={Colors.success[700]} strokeWidth={2} />
                ) : (
                  <X size={20} color={Colors.error[700]} strokeWidth={2} />
                )}
                <Text style={[styles.resultText, result.success ? styles.resultSuccessText : styles.resultErrorText]}>
                  {result.message}
                </Text>
              </View>
            )}

            <TouchableOpacity
              style={[styles.modalButton, (!code.trim() || redeeming) && styles.modalButtonDisabled]}
              onPress={handleRedeem}
              disabled={!code.trim() || redeeming}
              activeOpacity={0.85}
            >
              {redeeming ? (
                <ActivityIndicator color={Colors.neutral[0]} />
              ) : (
                <Text style={styles.modalButtonText}>Redeem Now</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral[50] },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  header: { marginBottom: Spacing.lg },
  pageTitle: {
    fontFamily: FontFamily.display,
    fontSize: 28,
    color: Colors.neutral[900],
    marginBottom: 4,
  },
  pageSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 15,
    color: Colors.neutral[500],
  },
  heroCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.xl,
    alignItems: 'center',
    marginBottom: Spacing.lg,
    ...Shadows.lg,
  },
  heroIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.md,
  },
  heroTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: Colors.neutral[0],
    marginBottom: 8,
  },
  heroDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: Colors.neutral[100],
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: Spacing.lg,
  },
  heroButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.neutral[0],
    borderRadius: BorderRadius.md,
    height: 52,
    paddingHorizontal: Spacing.xl,
    ...Shadows.md,
  },
  heroButtonText: {
    fontFamily: FontFamily.semibold,
    fontSize: 16,
    color: Colors.accent[700],
  },
  infoCard: {
    backgroundColor: Colors.neutral[0],
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    ...Shadows.sm,
  },
  infoTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: Colors.neutral[900],
    marginBottom: Spacing.md,
  },
  infoStep: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    marginBottom: Spacing.md,
  },
  stepNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.accent[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepNumberText: {
    fontFamily: FontFamily.bold,
    fontSize: 13,
    color: Colors.accent[700],
  },
  stepText: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: Colors.neutral[600],
    lineHeight: 20,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.neutral[0],
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    width: '100%',
    maxWidth: 440,
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 20,
    color: Colors.neutral[900],
  },
  modalLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.neutral[700],
    marginBottom: 8,
  },
  modalInput: {
    borderWidth: 1.5,
    borderColor: Colors.neutral[200],
    borderRadius: BorderRadius.md,
    paddingHorizontal: 16,
    height: 54,
    fontFamily: FontFamily.semibold,
    fontSize: 18,
    color: Colors.neutral[900],
    letterSpacing: 1,
    marginBottom: Spacing.md,
  },
  resultBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  resultSuccess: { backgroundColor: Colors.success[50] },
  resultError: { backgroundColor: Colors.error[50] },
  resultText: { flex: 1, fontFamily: FontFamily.medium, fontSize: 14 },
  resultSuccessText: { color: Colors.success[700] },
  resultErrorText: { color: Colors.error[700] },
  modalButton: {
    backgroundColor: Colors.primary[700],
    borderRadius: BorderRadius.md,
    height: 54,
    alignItems: 'center',
    justifyContent: 'center',
    ...Shadows.md,
  },
  modalButtonDisabled: { opacity: 0.5 },
  modalButtonText: {
    fontFamily: FontFamily.semibold,
    fontSize: 16,
    color: Colors.neutral[0],
  },
});
