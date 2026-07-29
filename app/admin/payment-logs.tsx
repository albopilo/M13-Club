import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
  FlatList,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { ArrowLeft, Receipt, Store, TrendingDown, Calendar } from 'lucide-react-native';
import { supabase } from '@/lib/supabase';
import { Colors, FontFamily, BorderRadius, Shadows, Spacing } from '@/constants/theme';

interface PaymentLog {
  id: string;
  amount: number;
  member_name: string;
  member_number: string;
  branch_name: string;
  description: string;
  balance_before: number;
  balance_after: number;
  created_at: string;
}

export default function AdminPaymentLogsScreen() {
  const [logs, setLogs] = useState<PaymentLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = useCallback(async () => {
    const { data, error } = await supabase.rpc('get_payment_logs', { p_limit: 200, p_offset: 0 });
    if (!error && data) {
      setLogs(data as PaymentLog[]);
    }
    setLoading(false);
  }, []);

  useFocusEffect(useCallback(() => { fetchLogs(); }, [fetchLogs]));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  };

  const formatDate = (d: string) => new Date(d).toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
  const formatTime = (d: string) => new Date(d).toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <ArrowLeft size={22} color={Colors.neutral[700]} strokeWidth={2} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.pageTitle}>Payment Logs</Text>
          <Text style={styles.pageSubtitle}>All member payment transactions</Text>
        </View>
      </View>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary[600]} style={{ marginTop: Spacing.xl }} />
      ) : logs.length === 0 ? (
        <View style={styles.emptyState}>
          <Receipt size={40} color={Colors.neutral[300]} strokeWidth={1.5} />
          <Text style={styles.emptyText}>No payment logs yet</Text>
          <Text style={styles.emptySubtext}>Payment transactions will appear here</Text>
        </View>
      ) : (
        <FlatList
          data={logs}
          keyExtractor={(item) => item.id}
          scrollEnabled={false}
          renderItem={({ item }) => (
            <View style={styles.logCard}>
              <View style={[styles.logIcon, { backgroundColor: Colors.error[50] }]}>
                <TrendingDown size={18} color={Colors.error[600]} strokeWidth={2} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.logMember}>{item.member_name}</Text>
                <Text style={styles.logMemberNum}>{item.member_number}</Text>
                <View style={styles.logMeta}>
                  <View style={styles.logMetaItem}>
                    <Store size={12} color={Colors.neutral[400]} strokeWidth={2} />
                    <Text style={styles.logMetaText}>{item.branch_name}</Text>
                  </View>
                  <View style={styles.logMetaItem}>
                    <Calendar size={12} color={Colors.neutral[400]} strokeWidth={2} />
                    <Text style={styles.logMetaText}>{formatDate(item.created_at)} · {formatTime(item.created_at)}</Text>
                  </View>
                </View>
              </View>
              <View style={styles.logAmountCol}>
                <Text style={styles.logAmount}>- MC {Math.round(Number(item.amount))}</Text>
                <Text style={styles.logBalance}>Bal: MC {Math.round(Number(item.balance_after))}</Text>
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
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyText: { fontFamily: FontFamily.medium, fontSize: 15, color: Colors.neutral[400] },
  emptySubtext: { fontFamily: FontFamily.regular, fontSize: 13, color: Colors.neutral[400] },
  logCard: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md, backgroundColor: Colors.neutral[0], borderRadius: BorderRadius.lg, padding: Spacing.md, marginBottom: Spacing.sm, ...Shadows.sm },
  logIcon: { width: 40, height: 40, borderRadius: BorderRadius.full, alignItems: 'center', justifyContent: 'center' },
  logMember: { fontFamily: FontFamily.semibold, fontSize: 14, color: Colors.neutral[900], marginBottom: 2 },
  logMemberNum: { fontFamily: FontFamily.regular, fontSize: 12, color: Colors.neutral[500], marginBottom: 6 },
  logMeta: { gap: 4 },
  logMetaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  logMetaText: { fontFamily: FontFamily.regular, fontSize: 11, color: Colors.neutral[500] },
  logAmountCol: { alignItems: 'flex-end' },
  logAmount: { fontFamily: FontFamily.bold, fontSize: 15, color: Colors.error[700], marginBottom: 2 },
  logBalance: { fontFamily: FontFamily.regular, fontSize: 11, color: Colors.neutral[400] },
});
