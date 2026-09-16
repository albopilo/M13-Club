import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, TextInput, TouchableOpacity, FlatList, Modal, ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { Search, ArrowLeft, Users, Mail, Phone, Shield, Wallet, X, Check } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { supabase, Member, MemberRole } from '@/lib/supabase';
import { isSuperAdminRole } from '@/lib/supabase';
import { Colors, FontFamily, BorderRadius, Shadows, Spacing } from '@/constants/theme';

const ROLES: MemberRole[] = ['member', 'admin', 'super_admin', 'staff', 'finance', 'manager', 'support'];

export default function AdminMembersScreen() {
  const { member: currentMember } = useAuth();
  const { t } = useLanguage();
  const [members, setMembers] = useState<Member[]>([]);

  const ROLE_LABELS: Record<string, string> = {
    member: t('profile.role.member'), admin: t('adminMembers.roleAdmin'), super_admin: t('adminMembers.roleSuperAdmin'),
    staff: t('profile.role.staff'), finance: t('profile.role.finance'), manager: t('profile.role.manager'), support: t('profile.role.support'),
  };
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selected, setSelected] = useState<Member | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchMembers = useCallback(async () => {
    const { data, error } = await supabase
      .from('members')
      .select('*')
      .order('joined_at', { ascending: false });
    if (!error && data) setMembers(data as Member[]);
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchMembers(); }, [fetchMembers]));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMembers();
    setRefreshing(false);
  };

  const filtered = members.filter(m =>
    m.full_name.toLowerCase().includes(search.toLowerCase()) ||
    m.email.toLowerCase().includes(search.toLowerCase()) ||
    m.member_number.toLowerCase().includes(search.toLowerCase())
  );

  const updateRole = async (memberId: string, role: string) => {
    setActionLoading(true);
    setActionError(null);
    const { data, error } = await supabase.rpc('admin_update_member_role', {
      p_member_id: memberId, p_role: role,
    });
    setActionLoading(false);
    if (error) { setActionError(error.message); return; }
    const r = data as { success: boolean; error?: string };
    if (!r.success) { setActionError(r.error || 'Failed'); return; }
    setSelected(null);
    fetchMembers();
  };

  const updateStatus = async (memberId: string, status: string) => {
    setActionLoading(true);
    setActionError(null);
    const { data, error } = await supabase.rpc('admin_update_member_status', {
      p_member_id: memberId, p_status: status,
    });
    setActionLoading(false);
    if (error) { setActionError(error.message); return; }
    const r = data as { success: boolean; error?: string };
    if (!r.success) { setActionError(r.error || 'Failed'); return; }
    setSelected(null);
    fetchMembers();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.neutral[0]} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('adminMembers.title')}</Text>
      </View>

      <View style={styles.searchBar}>
        <Search size={18} color={Colors.neutral[400]} strokeWidth={2} />
        <TextInput
          style={styles.searchInput}
          placeholder={t('adminMembers.search')}
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
            <Users size={32} color={Colors.neutral[300]} strokeWidth={1.5} />
            <Text style={styles.emptyText}>{loading ? t('adminMembers.loading') : t('adminMembers.none')}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <TouchableOpacity style={styles.memberCard} onPress={() => { setSelected(item); setActionError(null); }} activeOpacity={0.85}>
            <View style={[styles.memberAvatar, { backgroundColor: item.status === 'active' ? Colors.primary[100] : Colors.neutral[200] }]}>
              <Text style={styles.memberAvatarText}>{item.full_name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{item.full_name}</Text>
              <Text style={styles.memberEmail}>{item.email}</Text>
              <View style={styles.memberMeta}>
                <Text style={styles.memberNumber}>{item.member_number}</Text>
                <View style={[styles.roleTag, { backgroundColor: getRoleColor(item.role) + '20' }]}>
                  <Text style={[styles.roleTagText, { color: getRoleColor(item.role) }]}>{ROLE_LABELS[item.role]}</Text>
                </View>
                {item.status !== 'active' && (
                  <View style={[styles.roleTag, { backgroundColor: Colors.error[50] }]}>
                    <Text style={[styles.roleTagText, { color: Colors.error[600] }]}>{item.status.toUpperCase()}</Text>
                  </View>
                )}
              </View>
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
                  <Text style={styles.modalTitle}>{t('adminMembers.details')}</Text>
                  <TouchableOpacity onPress={() => setSelected(null)}>
                    <X size={24} color={Colors.neutral[500]} strokeWidth={2} />
                  </TouchableOpacity>
                </View>

                <View style={styles.detailSection}>
                  <DetailRow icon={Users} label={t('adminMembers.name')} value={selected.full_name} />
                  <DetailRow icon={Mail} label={t('adminMembers.email')} value={selected.email} />
                  <DetailRow icon={Phone} label={t('adminMembers.phone')} value={selected.phone || t('profile.notSet')} />
                  <DetailRow icon={Shield} label={t('adminMembers.role')} value={ROLE_LABELS[selected.role]} />
                  <DetailRow icon={Shield} label={t('adminMembers.status')} value={selected.status} />
                  <DetailRow icon={Users} label={t('adminMembers.memberId')} value={selected.member_number} />
                  <DetailRow icon={Wallet} label={t('adminMembers.joined')} value={new Date(selected.joined_at).toLocaleDateString()} />
                </View>

                {actionError && (
                  <View style={styles.errorBanner}>
                    <Text style={styles.errorText}>{actionError}</Text>
                  </View>
                )}

                {isSuperAdminRole(currentMember?.role) && selected.user_id !== currentMember?.user_id && (
                  <View style={styles.actionSection}>
                    <Text style={styles.actionLabel}>{t('adminMembers.changeRole')}</Text>
                    <View style={styles.roleOptions}>
                      {ROLES.map(r => (
                        <TouchableOpacity
                          key={r}
                          style={[styles.roleOption, selected.role === r && styles.roleOptionActive]}
                          onPress={() => updateRole(selected.id, r)}
                          disabled={actionLoading}
                        >
                          <Text style={[styles.roleOptionText, selected.role === r && styles.roleOptionTextActive]}>
                            {ROLE_LABELS[r]}
                          </Text>
                        </TouchableOpacity>
                      ))}
                    </View>

                    <Text style={[styles.actionLabel, { marginTop: Spacing.md }]}>{t('adminMembers.changeStatus')}</Text>
                    <View style={styles.statusOptions}>
                      <TouchableOpacity
                        style={[styles.statusBtn, { backgroundColor: Colors.success[50] }]}
                        onPress={() => updateStatus(selected.id, 'active')}
                        disabled={actionLoading}
                      >
                        <Check size={16} color={Colors.success[700]} strokeWidth={2} />
                        <Text style={[styles.statusBtnText, { color: Colors.success[700] }]}>{t('adminMembers.active')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.statusBtn, { backgroundColor: Colors.warning[50] }]}
                        onPress={() => updateStatus(selected.id, 'suspended')}
                        disabled={actionLoading}
                      >
                        <Text style={[styles.statusBtnText, { color: Colors.warning[700] }]}>{t('adminMembers.suspend')}</Text>
                      </TouchableOpacity>
                      <TouchableOpacity
                        style={[styles.statusBtn, { backgroundColor: Colors.error[50] }]}
                        onPress={() => updateStatus(selected.id, 'banned')}
                        disabled={actionLoading}
                      >
                        <Text style={[styles.statusBtnText, { color: Colors.error[700] }]}>{t('adminMembers.ban')}</Text>
                      </TouchableOpacity>
                    </View>
                    {actionLoading && <ActivityIndicator color={Colors.primary[600]} style={{ marginTop: Spacing.sm }} />}
                  </View>
                )}
              </>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
}

