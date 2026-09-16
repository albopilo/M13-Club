import { useState, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, RefreshControl, TouchableOpacity,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { ArrowLeft, FileText, Shield } from 'lucide-react-native';
import { supabase, AuditLog } from '@/lib/supabase';
import { Colors, FontFamily, BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { useLanguage } from '@/context/LanguageContext';

export default function AdminAuditScreen() {
  const { t } = useLanguage();
  const [logs, setLogs] = useState<AuditLog[]>([]);

  const ACTION_LABELS: Record<string, string> = {
    wallet_adjustment: t('adminAudit.walletAdjustment'),
    booking_status_update: t('adminAudit.bookingUpdate'),
    voucher_create: t('adminAudit.voucherCreated'),
    member_role_update: t('adminAudit.roleChanged'),
    member_status_update: t('adminAudit.statusChanged'),
  };
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase
      .from('audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(200);
    if (data) setLogs(data as AuditLog[]);
  }, []);

  useFocusEffect(useCallback(() => { fetchLogs(); }, [fetchLogs]));

  const onRefresh = async () => { setRefreshing(true); await fetchLogs(); setRefreshing(false); };

  const formatDateTime = (d: string) => {
    const date = new Date(d);
    return date.toLocaleString('en-MY', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  };

  const getActionColor = (action: string) => {
    if (action.includes('wallet')) return Colors.warning[600];
    if (action.includes('role')) return Colors.error[600];
    if (action.includes('status')) return Colors.accent[600];
    if (action.includes('booking')) return Colors.primary[600];
    if (action.includes('voucher')) return Colors.success[600];
    return Colors.neutral[500];
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.neutral[0]} strokeWidth={2} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>{t('adminAudit.title')}</Text>
      </View>

      <FlatList
        data={logs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={{ padding: Spacing.lg }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ItemSeparatorComponent={() => <View style={{ height: Spacing.sm }} />}
        ListEmptyComponent={() => (
          <View style={styles.emptyState}>
            <FileText size={32} color={Colors.neutral[300]} strokeWidth={1.5} />
            <Text style={styles.emptyText}>{t('adminAudit.none')}</Text>
          </View>
        )}
        renderItem={({ item }) => (
          <View style={styles.logCard}>
            <View style={[styles.logIcon, { backgroundColor: getActionColor(item.action) + '20' }]}>
              <Shield size={16} color={getActionColor(item.action)} strokeWidth={2} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.logAction}>{ACTION_LABELS[item.action] || item.action}</Text>
              <Text style={styles.logTime}>{formatDateTime(item.created_at)}</Text>
              {item.details && (
                <Text style={styles.logDetails} numberOfLines={2}>
                  {JSON.stringify(item.details)}
                </Text>
              )}
            </View>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral[50] },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.primary[900], paddingTop: Spacing.lg, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.md },
  backBtn: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontFamily: FontFamily.bold, fontSize: 20, color: Colors.neutral[0] },
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyText: { fontFamily: FontFamily.regular, fontSize: 14, color: Colors.neutral[400] },
  logCard: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.md, backgroundColor: Colors.neutral[0], borderRadius: BorderRadius.lg, padding: Spacing.md, ...Shadows.sm },
  logIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  logAction: { fontFamily: FontFamily.semibold, fontSize: 14, color: Colors.neutral[900], marginBottom: 2 },
  logTime: { fontFamily: FontFamily.regular, fontSize: 12, color: Colors.neutral[400], marginBottom: 4 },
  logDetails: { fontFamily: FontFamily.regular, fontSize: 11, color: Colors.neutral[500], lineHeight: 16 },
});
