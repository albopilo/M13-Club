import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, TextInput, Modal, ActivityIndicator, FlatList,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, Plus, Ticket, X, Check, Calendar, Sparkles, Package } from 'lucide-react-native';
import { supabase, Voucher } from '@/lib/supabase';
import { Colors, FontFamily, BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';
import { LinearGradient } from 'expo-linear-gradient';

export default function AdminVouchersScreen() {
  const { t } = useLanguage();
  const [vouchers, setVouchers] = useState<Voucher[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ codePrefix: '', description: '', value: '', quantity: '10', limit: '1', expires: '' });
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const fetchVouchers = useCallback(async () => {
    const { data } = await supabase.from('vouchers').select('*').order('created_at', { ascending: false });
    if (data) setVouchers(data as Voucher[]);
  }, []);

  useFocusEffect(useCallback(() => { fetchVouchers(); }, [fetchVouchers]));

  const onRefresh = async () => { setRefreshing(true); await fetchVouchers(); setRefreshing(false); };

  const handleCreate = async () => {
    if (!form.codePrefix.trim() || !form.description.trim() || !form.value) {
      setError(t('adminVouchers.errorFields'));
      return;
    }
    const numericValue = parseFloat(form.value);
    if (isNaN(numericValue) || numericValue <= 0) {
      setError(t('adminVouchers.errorInvalidValue'));
      return;
    }
    let expiresAt: string | null = null;
    if (form.expires.trim()) {
      const parsed = new Date(form.expires.trim());
      if (isNaN(parsed.getTime())) {
        setError(t('adminVouchers.errorInvalidDate'));
        return;
      }
      expiresAt = parsed.toISOString();
    }
    setCreating(true);
    setError(null);
    setSuccessMsg(null);
    try {
      const { data, error: rpcError } = await supabase.rpc('admin_bulk_create_vouchers', {
        p_code_prefix: form.codePrefix.trim().toUpperCase(),
        p_description: form.description.trim(),
        p_value: numericValue,
        p_quantity: parseInt(form.quantity) || 1,
        p_redemption_limit: parseInt(form.limit) || 1,
        p_expires_at: expiresAt,
      });
      if (rpcError) { setError(rpcError.message); return; }
      const r = data as { success: boolean; error?: string; created_count?: number };
      if (!r.success) { setError(r.error || 'Failed'); return; }
      setShowCreate(false);
      setForm({ codePrefix: '', description: '', value: '', quantity: '10', limit: '1', expires: '' });
      setSuccessMsg(t('adminVouchers.createdCount', { count: r.created_count || 0 }));
      fetchVouchers();
    } catch (e) {
      setError(e instanceof Error ? e.message : t('adminVouchers.errorUnexpected'));
    } finally {
      setCreating(false);
    }
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });

  const getVoucherDisplayStatus = (item: Voucher) => {
    if (item.status === 'sold') return 'sold';
    if (!item.is_active) return 'inactive';
    if (item.expires_at && new Date(item.expires_at) <= new Date()) return 'expired';
    return 'available';
  };

  const getStatusStyle = (display: string) => {
    switch (display) {
      case 'sold':
        return { bg: Colors.neutral[100], text: Colors.neutral[500], label: t('adminVouchers.sold') };
      case 'expired':
        return { bg: Colors.warning[50], text: Colors.warning[700], label: t('adminVouchers.expired') };
      case 'inactive':
        return { bg: Colors.neutral[100], text: Colors.neutral[500], label: t('adminVouchers.inactive') };
      default:
        return { bg: Colors.success[50], text: Colors.success[700], label: t('adminVouchers.available') };
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/admin')} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.neutral[0]} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('adminVouchers.title')}</Text>
        <TouchableOpacity onPress={() => { setShowCreate(true); setError(null); setSuccessMsg(null); }} style={styles.addBtn}>
          <Plus size={22} color={Colors.neutral[0]} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {successMsg && (
        <View style={styles.successBanner}>
          <Check size={16} color={Colors.success[700]} strokeWidth={2} />
          <Text style={styles.successText}>{successMsg}</Text>
          <TouchableOpacity onPress={() => setSuccessMsg(null)} style={styles.bannerClose}>
            <X size={16} color={Colors.success[700]} strokeWidth={2} />
          </TouchableOpacity>
        </View>
      )}

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
        renderItem={({ item }) => {
          const display = getVoucherDisplayStatus(item);
          const st = getStatusStyle(display);
          const isAvailable = display === 'available';
          return (
            <View style={styles.voucherCard}>
              <LinearGradient
                colors={isAvailable ? [Colors.accent[500], Colors.accent[700]] : [Colors.neutral[400], Colors.neutral[600]]}
                style={styles.voucherLeft}
              >
                {isAvailable ? <Sparkles size={18} color={Colors.neutral[0]} strokeWidth={2} /> : <Package size={18} color={Colors.neutral[0]} strokeWidth={2} />}
                <Text style={styles.voucherValue}>MC {Math.round(Number(item.value))}</Text>
              </LinearGradient>
              <View style={styles.voucherRight}>
                <View style={styles.voucherTopRow}>
                  <Text style={styles.voucherCode}>{item.code}</Text>
                  <View style={[styles.statusBadge, { backgroundColor: st.bg }]}>
                    <Text style={[styles.statusBadgeText, { color: st.text }]}>{st.label}</Text>
                  </View>
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
          );
        }}
      />

      <Modal visible={showCreate} transparent animationType="fade" onRequestClose={() => setShowCreate(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>{t('adminVouchers.bulkCreate')}</Text>
                <Text style={styles.modalSubtitle}>{t('adminVouchers.bulkCreateDesc')}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowCreate(false)}>
                <X size={24} color={Colors.neutral[500]} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {error && <View style={styles.errorBanner}><Text style={styles.errorText}>{error}</Text></View>}

            <ScrollView showsVerticalScrollIndicator={false}>
              <FieldInput label={t('adminVouchers.code')} value={form.codePrefix} onChange={(v) => setForm({ ...form, codePrefix: v })} placeholder={t('adminVouchers.codePlaceholder')} autoCapitalize="characters" />
              <FieldInput label={t('adminVouchers.description')} value={form.description} onChange={(v) => setForm({ ...form, description: v })} placeholder={t('adminVouchers.descPlaceholder')} />
              <FieldInput label={t('adminVouchers.value')} value={form.value} onChange={(v) => setForm({ ...form, value: v })} placeholder={t('adminVouchers.valuePlaceholder')} keyboardType="numeric" />
              <FieldInput label={t('adminVouchers.quantity')} value={form.quantity} onChange={(v) => setForm({ ...form, quantity: v })} placeholder={t('adminVouchers.quantityPlaceholder')} keyboardType="numeric" />
              <Text style={styles.fieldHint}>{t('adminVouchers.quantityDesc')}</Text>
              <FieldInput label={t('adminVouchers.redemptionLimit')} value={form.limit} onChange={(v) => setForm({ ...form, limit: v })} placeholder={t('adminVouchers.limitPlaceholder')} keyboardType="numeric" />
              <FieldInput label={t('adminVouchers.expiry')} value={form.expires} onChange={(v) => setForm({ ...form, expires: v })} placeholder={t('adminVouchers.expiryPlaceholder')} />
            </ScrollView>

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
  successBanner: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: Colors.success[50], paddingHorizontal: Spacing.lg, paddingVertical: Spacing.sm, borderBottomWidth: 1, borderBottomColor: Colors.success[200] },
  successText: { flex: 1, fontFamily: FontFamily.semibold, fontSize: 13, color: Colors.success[700] },
  bannerClose: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center' },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyText: { fontFamily: FontFamily.regular, fontSize: 14, color: Colors.neutral[400] },
  voucherCard: { flexDirection: 'row', backgroundColor: Colors.neutral[0], borderRadius: BorderRadius.lg, overflow: 'hidden', ...Shadows.sm },
  voucherLeft: { width: 90, alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: Spacing.md },
  voucherValue: { fontFamily: FontFamily.bold, fontSize: 18, color: Colors.neutral[0] },
  voucherRight: { flex: 1, padding: Spacing.md },
  voucherTopRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 },
  voucherCode: { fontFamily: FontFamily.bold, fontSize: 16, color: Colors.neutral[900] },
  statusBadge: { borderRadius: BorderRadius.full, paddingHorizontal: 10, paddingVertical: 4 },
  statusBadgeText: { fontFamily: FontFamily.semibold, fontSize: 11 },
  voucherDesc: { fontFamily: FontFamily.regular, fontSize: 13, color: Colors.neutral[500], marginBottom: Spacing.sm },
  voucherMeta: { flexDirection: 'row', gap: Spacing.md, alignItems: 'center' },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { fontFamily: FontFamily.regular, fontSize: 12, color: Colors.neutral[400] },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  modalContent: { backgroundColor: Colors.neutral[0], borderRadius: BorderRadius.xl, padding: Spacing.lg, width: '100%', maxWidth: 440, maxHeight: '90%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: Spacing.lg },
  modalTitle: { fontFamily: FontFamily.bold, fontSize: 20, color: Colors.neutral[900] },
  modalSubtitle: { fontFamily: FontFamily.regular, fontSize: 13, color: Colors.neutral[500], marginTop: 4 },
  errorBanner: { backgroundColor: Colors.error[50], borderWidth: 1, borderColor: Colors.error[200], borderRadius: BorderRadius.md, padding: 12, marginBottom: Spacing.md },
  errorText: { fontFamily: FontFamily.regular, fontSize: 13, color: Colors.error[700] },
  fieldLabel: { fontFamily: FontFamily.medium, fontSize: 13, color: Colors.neutral[700], marginBottom: 6 },
  fieldInput: { borderWidth: 1.5, borderColor: Colors.neutral[200], borderRadius: BorderRadius.md, paddingHorizontal: 14, height: 48, fontFamily: FontFamily.regular, fontSize: 15, color: Colors.neutral[900] },
  fieldHint: { fontFamily: FontFamily.regular, fontSize: 12, color: Colors.neutral[400], marginTop: -Spacing.xs, marginBottom: Spacing.md, paddingHorizontal: 2 },
  createBtn: { backgroundColor: Colors.primary[700], borderRadius: BorderRadius.md, height: 52, alignItems: 'center', justifyContent: 'center', marginTop: Spacing.sm, ...Shadows.md },
  createBtnDisabled: { opacity: 0.5 },
  createBtnText: { fontFamily: FontFamily.semibold, fontSize: 16, color: Colors.neutral[0] },
});
