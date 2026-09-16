import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, TextInput, Modal, ActivityIndicator, FlatList,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, Ticket, X, Check, Calendar, Sparkles } from 'lucide-react-native';
import { supabase, Voucher } from '@/lib/supabase';
import { Colors, FontFamily, BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';

export default function AdminVouchersScreen() {
  const { t } = useLanguage();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ code: '', description: '', value: '', limit: '1', expires: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchVouchers = useCallback(async () => {
    const { data } = await supabase.from('vouchers').select('*').order('created_at', { ascending: false });
    if (data) setVouchers(data as Voucher[]);
  }, []);

  useFocusEffect(useCallback(() => { fetchVouchers(); }, [fetchVouchers]));

  const onRefresh = async () => { setRefreshing(true); await fetchVouchers(); setRefreshing(false); };

  const handleCreate = async () => {
    if (!form.code.trim() || !form.description.trim() || !form.value) {
      setError(t('adminVouchers.errorFields'));
      return;
    }
    setCreating(true);
    setError(null);
    const { data, error: rpcError } = await supabase.rpc('admin_create_voucher', {
      p_code: form.code.trim().toUpperCase(),
      p_description: form.description.trim(),
      p_value: parseFloat(form.value),
      p_redemption_limit: parseInt(form.limit) || 1,
      p_expires_at: form.expires ? new Date(form.expires).toISOString() : null,
    });
    setCreating(false);
    if (rpcError) { setError(rpcError.message); return; }
    const r = data as { success: boolean; error?: string };
    if (!r.success) { setError(r.error || 'Failed'); return; }
    setShowCreate(false);
    setForm({ code: '', description: '', value: '', limit: '1', expires: '' });
    fetchVouchers();
  };

  const toggleActive = async (v: Voucher) => {
    await supabase.from('vouchers').update({ is_active: !v.is_active }).eq('id', v.id);
    fetchVouchers();
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.neutral[0]} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('adminVouchers.title')}</Text>
        <TouchableOpacity onPress={() => { setShowCreate(true); setError(null); }} style={styles.addBtn}>
          <Plus size={22} color={Colors.neutral[0]} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={vouchers}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: Spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.md }} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <Ticket size={32} color={Colors.neutral[300]} strokeWidth={1.5} />
            <Text style={styles.emptyText}>{t('adminVouchers.none')}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.voucherCard}>
            <LinearGradient colors={[Colors.accent[500], Colors.accent[700]]} style={styles.voucherLeft}>
              <Sparkles size={18} color={Colors.neutral[0]} strokeWidth={2} />
              <Text style={styles.voucherValue}>MC {Math.round(Number(item.value))}</Text>
            </LinearGradient>
            <View style={styles.voucherRight}>
              <View style={styles.voucherTopRow}>
                <Text style={styles.voucherCode}>{item.code}</Text>
                <TouchableOpacity
                  style={[styles.toggle, item.is_active ? styles.toggleActive : styles.toggleInactive]}
                  onPress={() => toggleActive(item)}
                >
                  <Text style={[styles.toggleText, item.is_active ? styles.toggleTextActive : styles.toggleTextInactive]}>
                    {item.is_active ? t('adminVouchers.active') : t('adminVouchers.inactive')}
                  </Text>
                </TouchableOpacity>
              </View>
              <Text style={styles.voucherDesc}>{item.description}</Text>
              <View style={styles.voucherMeta}>
                <Text style={styles.metaText}>{t('adminVouchers.limit', { limit: item.redemption_limit })}</Text>
                {item.expires_at && (
                  <View style={styles.metaItem}>
                    <Calendar size={12} color={Colors.neutral[400]} strokeWidth={2} />
                    <Text style={styles.metaText}>{formatDate(item.expires_at)}</Text>
                  </View>
                )}
              </View>
            </View>
          </View>
        )}
      />

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>{t('adminVouchers.create')}</Text>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <X size={24} color={Colors.neutral[500]} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {error && <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View>}

            <FieldInput label={t('adminVouchers.code')} value={form.code} onChange={(v) => setForm({ ...form, code: v })} placeholder={t('adminVouchers.codePlaceholder')} autoCapitalize="characters" />
            <FieldInput label={t('adminVouchers.description')} value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder={t('adminVouchers.descPlaceholder')} />
            <FieldInput label={t('adminVouchers.value')} value={form.value} onChange={(v) => setForm({ ...form, value: v })} placeholder={t('adminVouchers.valuePlaceholder')} keyboardType="numeric" />
            <FieldInput label={t('adminVouchers.redemptionLimit')} value={form.limit} onChange={(v) => setForm({ ...form, limit: v })} placeholder={t('adminVouchers.limitPlaceholder')} keyboardType="numeric" />
            <FieldInput label={t('adminVouchers.expiry')} value={form.expires} onChange={(v) => setForm({ ...form, expires: v })} placeholder={t('adminVouchers.expiryPlaceholder')} />

            <TouchableOpacity style={[styles.createBtn, creating && styles.createBtnDisabled]} onPress={handleCreate} disabled={creating} activeOpacity={0.85}>
              {creating ? <ActivityIndicator color={Colors.neutral[0]} /> : <Text style={styles.createBtnText}>{t('adminVouchers.createBtn')}</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function FieldInput({ label, value, onChange, placeholder, keyboardType, autoCapitalize }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string;
  keyboardType?: 'default' | 'numeric'; autoCapitalize?: 'none' | 'characters';
}) {
  return (
    <View style={{ marginBottom: Spacing.md }}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <TextInput
        style={styles.fieldInput}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={Colors.neutral[400]}
        keyboardType={keyboardType}
        autoCapitalize={autoCapitalize}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral[50] },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    backgroundColor: Colors.primary[900], paddingTop: Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: 20, color: Colors.neutral[0] },
  addBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyText: { fontFamily: FontFamily.regular, fontSize: 14, color: Colors.neutral[400] },
  voucherCard: { flexDirection: 'row', backgroundColor: Colors.neutral[0], borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadows.sm },
  voucherLeft: { width: 90, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: Spacing.md },
  voucherValue: { fontFamily: FontFamily.bold, fontSize: 18, color: Colors.neutral[0] },
  voucherRight: { flex: 1, padding: Spacing.md },
  voucherTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  voucherCode: { fontFamily: FontFamily.bold, fontSize: 16, color: Colors.neutral[900] },
  toggle: { borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
  toggleActive: { backgroundColor: Colors.success[50] },
  toggleInactive: { backgroundColor: Colors.neutral[100] },
  toggleText: { fontFamily: FontFamily.semibold, fontSize: 11 },
  toggleTextActive: { color: Colors.success[700] },
  toggleTextInactive: { color: Colors.neutral[500] },
  voucherDesc: { fontFamily: FontFamily.regular, fontSize: 13, color: Colors.neutral[500], marginBottom: Spacing.sm },
  voucherMeta: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: FontFamily.regular, fontSize: 12, color: Colors.neutral[400] },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  modalContent: { backgroundColor: Colors.neutral[0], borderRadius: BorderRadius.xl, padding: Spacing.lg, width: '100%', maxWidth: 440, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontFamily: FontFamily.bold, fontSize: 20, color: Colors.neutral[900] },
  errorBanner: { backgroundColor: Colors.error[50], borderWidth: 1, borderColor: Colors.error[200], borderRadius: BorderRadius.md, padding: 12, marginBottom: Spacing.md },
  errorText: { fontFamily: FontFamily.regular, fontSize: 13, color: Colors.error[700] },
  fieldLabel: { fontFamily: FontFamily.medium, fontSize: 13, color: Colors.neutral[700], marginBottom: 6 },
  fieldInput: { borderWidth: 1.5, borderColor: Colors.neutral[200], borderRadius: BorderRadius.md, paddingHorizontal: 14, height: 48, fontFamily: FontFamily.regular, fontSize: 15, color: Colors.neutral[900] },
  createBtn: { backgroundColor: Colors.primary[700], borderRadius: BorderRadius.md, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm, ...Shadows.md },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { fontFamily: FontFamily.semibold, fontSize: 16, color: Colors.neutral[0] },
});
