import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  FlatList,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Store, ArrowLeft, Plus, Edit3, Trash2, Check, X, MapPin } from 'lucide-react-native';
import { supabase, Branch } from '@/lib/supabase';
import { Colors, FontFamily, BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';

export default function AdminBranchesScreen() {
  const { t } = useLanguage();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [editing, setEditing] = useState<Branch | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', address: '' });
  const [saving, setSaving] = useState(false);

  const fetchBranches = useCallback(async () => {
    const { data, error } = await supabase.from('branches').select('*').order('created_at', { ascending: false });
    if (!error && data) setBranches(data as Branch[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchBranches(); }, [fetchBranches]));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchBranches();
    setRefreshing(false);
  };

  const handleSave = async () => {
    if (!form.name.trim()) {
      Alert.alert(t('adminBranches.error'), t('adminBranches.nameRequired'));
      return;
    }
    setSaving(true);
    if (editing) {
      const { error } = await supabase
        .from('branches')
        .update({ name: form.name.trim(), address: form.address.trim() || null, updated_at: new Date().toISOString() })
        .eq('id', editing.id);
      if (error) Alert.alert(t('adminBranches.error'), error.message);
      else { setShowForm(false); setEditing(null); fetchBranches(); }
    } else {
      const { error } = await supabase
        .from('branches')
        .insert({ name: form.name.trim(), address: form.address.trim() || null });
      if (error) Alert.alert(t('adminBranches.error'), error.message);
      else { setShowForm(false); fetchBranches(); }
    }
    setSaving(false);
  };

  const handleDelete = (branch: Branch) => {
    Alert.alert(t('adminBranches.delete'), t('adminBranches.deleteConfirm', { name: branch.name }), [
      { text: t('adminBranches.cancel'), style: 'cancel' },
      {
        text: t('adminBranches.deleteBtn'), style: 'destructive', onPress: async () => {
          const { error } = await supabase.from('branches').update({ is_active: false }).eq('id', branch.id);
          if (error) Alert.alert(t('adminBranches.error'), error.message);
          else fetchBranches();
        }
      },
    ]);
  };

  const openAdd = () => { setEditing(null); setForm({ name: '', address: '' }); setShowForm(true); };
  const openEdit = (b: Branch) => { setEditing(b); setForm({ name: b.name, address: b.address || '' }); setShowForm(true); };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.replace('/(tabs)/admin')} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.neutral[700]} strokeWidth={2} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>{t('adminBranches.title')}</Text>
          <Text style={styles.pageSubtitle}>{t('adminBranches.subtitle')}</Text>
        </View>
        <TouchableOpacity style={styles.addBtn} onPress={openAdd}>
          <Plus size={22} color={Colors.primary[700]} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {showForm && (
        <View style={styles.formCard}>
          <Text style={styles.formTitle}>{editing ? t('adminBranches.edit') : t('adminBranches.new')}</Text>
          <Text style={styles.fieldLabel}>{t('adminBranches.name')}</Text>
          <TextInput
            style={styles.fieldInput}
            placeholder={t('adminBranches.namePlaceholder')}
            placeholderTextColor={Colors.neutral[400]}
            value={form.name}
            onChangeText={(v) => setForm({ ...form, name: v })}
          />
          <Text style={styles.fieldLabel}>{t('adminBranches.address')}</Text>
          <TextInput
            style={[styles.fieldInput, { height: 70, textAlignVertical: 'top' }]}
            placeholder={t('adminBranches.addressPlaceholder')}
            placeholderTextColor={Colors.neutral[400]}
            value={form.address}
            onChangeText={(v) => setForm({ ...form, address: v })}
            multiline
          />
          <View style={styles.formActions}>
            <TouchableOpacity
              style={styles.cancelBtn}
              onPress={() => { setShowForm(false); setEditing(null); }}
            >
              <X size={18} color={Colors.neutral[500]} strokeWidth={2} />
              <Text style={styles.cancelBtnText}>{t('adminBranches.cancel')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.saveBtn}
              onPress={handleSave}
              disabled={saving}
            >
              {saving ? <ActivityIndicator size={18} color={Colors.neutral[0]} /> : <Check size={18} color={Colors.neutral[0]} strokeWidth={2} />}
              <Text style={styles.saveBtnText}>{editing ? t('adminBranches.update') : t('adminBranches.create')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary[600]} style={{ marginTop: Spacing.xl }} />
      ) : branches.length === 0 ? (
        <View style={styles.emptyState}>
          <Store size={40} color={Colors.neutral[300]} strokeWidth={1.5} />
          <Text style={styles.emptyText}>{t('adminBranches.none')}</Text>
          <Text style={styles.emptySubtext}>{t('adminBranches.noneDesc')}</Text>
        </View>
      ) : (
        <FlatList
          data={branches}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.branchCard}>
              <View style={styles.branchIcon}>
                <Store size={22} color={Colors.primary[700]} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.branchName}>{item.name}</Text>
                {item.address ? (
                  <View style={styles.branchAddrRow}>
                    <MapPin size={12} color={Colors.neutral[400]} strokeWidth={2} />
                    <Text style={styles.branchAddr}>{item.address}</Text>
                  </View>
                ) : null}
                <View style={[styles.statusBadge, item.is_active ? styles.statusActive : styles.statusInactive]}>
                  <Text style={[styles.statusText, item.is_active ? styles.statusTextActive : styles.statusTextInactive]}>
                    {item.is_active ? t('adminBranches.active') : t('adminBranches.inactive')}
                  </Text>
                </View>
              </View>
              <View style={styles.branchActions}>
                <TouchableOpacity onPress={() => openEdit(item)} style={styles.editAction}>
                  <Edit3 size={18} color={Colors.neutral[600]} strokeWidth={2} />
                </TouchableOpacity>
                {item.is_active && (
                  <TouchableOpacity onPress={() => handleDelete(item)} style={styles.deleteAction}>
                    <Trash2 size={18} color={Colors.error[500]} strokeWidth={2} />
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        />
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral[50] },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, marginBottom: Spacing.lg },
  backBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.neutral[0], alignItems: 'center', justifyContent: 'center', ...Shadows.sm },
  pageTitle: { fontFamily: FontFamily.bold, fontSize: 24, color: Colors.neutral[900] },
  pageSubtitle: { fontFamily: FontFamily.regular, fontSize: 13, color: Colors.neutral[500] },
  addBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: Colors.primary[50], alignItems: 'center', justifyContent: 'center' },
  formCard: { backgroundColor: Colors.neutral[0], borderRadius: BorderRadius.lg, padding: Spacing.lg, marginBottom: Spacing.lg, ...Shadows.md },
  formTitle: { fontFamily: FontFamily.bold, fontSize: 18, color: Colors.neutral[900], marginBottom: Spacing.md },
  fieldLabel: { fontFamily: FontFamily.medium, fontSize: 14, color: Colors.neutral[700], marginBottom: 6, marginTop: Spacing.sm },
  fieldInput: { borderWidth: 1.5, borderColor: Colors.neutral[200], borderRadius: BorderRadius.md, paddingHorizontal: 14, height: 48, fontFamily: FontFamily.regular, fontSize: 15, color: Colors.neutral[900] },
  formActions: { flexDirection: 'row', gap: Spacing.sm, marginTop: Spacing.md },
  cancelBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: BorderRadius.md, backgroundColor: Colors.neutral[100] },
  cancelBtnText: { fontFamily: FontFamily.medium, fontSize: 14, color: Colors.neutral[600] },
  saveBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 48, borderRadius: BorderRadius.md, backgroundColor: Colors.primary[700] },
  saveBtnText: { fontFamily: FontFamily.semibold, fontSize: 14, color: Colors.neutral[0] },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyText: { fontFamily: FontFamily.medium, fontSize: 15, color: Colors.neutral[400] },
  emptySubtext: { fontFamily: FontFamily.regular, fontSize: 13, color: Colors.neutral[400] },
  branchCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.neutral[0], borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, ...Shadows.sm },
  branchIcon: { width: 44, height: 44, borderRadius: BorderRadius.md, backgroundColor: Colors.primary[50], alignItems: 'center', justifyContent: 'center' },
  branchName: { fontFamily: FontFamily.semibold, fontSize: 15, color: Colors.neutral[900], marginBottom: 4 },
  branchAddrRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 6 },
  branchAddr: { fontFamily: FontFamily.regular, fontSize: 12, color: Colors.neutral[500] },
  statusBadge: { alignSelf: 'flex-start', borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 2 },
  statusActive: { backgroundColor: Colors.success[50] },
  statusInactive: { backgroundColor: Colors.neutral[100] },
  statusText: { fontFamily: FontFamily.semibold, fontSize: 11 },
  statusTextActive: { color: Colors.success[700] },
  statusTextInactive: { color: Colors.neutral[500] },
  branchActions: { flexDirection: 'row', gap: Spacing.sm },
  editAction: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.neutral[50], alignItems: 'center', justifyContent: 'center' },
  deleteAction: { width: 36, height: 36, borderRadius: 18, backgroundColor: Colors.error[50], alignItems: 'center', justifyContent: 'center' },
});
