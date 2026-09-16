import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity, TextInput, Modal, ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, Search, Wallet, X, TrendingUp, TrendingDown } from 'lucide-react-native';
import { supabase, Member, Wallet as WalletType } from '@/lib/supabase';
import { Colors, FontFamily, BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';

interface MemberWithWallet extends Member {
  wallet: WalletType | null;
}

export default function AdminWalletScreen() {
  const { t } = useLanguage();
  const [members, setMembers] = useState<MemberWithWallet[]>([]);
  const [search, setSearch] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<MemberWithWallet | null>(null);
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('');
  const [adjustType, setAdjustType] = useState<'credit' | 'debit'>('credit');
  const [adjusting, setAdjusting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    const { data } = await supabase
      .from('members')
      .select('*, wallet:wallets(*)')
      .eq('role', 'member')
      .order('full_name', { ascending: true });
    if (data) setMembers(data as MemberWithWallet[]);
  }, []);

  useFocusEffect(useCallback(() => { fetchMembers(); }, [fetchMembers]));

  const onRefresh = async () => { setRefreshing(true); await fetchMembers(); setRefreshing(false); };

  const filtered = members.filter(m =>
    m.full_name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    m.member_number.toLowerCase().includes(search.toLowerCase())
  );

  const handleAdjust = async () => {
    if (!selected || !amount) return;
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt <= 0) { setError(t('adminWallet.invalidAmount')); return; }
    setAdjusting(true);
    setError(null);
    setSuccess(null);
    const signedAmt = adjustType === 'debit' ? -Math.abs(amt) : Math.abs(amt);
    const { data, error: rpcError } = await supabase.rpc('admin_adjust_wallet', {
      p_member_id: selected.id,
      p_amount: signedAmt,
      p_reason: reason || 'Admin adjustment',
      p_type: adjustType,
    });
    setAdjusting(false);
    if (rpcError) { setError(rpcError.message); return; }
    const r = data as { success: boolean; error?: string; new_balance?: number };
    if (!r.success) { setError(r.error || 'Failed'); return; }
    setSuccess(t('adminWallet.updated', { balance: Math.round(r.new_balance ?? 0) }));
    setAmount('');
    setReason('');
    fetchMembers();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.neutral[0]} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('adminWallet.title')}</Text>
      </View>

      <View style={styles.searchBar}>
        <Search size={18} color={Colors.neutral[400]} strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('adminWallet.search')}
          placeholderTextColor={Colors.neutral[400]}
          value={search}
          onChangeText={setSearch}
        />
      </View>

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: Spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Wallet size={32} color={Colors.neutral[300]} strokeWidth={1.5} />
            <Text style={styles.emptyText}>{t('adminWallet.none')}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.memberCard} onPress={() => { setSelected(item); setError(null); setSuccess(null); setAmount(''); setReason(''); }} activeOpacity={0.85}>
            <View style={styles.memberAvatar}>
              <Text style={styles.memberAvatarText}>{item.full_name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{item.full_name}</Text>
              <Text style={styles.memberNumber}>{item.member_number}</Text>
            </View>
            <View style={styles.balanceCol}>
              <Text style={styles.balanceLabel}>{t('adminWallet.balance')}</Text>
              <Text style={styles.balanceAmount}>MC {Math.round(Number(item.wallet?.balance ?? 0))}</Text>
            </View>
          </TouchableOpacity>
        )}
      />

      <Modal visible={!!selected} transparent animationType="fade" onRequestClose={() => setSelected(null)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {selected && (
              <>
                <View style={styles.modalHeader}>
                  <Text style={styles.modalTitle}>{t('adminWallet.adjust')}</Text>
                  <TouchableOpacity onPress={() => setSelected(null)}>
                    <X size={24} color={Colors.neutral[500]} strokeWidth={2} />
                  </TouchableOpacity>
                </View>

                <View style={styles.memberInfo}>
                  <Text style={styles.memberInfoName}>{selected.full_name}</Text>
                  <Text style={styles.memberInfoId}>{selected.member_number}</Text>
                  <Text style={styles.currentBalance}>{t('adminWallet.currentBalance', { balance: Math.round(Number(selected.wallet?.balance ?? 0)) })}</Text>
                </View>

                <View style={styles.typeToggle}>
                  <TouchableOpacity
                    style={[styles.typeBtn, adjustType === 'credit' && styles.typeBtnActive]}
                    onPress={() => setAdjustType('credit')}
                  >
                    <TrendingUp size={18} color={adjustType === 'credit' ? Colors.neutral[0] : Colors.neutral[500]} strokeWidth={2} />
                    <Text style={[styles.typeBtnText, adjustType === 'credit' && styles.typeBtnTextActive]}>{t('adminWallet.credit')}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[styles.typeBtn, adjustType === 'debit' && styles.typeBtnActiveDebit]}
                    onPress={() => setAdjustType('debit')}
                  >
                    <TrendingDown size={18} color={adjustType === 'debit' ? Colors.neutral[0] : Colors.neutral[500]} strokeWidth={2} />
                    <Text style={[styles.typeBtnText, adjustType === 'debit' && styles.typeBtnTextActive]}>{t('adminWallet.debit')}</Text>
                  </TouchableOpacity>
                </View>

                <Text style={styles.fieldLabel}>{t('adminWallet.amount')}</Text>
                <TextInput
                  style={styles.fieldInput}
                  placeholder="0"
                  placeholderTextColor={Colors.neutral[400]}
                  value={amount}
                  onChangeText={setAmount}
                  keyboardType="numeric"
                />

                <Text style={styles.fieldLabel}>{t('adminWallet.reason')}</Text>
                <TextInput
                  style={[styles.fieldInput, { height: 70, textAlignVertical: 'top' }]}
                  placeholder={t('adminWallet.reasonPlaceholder')}
                  placeholderTextColor={Colors.neutral[400]}
                  value={reason}
                  onChangeText={setReason}
                  multiline
                />

                {error && <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View>}
                {success && <View style={styles.successBanner}><Text style={styles.successText}>{success}</Text></View>}

                <TouchableOpacity
                  style={[styles.adjustBtn, adjusting && styles.adjustBtnDisabled, adjustType === 'debit' && styles.adjustBtnDebit]}
                  onPress={handleAdjust}
                  disabled={adjusting || !amount}
                  activeOpacity={0.85}
                >
                  {adjusting ? <ActivityIndicator color={Colors.neutral[0]} /> : (
                    <Text style={styles.adjustBtnText}>
                      {adjustType === 'credit' ? t('adminWallet.creditBtn') : t('adminWallet.debitBtn')}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral[50] },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.primary[900], paddingTop: Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: 20, color: Colors.neutral[0] },
  searchBar: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, backgroundColor: Colors.neutral[0], margin: Spacing.lg, marginBottom: 0, borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 50, ...Shadows.sm },
  searchInput: { flex: 1, fontFamily: FontFamily.regular, fontSize: 15, color: Colors.neutral[900] },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyText: { fontFamily: FontFamily.regular, fontSize: 14, color: Colors.neutral[400] },
  memberCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.neutral[0], borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadows.sm },
  memberAvatar: { width: 44, height: 44, borderRadius: 22, backgroundColor: Colors.primary[100], alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontFamily: FontFamily.bold, fontSize: 16, color: Colors.primary[700] },
  memberName: { fontFamily: FontFamily.semibold, fontSize: 15, color: Colors.neutral[900], marginBottom: 2 },
  memberNumber: { fontFamily: FontFamily.regular, fontSize: 12, color: Colors.neutral[400] },
  balanceCol: { alignItems: 'flex-end' },
  balanceLabel: { fontFamily: FontFamily.regular, fontSize: 11, color: Colors.neutral[400], marginBottom: 2 },
  balanceAmount: { fontFamily: FontFamily.bold, fontSize: 16, color: Colors.success[700] },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  modalContent: { backgroundColor: Colors.neutral[0], borderRadius: BorderRadius.xl, padding: Spacing.lg, width: '100%', maxWidth: 440, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontFamily: FontFamily.bold, fontSize: 20, color: Colors.neutral[900] },
  memberInfo: { backgroundColor: Colors.neutral[50], borderRadius: BorderRadius.md, padding: Spacing.md, marginBottom: Spacing.lg },
  memberInfoName: { fontFamily: FontFamily.semibold, fontSize: 16, color: Colors.neutral[900] },
  memberInfoId: { fontFamily: FontFamily.regular, fontSize: 13, color: Colors.neutral[400], marginTop: 2 },
  currentBalance: { fontFamily: FontFamily.bold, fontSize: 15, color: Colors.primary[700], marginTop: Spacing.sm },
  typeToggle: { flexDirection: 'row', gap: Spacing.sm, marginBottom: Spacing.lg },
  typeBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, borderWidth: 1.5, borderColor: Colors.neutral[200], borderRadius: BorderRadius.md, paddingVertical: 12 },
  typeBtnActive: { backgroundColor: Colors.success[600], borderColor: Colors.success[600] },
  typeBtnActiveDebit: { backgroundColor: Colors.error[600], borderColor: Colors.error[600] },
  typeBtnText: { fontFamily: FontFamily.semibold, fontSize: 13, color: Colors.neutral[500] },
  typeBtnTextActive: { color: Colors.neutral[0] },
  fieldLabel: { fontFamily: FontFamily.medium, fontSize: 13, color: Colors.neutral[700], marginBottom: 6 },
  fieldInput: { borderWidth: 1.5, borderColor: Colors.neutral[200], borderRadius: BorderRadius.md, paddingHorizontal: 14, height: 48, fontFamily: FontFamily.regular, fontSize: 15, color: Colors.neutral[900], marginBottom: Spacing.md },
  errorBanner: { backgroundColor: Colors.error[50], borderWidth: 1, borderColor: Colors.error[200], borderRadius: BorderRadius.md, padding: 12, marginBottom: Spacing.md },
  errorText: { fontFamily: FontFamily.regular, fontSize: 13, color: Colors.error[700] },
  successBanner: { backgroundColor: Colors.success[50], borderWidth: 1, borderColor: Colors.success[200], borderRadius: BorderRadius.md, padding: 12, marginBottom: Spacing.md },
  successText: { fontFamily: FontFamily.regular, fontSize: 13, color: Colors.success[700] },
  adjustBtn: { backgroundColor: Colors.success[600], borderRadius: BorderRadius.md, height: 52, alignItems: 'center', justifyContent: 'center', ...Shadows.md },
  adjustBtnDisabled: { opacity: 0.5 },
  adjustBtnDebit: { backgroundColor: Colors.error[600] },
  adjustBtnText: { fontFamily: FontFamily.semibold, fontSize: 16, color: Colors.neutral[0] },
});
