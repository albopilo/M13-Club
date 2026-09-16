import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  FlatList,
} from 'react-native';
import { useFocusEffect } from 'expo-router';
import { TrendingUp, TrendingDown, Wallet as WalletIcon } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { supabase, Wallet as WalletType, Transaction } from '@/lib/supabase';
import { Colors, FontFamily, BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

export default function WalletScreen() {
  const { member } = useAuth();
  const { t } = useLanguage();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    if (!member) return;
    const [walletRes, txRes] = await Promise.all([
      supabase.from('wallets').select('*').eq('member_id', member.id).maybeSingle(),
      supabase.from('transactions').select('*').eq('member_id', member.id).order('created_at', { ascending: false }).limit(100),
    ]);
    if (walletRes.data) setWallet(walletRes.data as WalletType);
    if (txRes.data) setTransactions(txRes.data as Transaction[]);
  }, [member]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const formatDate = (d: string) => {
    const date = new Date(d);
    return date.toLocaleDateString('en-MY', { day: '2-digit', month: 'short', year: 'numeric' });
  };

  const formatTime = (d: string) => {
    const date = new Date(d);
    return date.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit' });
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
        style={styles.balanceCard}
      >
        <View style={styles.cardTop}>
          <WalletIcon size={24} color={Colors.neutral[200]} strokeWidth={2} />
          <Text style={styles.cardLabel}>{t('wallet.balance')}</Text>
        </View>
        <Text style={styles.balanceAmount}>
          MC {Math.round(Number(wallet?.balance ?? 0))}
        </Text>
        <Text style={styles.memberText}>{member?.member_number} · {member?.full_name}</Text>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('wallet.history')}</Text>
        {transactions.length === 0 ? (
          <View style={styles.emptyState}>
            <TrendingUp size={32} color={Colors.neutral[300]} strokeWidth={1.5} />
            <Text style={styles.emptyText}>{t('wallet.noTransactions')}</Text>
            <Text style={styles.emptySubtext}>{t('wallet.emptyDesc')}</Text>
          </View>
        ) : (
          <FlatList
            data={transactions}
            keyExtractor={(item) => item.id}
            scrollEnabled={false}
            ItemSeparatorComponent={() => <View style={styles.separator} />}
            renderItem={({ item }) => (
              <View style={styles.txItem}>
                <View style={[
                  styles.txIcon,
                  { backgroundColor: item.type === 'credit' ? Colors.success[50] : Colors.error[50] },
                ]}>
                  {item.type === 'credit' ? (
                    <TrendingUp size={18} color={Colors.success[600]} strokeWidth={2} />
                  ) : (
                    <TrendingDown size={18} color={Colors.error[600]} strokeWidth={2} />
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.txDescription} numberOfLines={1}>{item.description}</Text>
                  <Text style={styles.txDate}>{formatDate(item.created_at)} · {formatTime(item.created_at)}</Text>
                  {item.reason && <Text style={styles.txReason}>{item.reason}</Text>}
                </View>
                <View style={styles.txAmountCol}>
                  <Text style={[
                    styles.txAmount,
                    { color: item.type === 'credit' ? Colors.success[700] : Colors.error[700] },
                  ]}>
                    {item.type === 'credit' ? '+' : '-'} MC {Math.round(Number(item.amount))}
                  </Text>
                  <Text style={styles.txBalance}>{t('wallet.bal', { amount: Math.round(Number(item.balance_after)) })}</Text>
                </View>
              </View>
            )}
          />
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.neutral[50] },
  content: { padding: Spacing.lg, paddingBottom: Spacing.xxxl },
  balanceCard: {
    borderRadius: BorderRadius.xl,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    ...Shadows.lg,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  cardLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    color: Colors.neutral[200],
  },
  balanceAmount: {
    fontFamily: FontFamily.display,
    fontSize: 44,
    color: Colors.neutral[0],
    marginBottom: 8,
  },
  memberText: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: Colors.neutral[300],
  },
  section: { marginBottom: Spacing.lg },
  sectionTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: Colors.neutral[900],
    marginBottom: Spacing.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl,
    gap: Spacing.sm,
  },
  emptyText: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    color: Colors.neutral[400],
  },
  emptySubtext: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: Colors.neutral[400],
  },
  separator: { height: 1, backgroundColor: Colors.neutral[100], marginHorizontal: 0 },
  txItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    backgroundColor: Colors.neutral[0],
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    ...Shadows.sm,
  },
  txIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  txDescription: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    color: Colors.neutral[900],
    marginBottom: 2,
  },
  txDate: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.neutral[500],
  },
  txReason: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.neutral[400],
    marginTop: 2,
  },
  txAmountCol: { alignItems: 'flex-end' },
  txAmount: {
    fontFamily: FontFamily.bold,
    fontSize: 15,
    marginBottom: 2,
  },
  txBalance: {
    fontFamily: FontFamily.regular,
    fontSize: 11,
    color: Colors.neutral[400],
  },
});
