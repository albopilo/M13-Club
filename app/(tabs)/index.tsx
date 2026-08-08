import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Wallet, Ticket, Calendar, Bell, TrendingUp, ArrowRight, Sparkles } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { supabase, Wallet as WalletType, AppNotification } from '@/lib/supabase';
import { Colors, FontFamily, BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

export default function HomeScreen() {
  const { member } = useAuth();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!member) return;
    const [walletRes, notifRes] = await Promise.all([
      supabase.from('wallets').select('*').eq('member_id', member.id).maybeSingle(),
      supabase.from('notifications').select('*').eq('member_id', member.id).order('created_at', { ascending: false }).limit(5),
    ]);
    if (walletRes.data) setWallet(walletRes.data as WalletType);
    if (notifRes.data) setNotifications(notifRes.data as AppNotification[]);
  }, [member]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      showsVerticalScrollIndicator={false}
    >
      <LinearGradient
        colors={[Colors.primary[900], Colors.primary[700]]}
        style={styles.heroCard}
      >
        <View style={styles.heroTop}>
          <View>
            <Text style={styles.greeting}>{greeting()},</Text>
            <Text style={styles.memberName}>{member?.full_name || 'Member'}</Text>
          </View>
          <View style={styles.memberBadge}>
            <Text style={styles.memberNumber}>{member?.member_number}</Text>
          </View>
        </View>

        <View style={styles.balanceSection}>
          <Text style={styles.balanceLabel}>Wallet Balance</Text>
          <Text style={styles.balanceAmount}>
            MC {Math.round(Number(wallet?.balance ?? 0))}
          </Text>
        </View>

        <View style={styles.heroActions}>
          <TouchableOpacity
            style={styles.heroAction}
            onPress={() => router.push('/(tabs)/vouchers')}
          >
            <Ticket size={18} color={Colors.neutral[0]} strokeWidth={2} />
            <Text style={styles.heroActionText}>Redeem</Text>
          </TouchableOpacity>
          <View style={styles.heroDivider} />
          <TouchableOpacity
            style={styles.heroAction}
            onPress={() => router.push('/(tabs)/payment')}
          >
            <Calendar size={18} color={Colors.neutral[0]} strokeWidth={2} />
            <Text style={styles.heroActionText}>Pay</Text>
          </TouchableOpacity>
          <View style={styles.heroDivider} />
          <TouchableOpacity
            style={styles.heroAction}
            onPress={() => router.push('/(tabs)/wallet')}
          >
            <Wallet size={18} color={Colors.neutral[0]} strokeWidth={2} />
            <Text style={styles.heroActionText}>Wallet</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Quick Actions</Text>
        <View style={styles.quickGrid}>
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push('/(tabs)/payment')}
            activeOpacity={0.85}
          >
            <View style={[styles.quickIcon, { backgroundColor: Colors.primary[50] }]}>
              <Calendar size={24} color={Colors.primary[700]} strokeWidth={2} />
            </View>
            <Text style={styles.quickTitle}>Payment</Text>
            <Text style={styles.quickSubtitle}>Make a Payment</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push('/(tabs)/vouchers')}
            activeOpacity={0.85}
          >
            <View style={[styles.quickIcon, { backgroundColor: Colors.accent[50] }]}>
              <Ticket size={24} color={Colors.accent[600]} strokeWidth={2} />
            </View>
            <Text style={styles.quickTitle}>Redeem Voucher</Text>
            <Text style={styles.quickSubtitle}>Add credit</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push('/(tabs)/wallet')}
            activeOpacity={0.85}
          >
            <View style={[styles.quickIcon, { backgroundColor: Colors.success[50] }]}>
              <TrendingUp size={24} color={Colors.success[600]} strokeWidth={2} />
            </View>
            <Text style={styles.quickTitle}>Transactions</Text>
            <Text style={styles.quickSubtitle}>View history</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.85}
          >
            <View style={[styles.quickIcon, { backgroundColor: Colors.secondary[100] }]}>
              <Sparkles size={24} color={Colors.secondary[600]} strokeWidth={2} />
            </View>
            <Text style={styles.quickTitle}>My Profile</Text>
            <Text style={styles.quickSubtitle}>Edit details</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Recent Notifications</Text>
          <Bell size={18} color={Colors.neutral[400]} strokeWidth={2} />
        </View>
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Bell size={32} color={Colors.neutral[300]} strokeWidth={1.5} />
            <Text style={styles.emptyText}>No notifications yet</Text>
          </View>
        ) : (
          <View style={styles.notifList}>
            {notifications.map((n) => (
              <View key={n.id} style={styles.notifItem}>
                <View style={[styles.notifDot, { backgroundColor: getNotifColor(n.type) }]} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.notifTitle}>{n.title}</Text>
                  <Text style={styles.notifMessage} numberOfLines={2}>{n.message}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>
    </ScrollView>
  );
}

function getNotifColor(type: string) {
  switch (type) {
    case 'success': return Colors.success[500];
    case 'warning': return Colors.warning[500];
    case 'error': return Colors.error[500];
    default: return Colors.primary[500];
  }
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral[50] },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  heroCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.lg,
  },
  heroTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  greeting: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: Colors.neutral[200],
  },
  memberName: {
    fontFamily: FontFamily.bold,
    fontSize: 22,
    color: Colors.neutral[0],
    marginTop: 2,
  },
  memberBadge: {
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  memberNumber: {
    fontFamily: FontFamily.semibold,
    fontSize: 13,
    color: Colors.neutral[0],
  },
  balanceSection: {
    marginBottom: Spacing.lg,
  },
  balanceLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: Colors.neutral[200],
    marginBottom: 4,
  },
  balanceAmount: {
    fontFamily: FontFamily.display,
    fontSize: 40,
    color: Colors.neutral[0],
  },
  heroActions: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderRadius: BorderRadius.md,
    paddingVertical: 4,
  },
  heroAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
  },
  heroActionText: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.neutral[0],
  },
  heroDivider: {
    width: 1,
    height: 24,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  section: { marginBottom: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: Colors.neutral[900],
    marginBottom: Spacing.md,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.md,
  },
  quickCard: {
    width: '47%',
    backgroundColor: Colors.neutral[0],
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  quickIcon: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: Spacing.sm,
  },
  quickTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    color: Colors.neutral[900],
    marginBottom: 2,
  },
  quickSubtitle: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: Colors.neutral[500],
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyText: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: Colors.neutral[400],
  },
  notifList: { gap: Spacing.sm },
  notifItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.md,
    backgroundColor: Colors.neutral[0],
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    ...Shadows.sm,
  },
  notifDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginTop: 5,
  },
  notifTitle: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    color: Colors.neutral[900],
    marginBottom: 2,
  },
  notifMessage: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: Colors.neutral[500],
    lineHeight: 19,
  },
});
