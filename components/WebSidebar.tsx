import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import {
  LogOut,
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
import {
  Colors,
  FontFamily,
  BorderRadius,
  Spacing,
} from '@/constants/theme';
import {
  isAdminRole,
  isStaffRole,
} from '@/lib/supabase';

export const SIDEBAR_WIDTH = 240;

type NavItem = {
  route: string;
  label: string;
  icon: typeof Home;
  href: string;
};

export function WebSidebar() {
  const { member, signOut } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  const role = member?.role;
  const isAdmin = isAdminRole(role);
  const isStaff = isStaffRole(role);

  const navItems: NavItem[] = [
    ...(isStaff
      ? []
      : [
          {
            route: 'index',
            label: 'Home',
            icon: Home,
            href: '/(tabs)/',
          },
          {
            route: 'wallet',
            label: 'Wallet',
            icon: Wallet,
            href: '/(tabs)/wallet',
          },
          {
            route: 'payment',
            label: 'Payment',
            icon: CreditCard,
            href: '/(tabs)/payment',
          },
          {
            route: 'vouchers',
            label: 'Vouchers',
            icon: Ticket,
            href: '/(tabs)/vouchers',
          },
        ]),
    ...(isStaff || isAdmin
      ? [
          {
            route: 'sales',
            label: 'Sales',
            icon: ShoppingCart,
            href: '/(tabs)/sales',
          },
          {
            route: 'payment-logs',
            label: 'Logs',
            icon: Receipt,
            href: '/(tabs)/payment-logs',
          },
        ]
      : []),
    {
      route: 'profile',
      label: 'Profile',
      icon: UserIcon,
      href: '/(tabs)/profile',
    },
    ...(isAdmin
      ? [
          {
            route: 'admin',
            label: 'Admin',
            icon: Shield,
            href: '/(tabs)/admin',
          },
        ]
      : []),
  ];

  const isActive = (href: string) => {
    const route = href
      .replace('/(tabs)/', '/')
      .replace('/index', '');

    if (route === '/' || route === '') {
      return pathname === '/' || pathname === '/index';
    }

    return (
      pathname === route ||
      pathname.startsWith(`${route}/`)
    );
  };

  const handleNavigation = (href: string) => {
    router.push(href as never);
  };

  const handleSignOut = async () => {
    await signOut();
    router.replace('/(auth)/login');
  };

  return (
    <View style={styles.sidebar}>
      <View style={styles.header}>
        <View style={styles.logo}>
          <Text style={styles.logoText}>M13</Text>
        </View>

        <Text style={styles.appName}>
          M13 Club
        </Text>
      </View>

      <ScrollView
        style={styles.nav}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.navContent}
      >
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <TouchableOpacity
              key={item.route}
              style={[
                styles.navItem,
                active && styles.navItemActive,
              ]}
              onPress={() =>
                handleNavigation(item.href)
              }
              activeOpacity={0.7}
            >
              <Icon
                size={22}
                color={
                  active
                    ? Colors.primary[700]
                    : Colors.neutral[500]
                }
                strokeWidth={2}
              />

              <Text
                style={[
                  styles.navLabel,
                  active && styles.navLabelActive,
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.memberInfo}>
          <Text
            style={styles.memberName}
            numberOfLines={1}
          >
            {member?.full_name || 'Member'}
          </Text>

          <Text
            style={styles.memberRole}
            numberOfLines={1}
          >
            {member?.member_number} · {member?.role}
          </Text>
        </View>

        <TouchableOpacity
          style={styles.signOutButton}
          onPress={handleSignOut}
          activeOpacity={0.7}
        >
          <LogOut
            size={18}
            color={Colors.neutral[500]}
            strokeWidth={2}
          />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  sidebar: {
    position: 'fixed',
    left: 0,
    top: 0,
    bottom: 0,
    width: SIDEBAR_WIDTH,

    backgroundColor: Colors.neutral[0],

    borderRightWidth: 1,
    borderRightColor: Colors.neutral[200],

    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    paddingLeft: Spacing.lg,
    paddingRight: Spacing.lg,

    zIndex: 1000,
  },

  header: {
    alignItems: 'center',
    marginBottom: Spacing.xl,
  },

  logo: {
    width: 56,
    height: 56,

    borderRadius: BorderRadius.xl,

    backgroundColor: Colors.primary[950],

    alignItems: 'center',
    justifyContent: 'center',

    marginBottom: Spacing.sm,
  },

  logoText: {
    fontFamily: FontFamily.display,
    fontSize: 22,
    color: Colors.neutral[0],
  },

  appName: {
    fontFamily: FontFamily.bold,
    fontSize: 18,
    color: Colors.neutral[900],
  },

  nav: {
    flex: 1,
  },

  navContent: {
    paddingBottom: Spacing.md,
  },

  navItem: {
    flexDirection: 'row',
    alignItems: 'center',

    gap: Spacing.md,

    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,

    borderRadius: BorderRadius.md,

    marginBottom: Spacing.xs,
  },

  navItemActive: {
    backgroundColor: Colors.primary[50],
  },

  navLabel: {
    fontFamily: FontFamily.medium,
    fontSize: 15,
    color: Colors.neutral[500],
  },

  navLabelActive: {
    color: Colors.primary[700],
    fontFamily: FontFamily.semibold,
  },

  footer: {
    borderTopWidth: 1,
    borderTopColor: Colors.neutral[200],

    paddingTop: Spacing.md,

    flexDirection: 'row',
    alignItems: 'center',

    gap: Spacing.sm,
  },

  memberInfo: {
    flex: 1,
    minWidth: 0,
  },

  memberName: {
    fontFamily: FontFamily.semibold,
    fontSize: 14,
    color: Colors.neutral[900],
  },

  memberRole: {
    fontFamily: FontFamily.regular,
    fontSize: 12,
    color: Colors.neutral[400],
    marginTop: 2,
  },

  signOutButton: {
    padding: Spacing.sm,
    borderRadius: BorderRadius.md,
  },
});