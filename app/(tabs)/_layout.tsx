import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import {
  Home,
  Wallet,
  Ticket,
  CreditCard,
  User as UserIcon,
  Shield,
  Receipt,
  ShoppingCart,
} from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { Colors, FontFamily } from '@/constants/theme';
import { isAdminRole, isStaffRole } from '@/lib/supabase';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useResponsive } from '@/hooks/useResponsive';
import {
  WebSidebar,
  SIDEBAR_WIDTH,
} from '@/components/WebSidebar';
import { useLanguage } from '@/context/LanguageContext';

export default function TabLayout() {
  const { user, member, loading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { showSidebar } = useResponsive();
  const { t } = useLanguage();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/(auth)/login');
    }
  }, [loading, user]);

  if (loading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator
          size="large"
          color={Colors.primary[700]}
        />
      </View>
    );
  }

  const role = member?.role;
  const isAdmin = isAdminRole(role);
  const isStaff = isStaffRole(role);

  return (
    <View style={styles.root}>
      {showSidebar && <WebSidebar />}

      <View
        style={[
          styles.tabContainer,
          showSidebar && {
            marginLeft: SIDEBAR_WIDTH,
          },
        ]}
      >
        <Tabs
          screenOptions={{
            headerShown: false,

            tabBarStyle: [
              styles.tabBar,
              {
                height: 80 + insets.bottom,
                paddingBottom: Math.max(insets.bottom, 10),
              },
              showSidebar && styles.desktopTabBarHidden,
            ],

            tabBarActiveTintColor:
              Colors.primary[700],

            tabBarInactiveTintColor:
              Colors.neutral[400],

            tabBarLabelStyle: {
              fontFamily: FontFamily.medium,
              fontSize: 11,
            },
          }}
        >
          {/* Staff only sees payment-logs and profile */}
          <Tabs.Screen
            name="index"
            options={{
              title: t('tab.home'),
              tabBarIcon: ({ size, color }) => (
                <Home
                  size={size}
                  color={color}
                  strokeWidth={2}
                />
              ),
              href: isStaff ? null : undefined,
            }}
          />

          <Tabs.Screen
            name="wallet"
            options={{
              title: t('tab.wallet'),
              tabBarIcon: ({ size, color }) => (
                <Wallet
                  size={size}
                  color={color}
                  strokeWidth={2}
                />
              ),
              href: isStaff ? null : undefined,
            }}
          />

          <Tabs.Screen
            name="payment"
            options={{
              title: t('tab.payment'),
              tabBarIcon: ({ size, color }) => (
                <CreditCard
                  size={size}
                  color={color}
                  strokeWidth={2}
                />
              ),
              href: isStaff ? null : undefined,
            }}
          />

          <Tabs.Screen
            name="vouchers"
            options={{
              title: t('tab.vouchers'),
              tabBarIcon: ({ size, color }) => (
                <Ticket
                  size={size}
                  color={color}
                  strokeWidth={2}
                />
              ),
              href: isStaff ? null : undefined,
            }}
          />

          <Tabs.Screen
            name="sales"
            options={{
              title: t('tab.sales'),
              tabBarIcon: ({ size, color }) => (
                <ShoppingCart
                  size={size}
                  color={color}
                  strokeWidth={2}
                />
              ),
              href:
                isStaff || isAdmin
                  ? undefined
                  : null,
            }}
          />

          <Tabs.Screen
            name="payment-logs"
            options={{
              title: t('tab.logs'),
              tabBarIcon: ({ size, color }) => (
                <Receipt
                  size={size}
                  color={color}
                  strokeWidth={2}
                />
              ),
              href:
                isStaff || isAdmin
                  ? undefined
                  : null,
            }}
          />

          <Tabs.Screen
            name="profile"
            options={{
              title: t('tab.profile'),
              tabBarIcon: ({ size, color }) => (
                <UserIcon
                  size={size}
                  color={color}
                  strokeWidth={2}
                />
              ),
            }}
          />

          <Tabs.Screen
            name="admin"
            options={{
              title: t('tab.admin'),
              tabBarIcon: ({ size, color }) => (
                <Shield
                  size={size}
                  color={color}
                  strokeWidth={2}
                />
              ),
              href: isAdmin ? undefined : null,
            }}
          />

          {/* Hidden screens - bookings removed, kept to avoid routing errors */}
          <Tabs.Screen
            name="bookings"
            options={{
              href: null,
            }}
          />
        </Tabs>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    backgroundColor: Colors.neutral[50],
  },

  tabContainer: {
    flex: 1,
    minWidth: 0,
  },

  tabBar: {
    position: 'absolute',
    backgroundColor: Colors.neutral[0],
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],
    paddingTop: 8,
  },

  desktopTabBarHidden: {
    display: 'none',
  },

  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.neutral[50],
  },
});