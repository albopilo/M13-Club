import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
  FlatList,
  Alert,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { CreditCard, MapPin, CheckCircle, X, Store, Wallet, Shield } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { supabase, Branch, Wallet as WalletType } from '@/lib/supabase';
import { Colors, FontFamily, BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

export default function PaymentScreen() {
  const { member, refreshMember } = useAuth();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [amount, setAmount] = useState('');
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [showBranches, setShowBranches] = useState(false);
  const [showPinModal, setShowPinModal] = useState(false);
  const [pin, setPin] = useState('');
  const [processing, setProcessing] = useState(false);
  const [result, setResult] = useState<{ success: boolean; message: string } | null>(null);
  const [needsPinSetup, setNeedsPinSetup] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [settingPin, setSettingPin] = useState(false);

  const fetchData = useCallback(async () => {
    if (!member) return;
    const [walletRes, branchesRes] = await Promise.all([
      supabase.from('wallets').select('*').eq('member_id', member.id).maybeSingle(),
      supabase.from('branches').select('*').eq('is_active', true).order('name'),
    ]);
    if (walletRes.data) setWallet(walletRes.data as WalletType);
    if (branchesRes.data) setBranches(branchesRes.data as Branch[]);
  }, [member]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const balance = Math.round(Number(wallet?.balance ?? 0));
  const enteredAmount = Number(amount) || 0;

  const handlePayPress = () => {
    setResult(null);
    if (!amount.trim() || enteredAmount <= 0) {
      setResult({ success: false, message: 'Please enter a valid amount' });
      return;
    }
    if (!selectedBranch) {
      setResult({ success: false, message: 'Please select a branch store' });
      return;
    }
    if (enteredAmount > balance) {
      setResult({ success: false, message: 'Payment declined: insufficient balance' });
      return;
    }
    // Check if PIN is set
    if (!member?.transaction_pin) {
      setNeedsPinSetup(true);
      setShowPinModal(true);
      return;
    }
    setPin('');
    setShowPinModal(true);
  };

  const handleSetPin = async () => {
    if (newPin.length !== 4 || confirmPin.length !== 4) {
      Alert.alert('Error', 'PIN must be exactly 4 digits');
      return;
    }
    if (newPin !== confirmPin) {
      Alert.alert('Error', 'PINs do not match');
      return;
    }
    setSettingPin(true);
    const { data, error } = await supabase.rpc('set_transaction_pin', { p_pin: newPin });
    setSettingPin(false);

    if (error) {
console.log(error);

Alert.alert(
  "RPC Error",
  JSON.stringify(error, null, 2)
);      return;
    }
    const r = data as { success: boolean; error?: string };
    if (r?.success) {
      await refreshMember();
      setNeedsPinSetup(false);
      setNewPin('');
      setConfirmPin('');
      setShowPinModal(false);
      Alert.alert('Success', 'Transaction PIN set successfully. You can now make payments.');
    } else {
      Alert.alert('Error', r?.error || 'Failed to set PIN');
    }
  };

  const handleProcessPayment = async () => {
    if (pin.length !== 4) {
      Alert.alert('Error', 'PIN must be exactly 4 digits');
      return;
    }
    setProcessing(true);
    const { data, error } = await supabase.rpc('process_payment', {
      p_amount: enteredAmount,
      p_branch_id: selectedBranch!.id,
      p_pin: pin,
    });
    setProcessing(false);

    if (error) {
      setResult({ success: false, message: error.message });
      setShowPinModal(false);
      setPin('');
      return;
    }
    const r = data as { success: boolean; error?: string; new_balance?: number };
    if (r?.success) {
      setResult({ success: true, message: `Payment of MC ${enteredAmount} at ${selectedBranch!.name} successful!` });
      setShowPinModal(false);
      setPin('');
      setAmount('');
      setSelectedBranch(null);
      await refreshMember();
      fetchData();
    } else {
      Alert.alert('Payment Failed', r?.error || 'Payment could not be processed');
      setPin('');
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <Text style={styles.pageTitle}>Make a Payment</Text>
        <Text style={styles.pageSubtitle}>Pay at any M13 branch store</Text>
      </View>

      <LinearGradient
        colors={[Colors.primary[900], Colors.primary[700]]}
        style={styles.balanceCard}
      >
        <View style={styles.cardTop}>
          <Wallet size={22} color={Colors.neutral[200]} strokeWidth={2} />
          <Text style={styles.cardLabel}>Available Balance</Text>
        </View>
        <Text style={styles.balanceAmount}>MC {balance}</Text>
      </LinearGradient>

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

      <View style={styles.formCard}>
        <Text style={styles.fieldLabel}>Amount (MC)</Text>
        <View style={styles.amountInputWrap}>
          <Text style={styles.currencyPrefix}>MC</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="0"
            placeholderTextColor={Colors.neutral[400]}
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
          />
        </View>
        {enteredAmount > 0 && enteredAmount > balance && (
          <Text style={styles.insufficientWarning}>Insufficient balance for this payment</Text>
        )}

        <Text style={styles.fieldLabel}>Branch Store</Text>
        <TouchableOpacity
          style={styles.branchSelector}
          onPress={() => setShowBranches(true)}
          activeOpacity={0.85}
        >
          {selectedBranch ? (
            <View style={styles.branchSelectorContent}>
              <Store size={20} color={Colors.primary[700]} strokeWidth={2} />
              <View style={{ flex: 1 }}>
                <Text style={styles.branchSelectorName}>{selectedBranch.name}</Text>
                {selectedBranch.address && (
                  <Text style={styles.branchSelectorAddr} numberOfLines={1}>{selectedBranch.address}</Text>
                )}
              </View>
            </View>
          ) : (
            <View style={styles.branchSelectorContent}>
              <MapPin size={20} color={Colors.neutral[400]} strokeWidth={2} />
              <Text style={styles.branchSelectorPlaceholder}>Select a branch store</Text>
            </View>
          )}
          <Store size={20} color={Colors.neutral[300]} strokeWidth={2} />
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.payButton,
            (!amount.trim() || !selectedBranch || enteredAmount > balance || enteredAmount <= 0) && styles.payButtonDisabled,
          ]}
          onPress={handlePayPress}
          disabled={!amount.trim() || !selectedBranch || enteredAmount > balance || enteredAmount <= 0}
          activeOpacity={0.85}
        >
          <CreditCard size={20} color={Colors.neutral[0]} strokeWidth={2} />
          <Text style={styles.payButtonText}>Confirm Payment</Text>
        </TouchableOpacity>
      </View>

      {!member?.transaction_pin && (
        <View style={styles.pinNotice}>
          <Shield size={18} color={Colors.warning[600]} strokeWidth={2} />
          <Text style={styles.pinNoticeText}>
            You need to set up a 4-digit transaction PIN before making your first payment.
          </Text>
        </View>
      )}

      <Modal visible={showBranches} transparent animationType="slide" onRequestClose={() => setShowBranches(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.branchModal}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Branch</Text>
              <TouchableOpacity onPress={() => setShowBranches(false)}>
                <X size={24} color={Colors.neutral[500]} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <FlatList
              data={branches}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.branchItem}
                  onPress={() => { setSelectedBranch(item); setShowBranches(false); }}
                >
                  <View style={styles.branchItemIcon}>
                    <Store size={20} color={Colors.primary[700]} strokeWidth={2} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.branchItemName}>{item.name}</Text>
                    {item.address && <Text style={styles.branchItemAddr}>{item.address}</Text>}
                  </View>
                  {selectedBranch?.id === item.id && (
                    <CheckCircle size={22} color={Colors.primary[700]} strokeWidth={2} />
                  )}
                </TouchableOpacity>
              )}
              ItemSeparatorComponent={() => <View style={styles.separator} />}
            />
          </View>
        </View>
      </Modal>

      <Modal visible={showPinModal} transparent animationType="fade" onRequestClose={() => setShowPinModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{needsPinSetup ? 'Create Transaction PIN' : 'Enter PIN'}</Text>
              <TouchableOpacity onPress={() => { setShowPinModal(false); setPin(''); setNewPin(''); setConfirmPin(''); }}>
                <X size={24} color={Colors.neutral[500]} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {needsPinSetup ? (
              <>
                <Text style={styles.modalDesc}>
                  Create a 4-digit PIN to secure your payments. You'll need this PIN every time you make a payment.
                </Text>
                <Text style={styles.fieldLabel}>New PIN (4 digits)</Text>
                <TextInput
                  style={styles.pinInput}
                  value={newPin}
                  onChangeText={(v) => setNewPin(v.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={4}
                />
                <Text style={styles.fieldLabel}>Confirm PIN</Text>
                <TextInput
                  style={styles.pinInput}
                  value={confirmPin}
                  onChangeText={(v) => setConfirmPin(v.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={4}
                />
                <TouchableOpacity
                  style={[styles.modalButton, (newPin.length !== 4 || confirmPin.length !== 4 || settingPin) && styles.modalButtonDisabled]}
                  onPress={handleSetPin}
                  disabled={newPin.length !== 4 || confirmPin.length !== 4 || settingPin}
                  activeOpacity={0.85}
                >
                  {settingPin ? (
                    <ActivityIndicator color={Colors.neutral[0]} />
                  ) : (
                    <Text style={styles.modalButtonText}>Create PIN</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.modalDesc}>
                  Enter your 4-digit PIN to confirm payment of MC {enteredAmount} at {selectedBranch?.name}.
                </Text>
                <TextInput
                  style={styles.pinInputLarge}
                  value={pin}
                  onChangeText={(v) => setPin(v.replace(/\D/g, '').slice(0, 4))}
                  keyboardType="numeric"
                  secureTextEntry
                  maxLength={4}
                  autoFocus
                />
                <TouchableOpacity
                  style={[styles.modalButton, pin.length !== 4 && styles.modalButtonDisabled]}
                  onPress={handleProcessPayment}
                  disabled={pin.length !== 4 || processing}
                  activeOpacity={0.85}
                >
                  {processing ? (
                    <ActivityIndicator color={Colors.neutral[0]} />
                  ) : (
                    <Text style={styles.modalButtonText}>Confirm Payment</Text>
                  )}
                </TouchableOpacity>
              </>
            )}
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
  pageTitle: { fontFamily: FontFamily.display, fontSize: 28, color: Colors.neutral[900], marginBottom: 4 },
  pageSubtitle: { fontFamily: FontFamily.regular, fontSize: 15, color: Colors.neutral[500] },
  balanceCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.lg,
  },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: Spacing.sm },
  cardLabel: { fontFamily: FontFamily.medium, fontSize: 14, color: Colors.neutral[200] },
  balanceAmount: { fontFamily: FontFamily.display, fontSize: 40, color: Colors.neutral[0] },
  resultBanner: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.lg,
  },
  resultSuccess: { backgroundColor: Colors.success[50] },
  resultError: { backgroundColor: Colors.error[50] },
  resultText: { flex: 1, fontFamily: FontFamily.medium, fontSize: 14 },
  resultSuccessText: { color: Colors.success[700] },
  resultErrorText: { color: Colors.error[700] },
  formCard: {
    backgroundColor: Colors.neutral[0],
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.md,
  },
  fieldLabel: { fontFamily: FontFamily.medium, fontSize: 14, color: Colors.neutral[700], marginBottom: 8, marginTop: Spacing.sm },
  amountInputWrap: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.neutral[200],
    borderRadius: BorderRadius.md, marginBottom: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  currencyPrefix: { fontFamily: FontFamily.semibold, fontSize: 18, color: Colors.neutral[400], marginRight: Spacing.sm },
  amountInput: { flex: 1, height: 54, fontFamily: FontFamily.bold, fontSize: 24, color: Colors.neutral[900] },
  insufficientWarning: { fontFamily: FontFamily.medium, fontSize: 13, color: Colors.error[600], marginBottom: Spacing.sm },
  branchSelector: {
    flexDirection: 'row', alignItems: 'center',
    borderWidth: 1.5, borderColor: Colors.neutral[200],
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md,
    height: 56, gap: Spacing.md,
  },
  branchSelectorContent: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  branchSelectorName: { fontFamily: FontFamily.semibold, fontSize: 15, color: Colors.neutral[900] },
  branchSelectorAddr: { fontFamily: FontFamily.regular, fontSize: 12, color: Colors.neutral[500] },
  branchSelectorPlaceholder: { fontFamily: FontFamily.regular, fontSize: 15, color: Colors.neutral[400] },
  payButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: Spacing.sm,
    backgroundColor: Colors.primary[700], borderRadius: BorderRadius.md,
    height: 54, marginTop: Spacing.lg, ...Shadows.md,
  },
  payButtonDisabled: { opacity: 0.4 },
  payButtonText: { fontFamily: FontFamily.semibold, fontSize: 16, color: Colors.neutral[0] },
  pinNotice: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.warning[50], borderRadius: BorderRadius.md,
    padding: Spacing.md, borderWidth: 1, borderColor: Colors.warning[200],
  },
  pinNoticeText: { flex: 1, fontFamily: FontFamily.medium, fontSize: 13, color: Colors.warning[700] },
  modalOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center', alignItems: 'center', padding: Spacing.lg,
  },
  modalContent: {
    backgroundColor: Colors.neutral[0], borderRadius: BorderRadius.xl,
    padding: Spacing.lg, width: '100%', maxWidth: 440, ...Shadows.lg,
  },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.md },
  modalTitle: { fontFamily: FontFamily.bold, fontSize: 20, color: Colors.neutral[900] },
  modalDesc: { fontFamily: FontFamily.regular, fontSize: 14, color: Colors.neutral[600], lineHeight: 20, marginBottom: Spacing.md },
  pinInput: {
    borderWidth: 1.5, borderColor: Colors.neutral[200], borderRadius: BorderRadius.md,
    paddingHorizontal: 16, height: 54, fontFamily: FontFamily.bold, fontSize: 22,
    color: Colors.neutral[900], textAlign: 'center', letterSpacing: 8, marginBottom: Spacing.md,
  },
  pinInputLarge: {
    borderWidth: 1.5, borderColor: Colors.neutral[200], borderRadius: BorderRadius.md,
    paddingHorizontal: 16, height: 64, fontFamily: FontFamily.bold, fontSize: 28,
    color: Colors.neutral[900], textAlign: 'center', letterSpacing: 12, marginBottom: Spacing.lg,
  },
  modalButton: {
    backgroundColor: Colors.primary[700], borderRadius: BorderRadius.md,
    height: 54, alignItems: 'center', justifyContent: 'center', ...Shadows.md,
  },
  modalButtonDisabled: { opacity: 0.5 },
  modalButtonText: { fontFamily: FontFamily.semibold, fontSize: 16, color: Colors.neutral[0] },
  branchModal: {
    backgroundColor: Colors.neutral[0], borderRadius: BorderRadius.xl,
    padding: Spacing.lg, width: '100%', maxWidth: 440, maxHeight: '70%', ...Shadows.lg,
  },
  branchItem: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, paddingVertical: Spacing.md },
  branchItemIcon: {
    width: 44, height: 44, borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary[50], alignItems: 'center', justifyContent: 'center',
  },
  branchItemName: { fontFamily: FontFamily.semibold, fontSize: 15, color: Colors.neutral[900], marginBottom: 2 },
  branchItemAddr: { fontFamily: FontFamily.regular, fontSize: 12, color: Colors.neutral[500] },
  separator: { height: 1, backgroundColor: Colors.neutral[100] },
});
