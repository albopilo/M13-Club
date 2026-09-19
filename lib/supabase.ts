import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import AsyncStorage from "@react-native-async-storage/async-storage";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || '';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Check your .env file.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: Platform.OS === 'web',
    storage:
  Platform.OS === "web"
    ? {
        getItem: (key: string) =>
          Promise.resolve(localStorage.getItem(key)),
        setItem: (key: string, value: string) => {
          localStorage.setItem(key, value);
          return Promise.resolve();
        },
        removeItem: (key: string) => {
          localStorage.removeItem(key);
          return Promise.resolve();
        },
      }
    : AsyncStorage,
  },
});

export type MemberRole = 'member' | 'admin' | 'super_admin' | 'staff' | 'finance' | 'manager' | 'support';

export interface Member {
  id: string;
  user_id: string;
  member_number: string;
  full_name: string;
  phone: string | null;
  email: string;
  date_of_birth: string | null;
  gender: string | null;
  address: string | null;
  profile_picture_url: string | null;
  emergency_contact_name: string | null;
  emergency_contact_phone: string | null;
  role: MemberRole;
  status: string;
  transaction_pin: string | null;
  joined_at: string;
  created_at: string;
  updated_at: string;
}

export interface Branch {
  id: string;
  name: string;
  address: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface Wallet {
  id: string;
  member_id: string;
  balance: number;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  member_id: string;
  amount: number;
  type: 'credit' | 'debit';
  description: string;
  reference_type: string | null;
  reference_id: string | null;
  balance_before: number;
  balance_after: number;
  operator_id: string | null;
  reason: string | null;
  approval_status: string;
  branch_id: string | null;
  branch_name: string | null;
  created_at: string;
}

export interface Voucher {
  id: string;
  code: string;
  description: string;
  value: number;
  is_active: boolean;
  redemption_limit: number;
  expires_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  status: 'available' | 'sold';
  sold_by: string | null;
  sold_at: string | null;
  revealed_at: string | null;
}

export interface VoucherRedemption {
  id: string;
  voucher_id: string;
  member_id: string;
  transaction_id: string | null;
  value: number;
  redeemed_at: string;
}

export interface Room {
  id: string;
  name: string;
  description: string | null;
  room_type: string;
  price_per_night: number;
  capacity: number;
  amenities: string[] | null;
  image_url: string | null;
  is_available: boolean;
  created_at: string;
  updated_at: string;
}

export interface Booking {
  id: string;
  member_id: string;
  room_id: string;
  check_in_date: string;
  check_out_date: string;
  num_guests: number;
  total_amount: number;
  status: string;
  payment_status: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
  room?: Room;
}

export interface AuditLog {
  id: string;
  actor_id: string | null;
  action: string;
  entity_type: string | null;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: string;
}

export interface AppNotification {
  id: string;
  member_id: string;
  title: string;
  message: string;
  type: 'info' | 'success' | 'warning' | 'error';
  is_read: boolean;
  created_at: string;
}

export const isAdminRole = (role: MemberRole | undefined): boolean => {
  return role === 'admin' || role === 'super_admin' || role === 'manager' || role === 'finance';
};

export const isSuperAdminRole = (role: MemberRole | undefined): boolean => {
  return role === 'super_admin';
};

export const isStaffRole = (role: MemberRole | undefined): boolean => {
  return role === 'staff';
};
