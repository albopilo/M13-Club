import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Tabs, useRouter } from 'expo-router';
import { Home, Wallet, Ticket, CreditCard, User as UserIcon, Shield, Receipt } from 'lucide-react-native';
import { useAuth } from '@/context/AuthContext';
import { Colors, FontFamily } from '@/constants/theme';
import { isAdminRole, isStaffRole } from '@/lib/supabase';
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ShoppingCart } from 'lucide-react-native';

export default function TabLayout() {
  const { user, member, loading } = useAuth();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!loading && !user) {
      router.replace('/(auth)/login');
    }
  }, [loading, user]);

  if (loading || !user) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary[600]} />
      </View>
    );
  }

  const role = member?.role;
  const isAdmin = isAdminRole(role);
  const isStaff = isStaffRole(role);

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
tabBarStyle: {
  position: "absolute",
  backgroundColor: Colors.neutral[0],
  borderTopWidth: 1,
  borderTopColor: Colors.neutral[200],

  height: 80 + insets.bottom,
  paddingBottom: Math.max(insets.bottom, 10),
  paddingTop: 8,
},
        tabBarActiveTintColor: Colors.primary[700],
        tabBarInactiveTintColor: Colors.neutral[400],
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
          title: 'Home',
          tabBarIcon: ({ size, color }) => <Home size={size} color={color} strokeWidth={2} />,
          href: isStaff ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="wallet"
        options={{
          title: 'Wallet',
          tabBarIcon: ({ size, color }) => <Wallet size={size} color={color} strokeWidth={2} />,
          href: isStaff ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="payment"
        options={{
          title: 'Payment',
          tabBarIcon: ({ size, color }) => <CreditCard size={size} color={color} strokeWidth={2} />,
          href: isStaff ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="vouchers"
        options={{
          title: 'Vouchers',
          tabBarIcon: ({ size, color }) => <Ticket size={size} color={color} strokeWidth={2} />,
          href: isStaff ? null : undefined,
        }}
      />
      <Tabs.Screen
  name="sales"
  options={{
    title: "Sales",
    tabBarIcon: ({ size, color }) => (
      <ShoppingCart
        size={size}
        color={color}
        strokeWidth={2}
      />
    ),
    href: (isStaff || isAdmin) ? undefined : null,
  }}
/>
      <Tabs.Screen
        name="payment-logs"
        options={{
          title: 'Logs',
          tabBarIcon: ({ size, color }) => <Receipt size={size} color={color} strokeWidth={2} />,
          href: (isStaff || isAdmin) ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ size, color }) => <UserIcon size={size} color={color} strokeWidth={2} />,
        }}
      />
      <Tabs.Screen
        name="admin"
        options={{
          title: 'Admin',
          tabBarIcon: ({ size, color }) => <Shield size={size} color={color} strokeWidth={2} />,
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
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.neutral[50],
  },
});
