import { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Image,
  Modal,
  TextInput,
  ActivityIndicator,
  Linking,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useFocusEffect, router } from 'expo-router';
import { Wallet, Ticket, Calendar, Bell, TrendingUp, ArrowRight, Sparkles, UtensilsCrossed, X, ChevronRight, Check } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { useLanguage } from '@/context/LanguageContext';
import { supabase, Wallet as WalletType, AppNotification, Branch } from '@/lib/supabase';
import { Colors, FontFamily, BorderRadius, Shadows, Spacing } from '@/constants/theme';
import { LinearGradient } from 'expo-linear-gradient';

const BRANCH_NAME_TO_TABLE_PREFIX: Record<string, string> = {
  'sans vibes millennium inn': 'Mille 1',
  'collection o millennium inn 2': 'Mille 2',
  'sans vibes millennium garden': 'Mille 3',
};

function getTablePrefix(branchName: string): string | null {
  const key = branchName.trim().toLowerCase();
  return BRANCH_NAME_TO_TABLE_PREFIX[key] ?? null;
}

export default function HomeScreen() {
  const { member } = useAuth();
  const { t } = useLanguage();
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const [foodModalVisible, setFoodModalVisible] = useState(false);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<Branch | null>(null);
  const [roomNumber, setRoomNumber] = useState('');
  const [branchesLoading, setBranchesLoading] = useState(false);
  const [step, setStep] = useState<'branch' | 'room'>('branch');

  const fetchData = useCallback(async () => {
    if (!member) return;
    const [walletRes, notifRes] = await Promise.all([
      supabase.from('wallets').select('*').eq('member_id', member.id).maybeSingle(),
      supabase.from('notifications').select('*').eq('member_id', member.id).order('created_at', { ascending: false }).limit(5),
    ]);
    if (walletRes.data) setWallet(walletRes.data as WalletType);
    if (notifRes.data) setNotifications(notifRes.data as AppNotification[]);
  }, [member]);

  const openFoodModal = useCallback(async () => {
    setFoodModalVisible(true);
    setStep('branch');
    setSelectedBranch(null);
    setRoomNumber('');
    setBranchesLoading(true);
    const { data } = await supabase.from('branches').select('*').eq('is_active', true).order('name');
    setBranches((data ?? []) as Branch[]);
    setBranchesLoading(false);
  }, []);

  const closeFoodModal = useCallback(() => {
    setFoodModalVisible(false);
    setSelectedBranch(null);
    setRoomNumber('');
    setStep('branch');
  }, []);

  const confirmOrder = useCallback(() => {
    if (!selectedBranch || !roomNumber.trim()) return;
    const prefix = getTablePrefix(selectedBranch.name);
    if (!prefix) return;
    const tableParam = `${prefix} - ${roomNumber.trim()}`;
    const url = `https://13e-menu.netlify.app/?table=${encodeURIComponent(tableParam)}`;
    Linking.openURL(url);
    closeFoodModal();
  }, [selectedBranch, roomNumber, closeFoodModal]);

  useFocusEffect(useCallback(() => { fetchData(); }, [fetchData]));

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return t('home.greeting.morning');
    if (h < 18) return t('home.greeting.afternoon');
    return t('home.greeting.evening');
  };

  return (
    <>
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
            <Text style={styles.memberName}>{member?.full_name || t('home.member')}</Text>
          </View>
          <View style={styles.memberBadge}>
            <Text style={styles.memberNumber}>{member?.member_number}</Text>
          </View>
        </View>

        <View style={styles.balanceSection}>
          <Text style={styles.balanceLabel}>{t('home.walletBalance')}</Text>
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
            <Text style={styles.heroActionText}>{t('home.redeem')}</Text>
          </TouchableOpacity>
          <View style={styles.heroDivider} />
          <TouchableOpacity
            style={styles.heroAction}
            onPress={() => router.push('/(tabs)/payment')}
          >
            <Calendar size={18} color={Colors.neutral[0]} strokeWidth={2} />
            <Text style={styles.heroActionText}>{t('home.pay')}</Text>
          </TouchableOpacity>
          <View style={styles.heroDivider} />
          <TouchableOpacity
            style={styles.heroAction}
            onPress={() => router.push('/(tabs)/wallet')}
          >
            <Wallet size={18} color={Colors.neutral[0]} strokeWidth={2} />
            <Text style={styles.heroActionText}>{t('home.wallet')}</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>{t('home.quickActions')}</Text>
        <View style={styles.quickGrid}>
          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push('/(tabs)/payment')}
            activeOpacity={0.85}
          >
            <View style={[styles.quickIcon, { backgroundColor: Colors.primary[50] }]}>
              <Calendar size={24} color={Colors.primary[700]} strokeWidth={2} />
            </View>
            <Text style={styles.quickTitle}>{t('home.payment')}</Text>
            <Text style={styles.quickSubtitle}>{t('home.makePayment')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push('/(tabs)/vouchers')}
            activeOpacity={0.85}
          >
            <View style={[styles.quickIcon, { backgroundColor: Colors.accent[50] }]}>
              <Ticket size={24} color={Colors.accent[600]} strokeWidth={2} />
            </View>
            <Text style={styles.quickTitle}>{t('home.redeemVoucher')}</Text>
            <Text style={styles.quickSubtitle}>{t('home.addCredit')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push('/(tabs)/wallet')}
            activeOpacity={0.85}
          >
            <View style={[styles.quickIcon, { backgroundColor: Colors.success[50] }]}>
              <TrendingUp size={24} color={Colors.success[600]} strokeWidth={2} />
            </View>
            <Text style={styles.quickTitle}>{t('home.transactions')}</Text>
            <Text style={styles.quickSubtitle}>{t('home.viewHistory')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickCard}
            onPress={() => router.push('/(tabs)/profile')}
            activeOpacity={0.85}
          >
            <View style={[styles.quickIcon, { backgroundColor: Colors.secondary[100] }]}>
              <Sparkles size={24} color={Colors.secondary[600]} strokeWidth={2} />
            </View>
            <Text style={styles.quickTitle}>{t('home.myProfile')}</Text>
            <Text style={styles.quickSubtitle}>{t('home.editDetails')}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.quickCard}
            onPress={openFoodModal}
            activeOpacity={0.85}
          >
            <View style={[styles.quickIcon, { backgroundColor: Colors.warning[50] }]}>
              <UtensilsCrossed size={24} color={Colors.warning[600]} strokeWidth={2} />
            </View>
            <Text style={styles.quickTitle}>{t('home.orderFb')}</Text>
            <Text style={styles.quickSubtitle}>{t('home.foodBeverages')}</Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>{t('home.recentNotifications')}</Text>
          <Bell size={18} color={Colors.neutral[400]} strokeWidth={2} />
        </View>
        {notifications.length === 0 ? (
          <View style={styles.emptyState}>
            <Bell size={32} color={Colors.neutral[300]} strokeWidth={1.5} />
            <Text style={styles.emptyText}>{t('home.noNotifications')}</Text>
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

      {/* Order F&B Modal */}
      <Modal
        visible={foodModalVisible}
        transparent
        animationType="fade"
        onRequestClose={closeFoodModal}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'web' ? undefined : 'padding'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalIconWrap}>
                  <UtensilsCrossed size={20} color={Colors.neutral[0]} strokeWidth={2} />
                </View>
                <Text style={styles.modalTitle}>
                  {step === 'branch' ? t('home.selectBranch') : t('home.roomNumber')}
                </Text>
              </View>
              <TouchableOpacity onPress={closeFoodModal} style={styles.modalCloseBtn}>
                <X size={20} color={Colors.neutral[500]} strokeWidth={2} />
              </TouchableOpacity>
            </View>

            {step === 'branch' && (
              <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
                {branchesLoading ? (
                  <View style={styles.modalLoadingWrap}>
                    <ActivityIndicator size="large" color={Colors.primary[700]} />
                    <Text style={styles.modalLoadingText}>{t('home.loadingBranches')}</Text>
                  </View>
                ) : branches.length === 0 ? (
                  <View style={styles.modalEmptyWrap}>
                    <Text style={styles.modalEmptyText}>{t('home.noBranches')}</Text>
                  </View>
                ) : (
                  <View style={styles.branchList}>
                    {branches.map((b) => {
                      const isSelected = selectedBranch?.id === b.id;
                      const hasPrefix = getTablePrefix(b.name) !== null;
                      return (
                        <TouchableOpacity
                          key={b.id}
                          style={[
                            styles.branchItem,
                            isSelected && styles.branchItemSelected,
                            !hasPrefix && styles.branchItemDisabled,
                          ]}
                          disabled={!hasPrefix}
                          activeOpacity={0.85}
                          onPress={() => {
                            setSelectedBranch(b);
                            setStep('room');
                          }}
                        >
                          <View style={styles.branchItemLeft}>
                            <Text style={styles.branchName}>{b.name}</Text>
                            {b.address ? (
                              <Text style={styles.branchAddress} numberOfLines={1}>{b.address}</Text>
                            ) : null}
                            {!hasPrefix && (
                              <Text style={styles.branchUnsupported}>{t('home.notAvailableFb')}</Text>
                            )}
                          </View>
                          {isSelected ? (
                            <Check size={20} color={Colors.primary[700]} strokeWidth={2} />
                          ) : (
                            <ChevronRight size={20} color={Colors.neutral[300]} strokeWidth={2} />
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
              </ScrollView>
            )}

            {step === 'room' && selectedBranch && (
              <View style={styles.modalBody}>
                <View style={styles.roomStepHeader}>
                  <TouchableOpacity onPress={() => setStep('branch')} style={styles.roomBackBtn}>
                    <Text style={styles.roomBackText}>{t('home.back')}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.roomSelectedBranch}>
                  <Text style={styles.roomSelectedLabel}>{t('home.branch')}</Text>
                  <Text style={styles.roomSelectedName}>{selectedBranch.name}</Text>
                </View>

                <Text style={styles.roomInputLabel}>{t('home.roomNumber')}</Text>
                <TextInput
                  style={styles.roomInput}
                  value={roomNumber}
                  onChangeText={setRoomNumber}
                  placeholder={t('home.roomPlaceholder')}
                  placeholderTextColor={Colors.neutral[300]}
                  keyboardType="number-pad"
                  returnKeyType="done"
                  autoFocus
                />

                <TouchableOpacity
                  style={[styles.roomConfirmBtn, !roomNumber.trim() && styles.roomConfirmBtnDisabled]}
                  disabled={!roomNumber.trim()}
                  activeOpacity={0.85}
                  onPress={confirmOrder}
                >
                  <Text style={styles.roomConfirmText}>{t('home.orderNow')}</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </>
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
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.lg,
  },
  modalCard: {
    backgroundColor: Colors.neutral[0],
    borderRadius: BorderRadius.xl,
    width: '100%',
    maxWidth: 440,
    maxHeight: '80%',
    ...Shadows.lg,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: Spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: Colors.neutral[200],
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  modalIconWrap: {
    width: 36,
    height: 36,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.primary[700],
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalTitle: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: Colors.neutral[900],
  },
  modalCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.neutral[100],
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalBody: {
    padding: Spacing.lg,
  },
  modalLoadingWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.md,
  },
  modalLoadingText: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: Colors.neutral[500],
  },
  modalEmptyWrap: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
  },
  modalEmptyText: {
    fontFamily: FontFamily.regular,
    fontSize: 14,
    color: Colors.neutral[400],
  },
  branchList: {
    gap: Spacing.sm,
  },
  branchItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: Spacing.md,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.neutral[50],
    borderWidth: 1.5,
    borderColor: 'transparent',
  },
  branchItemSelected: {
    borderColor: Colors.primary[500],
    backgroundColor: Colors.primary[50],
  },
  branchItemDisabled: {
    opacity: 0.5,
  },
  branchItemLeft: {
    flex: 1,
  },
  branchName: {
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    color: Colors.neutral[900],
    marginBottom: 2,
  },
  branchAddress: {
    fontFamily: FontFamily.regular,
    fontSize: 13,
    color: Colors.neutral[500],
  },
  branchUnsupported: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.error[500],
    marginTop: 2,
  },
  roomStepHeader: {
    marginBottom: Spacing.md,
  },
  roomBackBtn: {
    alignSelf: 'flex-start',
  },
  roomBackText: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.primary[700],
  },
  roomSelectedBranch: {
    backgroundColor: Colors.primary[50],
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  roomSelectedLabel: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.neutral[500],
    marginBottom: 2,
  },
  roomSelectedName: {
    fontFamily: FontFamily.semibold,
    fontSize: 15,
    color: Colors.neutral[900],
  },
  roomInputLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 14,
    color: Colors.neutral[700],
    marginBottom: Spacing.sm,
  },
  roomInput: {
    borderWidth: 1.5,
    borderColor: Colors.neutral[300],
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
    fontSize: 18,
    fontFamily: FontFamily.semibold,
    color: Colors.neutral[900],
    marginBottom: Spacing.lg,
  },
  roomConfirmBtn: {
    backgroundColor: Colors.primary[700],
    borderRadius: BorderRadius.md,
    paddingVertical: 14,
    alignItems: 'center',
  },
  roomConfirmBtnDisabled: {
    opacity: 0.5,
  },
  roomConfirmText: {
    fontFamily: FontFamily.bold,
    fontSize: 16,
    color: Colors.neutral[0],
  },
});
