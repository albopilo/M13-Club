import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import {
  Users, Ticket, Store, FileText, TrendingUp, Wallet, Shield, ArrowRight, Receipt,
} from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { supabase } from '@/lib/supabase';
import { isAdminRole } from '@/lib/supabase';
import { Colors, FontFamily, BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface Stats {
  total_members: number;
  total_balance: number;
  total_transactions: number;
  pending_bookings: number;
  active_vouchers: number;
  total_bookings: number;
  total_credit: number;
  total_debit: number;
}

export default function AdminScreen() {
  const insets = useSafeAreaInsets();
  const { member } = useAuth();
  const { t } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchStats = useCallback(async () => {
  setLoading(true);

  const { data, error } = await supabase.rpc("get_dashboard_stats");

  if (error) {
    console.error("Dashboard RPC Error:", error);
    setLoading(false);
    return;
  }

  console.log("Dashboard Stats:", data);

  if (data) {
    setStats(data as Stats);
  }

  setLoading(false);
}, []);

  useFocusEffect(useCallback(() => { fetchStats(); }, [fetchStats]));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchStats();
    setRefreshing(false);
  };

  if (!member || !isAdminRole(member.role)) {
    return (
      <View style={styles.noAccess}>
        <Shield size={48} color={Colors.neutral[300]} strokeWidth={1.5} />
        <Text style={styles.noAccessText}>{t('admin.accessRequired')}</Text>
      </View>
    );
  }

  const menuItems = [
    { icon: Users, label: t('admin.members'), desc: t('admin.membersDesc'), color: Colors.primary, route: '/admin/members' as const },
    { icon: Ticket, label: t('admin.vouchers'), desc: t('admin.vouchersDesc'), color: Colors.accent, route: '/admin/vouchers' as const },
    { icon: Store, label: t('admin.branches'), desc: t('admin.branchesDesc'), color: Colors.success, route: '/admin/branches' as const },
    { icon: Receipt, label: t('admin.paymentLogs'), desc: t('admin.paymentLogsDesc'), color: Colors.warning, route: '/admin/payment-logs' as const },
    { icon: Wallet, label: t('admin.wallet'), desc: t('admin.walletDesc'), color: Colors.warning, route: '/admin/wallet' as const },
    { icon: FileText, label: t('admin.auditLogs'), desc: t('admin.auditLogsDesc'), color: Colors.secondary, route: '/admin/audit' as const },
  ];

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={{
    paddingBottom: 140 + insets.bottom,
}}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={[Colors.neutral[900], Colors.neutral[800]]}
        style={styles.adminHeader}
      >
        <View style={styles.adminBadge}>
          <Shield size={16} color={Colors.accent[400]} strokeWidth={2} />
          <Text style={styles.adminBadgeText}>{t('admin.panel')}</Text>
        </View>
        <Text style={styles.adminTitle}>{t('admin.dashboard')}</Text>
        <Text style={styles.adminSubtitle}>{member.full_name} · {member.role.replace('_', ' ').toUpperCase()}</Text>
      </LinearGradient>

      {loading ? (
        <ActivityIndicator size="large" color={Colors.primary[600]} style={{ marginTop: Spacing.xl }} />
      ) : (
        <>
          <View style={styles.statsGrid}>
            <StatCard label={t('admin.members')} value={stats?.total_members ?? 0} icon={Users} color={Colors.primary} />
            <StatCard label={t('admin.totalBalance')} value={`MC ${Math.round(stats?.total_balance ?? 0)}`} icon={Wallet} color={Colors.success} />
            <StatCard label={t('admin.transactions')} value={stats?.total_transactions ?? 0} icon={TrendingUp} color={Colors.accent} />
            <StatCard label={t('admin.activeVouchers')} value={stats?.active_vouchers ?? 0} icon={Ticket} color={Colors.secondary} />
          </View>

          <View style={styles.financialRow}>
            <View style={[styles.finCard, { backgroundColor: Colors.success[50] }]}>
              <TrendingUp size={20} color={Colors.success[600]} strokeWidth={2} />
              <Text style={styles.finLabel}>{t('admin.totalCredited')}</Text>
              <Text style={[styles.finAmount, { color: Colors.success[700] }]}>
                MC {Math.round(stats?.total_credit ?? 0)}
              </Text>
            </View>
            <View style={[styles.finCard, { backgroundColor: Colors.error[50] }]}>
              <TrendingUp size={20} color={Colors.error[600]} strokeWidth={2} style={{ transform: [{ rotate: '180deg' }] }} />
              <Text style={styles.finLabel}>{t('admin.totalDebited')}</Text>
              <Text style={[styles.finAmount, { color: Colors.error[700] }]}>
                MC {Math.round(stats?.total_debit ?? 0)}
              </Text>
            </View>
          </View>

          <Text style={styles.sectionTitle}>{t('admin.management')}</Text>
          <View style={styles.menuList}>
            {menuItems.map((item, i) => (
              <TouchableOpacity
                key={i}
                style={styles.menuItem}
                onPress={() => router.push(item.route)}
                activeOpacity={0.85}
              >
                <View style={[styles.menuIcon, { backgroundColor: item.color[50] }]}>
                  <item.icon size={22} color={item.color[700]} strokeWidth={2} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.menuLabel}>{item.label}</Text>
                  <Text style={styles.menuDesc}>{item.desc}</Text>
                </View>
                <ArrowRight size={20} color={Colors.neutral[300]} strokeWidth={2} />
              </TouchableOpacity>
            ))}
          </View>
        </>
      )}
    </ScrollView>
  );
}