function getRoleColor(role: string) {
  switch (role) {
    case 'super_admin': return Colors.error[600];
    case 'admin': return Colors.primary[600];
    case 'manager': return Colors.success[600];
    case 'finance': return Colors.warning[600];
    default: return Colors.neutral[500];
  }
}

function DetailRow({ icon: Icon, label, value }: { icon: typeof Mail; label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Icon size={16} color={Colors.neutral[400]} strokeWidth={2} />
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral[50] },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.primary[900], paddingTop: Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md,
  },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: 20, color: Colors.neutral[0] },
  searchBar: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.sm,
    backgroundColor: Colors.neutral[0], margin: Spacing.lg, marginBottom: 0,
    borderRadius: BorderRadius.md, paddingHorizontal: Spacing.md, height: 50, ...Shadows.sm,
  },
  searchInput: { flex: 1, fontFamily: FontFamily.regular, fontSize: 15, color: Colors.neutral[900] },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyText: { fontFamily: FontFamily.regular, fontSize: 14, color: Colors.neutral[400] },
  memberCard: {
    flexDirection: 'row', alignItems: 'center', gap: Spacing.md,
    backgroundColor: Colors.neutral[0], borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadows.sm,
  },
  memberAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  memberAvatarText: { fontFamily: FontFamily.bold, fontSize: 18, color: Colors.primary[700] },
  memberName: { fontFamily: FontFamily.semibold, fontSize: 16, color: Colors.neutral[900], marginBottom: 2 },
  memberEmail: { fontFamily: FontFamily.regular, fontSize: 13, color: Colors.neutral[500], marginBottom: 6 },
  memberMeta: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, flexWrap: 'wrap' },
  memberNumber: { fontFamily: FontFamily.regular, fontSize: 12, color: Colors.neutral[400] },
  roleTag: { borderRadius: BorderRadius.full, paddingHorizontal: 8, paddingVertical: 3 },
  roleTagText: { fontFamily: FontFamily.semibold, fontSize: 10 },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: Spacing.lg },
  modalContent: { backgroundColor: Colors.neutral[0], borderRadius: BorderRadius.xl, padding: Spacing.lg, width: '100%', maxWidth: 480, maxHeight: '85%' },
  modalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: Spacing.lg },
  modalTitle: { fontFamily: FontFamily.bold, fontSize: 20, color: Colors.neutral[900] },
  detailSection: { gap: Spacing.sm, marginBottom: Spacing.lg },
  detailRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: Colors.neutral[100] },
  detailLabel: { fontFamily: FontFamily.regular, fontSize: 13, color: Colors.neutral[400], width: 80 },
  detailValue: { flex: 1, fontFamily: FontFamily.medium, fontSize: 14, color: Colors.neutral[900] },
  actionSection: { borderTopWidth: 1, borderTopColor: Colors.neutral[100], paddingTop: Spacing.md },
  actionLabel: { fontFamily: FontFamily.semibold, fontSize: 14, color: Colors.neutral[700], marginBottom: Spacing.sm },
  roleOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  roleOption: { borderWidth: 1, borderColor: Colors.neutral[200], borderRadius: BorderRadius.sm, paddingHorizontal: 12, paddingVertical: 7 },
  roleOptionActive: { backgroundColor: Colors.primary[700], borderColor: Colors.primary[700] },
  roleOptionText: { fontFamily: FontFamily.medium, fontSize: 12, color: Colors.neutral[600] },
  roleOptionTextActive: { color: Colors.neutral[0] },
  statusOptions: { flexDirection: 'row', gap: Spacing.sm },
  statusBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: BorderRadius.md, paddingHorizontal: 12, paddingVertical: 10, flex: 1, justifyContent: 'center' },
  statusBtnText: { fontFamily: FontFamily.semibold, fontSize: 13 },
  errorBanner: { backgroundColor: Colors.error[50], borderWidth: 1, borderColor: Colors.error[200], borderRadius: BorderRadius.md, padding: 12, marginBottom: Spacing.md },
  errorText: { fontFamily: FontFamily.regular, fontSize: 13, color: Colors.error[700] },
});