function StatCard({ label, value, icon: Icon, color }: { label: string; value: string | number; icon: typeof Users; color: typeof Colors.primary }) {
  return (
    <View style={[styles.statCard, { borderTopColor: color[500] }]}>
      <View style={[styles.statIcon, { backgroundColor: color[50] }]}>
        <Icon size={18} color={color[700]} strokeWidth={2} />
      </View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral[50] },
  content: { paddingBottom: Spacing.xxxl },
  noAccess: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.neutral[50],
    gap: Spacing.md,
  },
  noAccessText: {
    fontFamily: FontFamily.medium,
    fontSize: 16,
    color: Colors.neutral[500],
  },
  adminHeader: {
    padding: Spacing.lg,
    paddingTop: Spacing.xl,
    borderBottomLeftRadius: BorderRadius.xl,
    borderBottomRightRadius: BorderRadius.xl,
    marginBottom: Spacing.lg,
  },
  adminBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 12,
    paddingVertical: 6,
    marginBottom: Spacing.md,
  },
  adminBadgeText: {
    fontFamily: FontFamily.semibold,
    fontSize: 12,
    color: Colors.accent[400],
    letterSpacing: 1,
  },
  adminTitle: {
    fontFamily: FontFamily.display,
    fontSize: 32,
    color: Colors.neutral[0],
    marginBottom: 4,
  },
  adminSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: Colors.neutral[300],
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  statCard: {
    width: '47%',
    backgroundColor: Colors.neutral[0],
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    borderTopWidth: 3,
    ...Shadows.sm,
  },
  statIcon: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  statValue: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    color: Colors.neutral[900],
    marginBottom: 2,
  },
  statLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: Colors.neutral[500],
  },
  financialRow: {
    flexDirection: 'row',
    gap: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  finCard: {
    flex: 1,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  finLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: Colors.neutral[600],
    marginTop: Spacing.xs,
    marginBottom: 4,
  },
  finAmount: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: Colors.neutral[900],
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  menuList: { paddingHorizontal: Spacing.lg, gap: Spacing.sm },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.neutral[0],
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  menuIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuLabel: {
    fontFamily: FontFamily.semibold,
    fontSize: 16,
    color: Colors.neutral[900],
    marginBottom: 2,
  },
  menuDesc: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: Colors.neutral[500],
  },
});
