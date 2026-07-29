/*
# M13 Club - Core Database Schema

## Overview
Creates the complete database schema for the M13 Club private membership and loyalty application.
This is a hotel/business ecosystem platform with members, wallets, vouchers, bookings, and admin management.

## New Tables
1. `members` - Extends Supabase auth.users with profile data, role, and membership number.
   - member_number: Unique M13xxxxxx identifier (auto-generated)
   - role: member | admin | super_admin | staff | finance | manager | support
   - status: active | suspended | banned
   - Profile fields: full_name, phone, email, date_of_birth, gender, address, profile_picture_url, emergency contacts
   - First registered user automatically becomes super_admin (bootstrap)

2. `wallets` - One wallet per member storing numeric balance.
   - Balance can ONLY change through SECURITY DEFINER RPC functions (not direct client writes)
   - Numeric(12,2) for precise financial calculations

3. `transactions` - Immutable financial ledger.
   - Every wallet change produces one transaction record
   - Records: amount, type (credit/debit), description, reference, balance_before, balance_after, operator, reason
   - NEVER edited or deleted (no UPDATE/DELETE policies exist)

4. `vouchers` - Admin-created vouchers with codes, values, and redemption limits.
   - code: Unique voucher code
   - value: Monetary value added to wallet on redemption
   - redemption_limit: Maximum total redemptions allowed
   - is_active: Can be toggled by admin
   - expires_at: Optional expiry timestamp

5. `voucher_redemptions` - Records of each voucher redemption (one per member per voucher).
   - Links voucher, member, and transaction
   - Prevents double redemption

6. `rooms` - Hotel room inventory.
   - room_type: standard | deluxe | suite | presidential
   - price_per_night, capacity, amenities, image_url, is_available

7. `bookings` - Room reservations with status workflow.
   - Status: pending -> confirmed -> checked_in -> checked_out -> completed (or cancelled)
   - payment_status: unpaid | paid | refunded
   - Double-booking prevention via RPC function

8. `audit_logs` - Admin action audit trail (immutable).
   - Records: actor, action, entity_type, entity_id, details (JSONB)
   - Admin-only read access

9. `notifications` - Member notifications.
   - type: info | success | warning | error
   - is_read flag for unread tracking

10. `settings` - System/business configuration (key-value with JSONB).

## Security
- RLS enabled on ALL tables
- Helper functions (is_admin, is_super_admin, get_current_member_id) use SECURITY DEFINER to bypass RLS for role checks
- Members can only read/update their own data
- Admins can read all member data and manage vouchers, rooms, bookings, wallet adjustments
- Wallet balance, transactions, audit logs: NO direct client INSERT/UPDATE/DELETE (only through RPC functions)
- Trigger protects role/status/member_number from non-admin modification
- Trigger auto-creates member + wallet on signup, first user becomes super_admin

## Important Notes
1. The first user to register automatically becomes super_admin
2. All subsequent users become regular members
3. Wallet operations go through SECURITY DEFINER RPC functions (created in next migration)
4. Transactions are immutable - no UPDATE or DELETE policies exist
5. Audit logs are append-only - no UPDATE or DELETE policies exist
*/

-- ============================================================
-- 1. SEQUENCES
-- ============================================================
CREATE SEQUENCE IF NOT EXISTS member_number_seq START 100000;

-- ============================================================
-- 2. TABLES
-- ============================================================

-- Members: extends auth.users with profile and role data
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  member_number text UNIQUE NOT NULL,
  full_name text NOT NULL DEFAULT 'New Member',
  phone text,
  email text NOT NULL,
  date_of_birth date,
  gender text CHECK (gender IN ('male', 'female', 'other', 'prefer_not_to_say')),
  address text,
  profile_picture_url text,
  emergency_contact_name text,
  emergency_contact_phone text,
  role text NOT NULL DEFAULT 'member' CHECK (role IN ('member', 'admin', 'super_admin', 'staff', 'finance', 'manager', 'support')),
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'suspended', 'banned')),
  joined_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Wallets: one per member, balance only changes via RPC functions
CREATE TABLE IF NOT EXISTS wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid UNIQUE NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  balance numeric(12,2) NOT NULL DEFAULT 0.00,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Transactions: immutable financial ledger
CREATE TABLE IF NOT EXISTS transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE RESTRICT,
  amount numeric(12,2) NOT NULL,
  type text NOT NULL CHECK (type IN ('credit', 'debit')),
  description text NOT NULL,
  reference_type text,
  reference_id uuid,
  balance_before numeric(12,2) NOT NULL,
  balance_after numeric(12,2) NOT NULL,
  operator_id uuid REFERENCES auth.users(id),
  reason text,
  approval_status text NOT NULL DEFAULT 'approved' CHECK (approval_status IN ('pending', 'approved', 'rejected')),
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Vouchers: admin-created
CREATE TABLE IF NOT EXISTS vouchers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  description text NOT NULL,
  value numeric(12,2) NOT NULL CHECK (value > 0),
  is_active boolean NOT NULL DEFAULT true,
  redemption_limit int NOT NULL DEFAULT 1 CHECK (redemption_limit > 0),
  expires_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Voucher redemptions: one per member per voucher
CREATE TABLE IF NOT EXISTS voucher_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voucher_id uuid NOT NULL REFERENCES vouchers(id) ON DELETE RESTRICT,
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  transaction_id uuid REFERENCES transactions(id) ON DELETE RESTRICT,
  value numeric(12,2) NOT NULL,
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(voucher_id, member_id)
);

-- Rooms: hotel room inventory
CREATE TABLE IF NOT EXISTS rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  description text,
  room_type text NOT NULL CHECK (room_type IN ('standard', 'deluxe', 'suite', 'presidential')),
  price_per_night numeric(10,2) NOT NULL CHECK (price_per_night > 0),
  capacity int NOT NULL DEFAULT 2 CHECK (capacity > 0),
  amenities text[],
  image_url text,
  is_available boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Bookings: room reservations
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES rooms(id) ON DELETE RESTRICT,
  check_in_date date NOT NULL,
  check_out_date date NOT NULL,
  num_guests int NOT NULL DEFAULT 1 CHECK (num_guests > 0),
  total_amount numeric(12,2) NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'completed', 'cancelled')),
  payment_status text NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid', 'paid', 'refunded')),
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Audit logs: immutable admin action trail
CREATE TABLE IF NOT EXISTS audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid REFERENCES auth.users(id),
  action text NOT NULL,
  entity_type text,
  entity_id uuid,
  details jsonb,
  ip_address text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Notifications: member notifications
CREATE TABLE IF NOT EXISTS notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid NOT NULL REFERENCES members(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info' CHECK (type IN ('info', 'success', 'warning', 'error')),
  is_read boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Settings: system configuration (key-value)
CREATE TABLE IF NOT EXISTS settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value jsonb NOT NULL,
  description text,
  updated_by uuid REFERENCES auth.users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- ============================================================
-- 3. INDEXES
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_members_user_id ON members(user_id);
CREATE INDEX IF NOT EXISTS idx_members_role ON members(role);
CREATE INDEX IF NOT EXISTS idx_members_member_number ON members(member_number);

CREATE INDEX IF NOT EXISTS idx_wallets_member_id ON wallets(member_id);

CREATE INDEX IF NOT EXISTS idx_transactions_member_id ON transactions(member_id);
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);

CREATE INDEX IF NOT EXISTS idx_vouchers_active ON vouchers(is_active);
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_voucher_id ON voucher_redemptions(voucher_id);
CREATE INDEX IF NOT EXISTS idx_voucher_redemptions_member_id ON voucher_redemptions(member_id);

CREATE INDEX IF NOT EXISTS idx_bookings_member_id ON bookings(member_id);
CREATE INDEX IF NOT EXISTS idx_bookings_room_id ON bookings(room_id);
CREATE INDEX IF NOT EXISTS idx_bookings_status ON bookings(status);
CREATE INDEX IF NOT EXISTS idx_bookings_check_in_date ON bookings(check_in_date);

CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id ON audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_member_id ON notifications(member_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

-- ============================================================
-- 4. ENABLE RLS ON ALL TABLES
-- ============================================================
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;
ALTER TABLE voucher_redemptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 5. HELPER FUNCTIONS (SECURITY DEFINER - bypass RLS for role checks)
-- ============================================================

CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'manager', 'finance')
    AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
    AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION get_current_member_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id FROM members WHERE user_id = auth.uid();
$$;

-- ============================================================
-- 6. RLS POLICIES
-- ============================================================

-- ---- MEMBERS ----
DROP POLICY IF EXISTS "members_select_own_or_admin" ON members;
CREATE POLICY "members_select_own_or_admin" ON members
  FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR is_admin());

DROP POLICY IF EXISTS "members_insert_own" ON members;
CREATE POLICY "members_insert_own" ON members
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "members_update_own_or_admin" ON members;
CREATE POLICY "members_update_own_or_admin" ON members
  FOR UPDATE TO authenticated
  USING (user_id = auth.uid() OR is_admin())
  WITH CHECK (user_id = auth.uid() OR is_admin());

-- No DELETE policy on members (prevent data loss)

-- ---- WALLETS ----
DROP POLICY IF EXISTS "wallets_select_own_or_admin" ON wallets;
CREATE POLICY "wallets_select_own_or_admin" ON wallets
  FOR SELECT TO authenticated
  USING (
    member_id = get_current_member_id() OR is_admin()
  );
-- No INSERT/UPDATE/DELETE policies - balance only changes via RPC functions

-- ---- TRANSACTIONS ----
DROP POLICY IF EXISTS "transactions_select_own_or_admin" ON transactions;
CREATE POLICY "transactions_select_own_or_admin" ON transactions
  FOR SELECT TO authenticated
  USING (
    member_id = get_current_member_id() OR is_admin()
  );
-- No INSERT/UPDATE/DELETE policies - immutable ledger, only RPC functions write

-- ---- VOUCHERS ----
DROP POLICY IF EXISTS "vouchers_select_all" ON vouchers;
CREATE POLICY "vouchers_select_all" ON vouchers
  FOR SELECT TO authenticated
  USING (is_active = true OR is_admin());

DROP POLICY IF EXISTS "vouchers_insert_admin" ON vouchers;
CREATE POLICY "vouchers_insert_admin" ON vouchers
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "vouchers_update_admin" ON vouchers;
CREATE POLICY "vouchers_update_admin" ON vouchers
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "vouchers_delete_admin" ON vouchers;
CREATE POLICY "vouchers_delete_admin" ON vouchers
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- ---- VOUCHER REDEMPTIONS ----
DROP POLICY IF EXISTS "redemptions_select_own_or_admin" ON voucher_redemptions;
CREATE POLICY "redemptions_select_own_or_admin" ON voucher_redemptions
  FOR SELECT TO authenticated
  USING (
    member_id = get_current_member_id() OR is_admin()
  );
-- No INSERT/UPDATE/DELETE policies - only RPC function creates redemptions

-- ---- ROOMS ----
DROP POLICY IF EXISTS "rooms_select_all" ON rooms;
CREATE POLICY "rooms_select_all" ON rooms
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "rooms_insert_admin" ON rooms;
CREATE POLICY "rooms_insert_admin" ON rooms
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "rooms_update_admin" ON rooms;
CREATE POLICY "rooms_update_admin" ON rooms
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "rooms_delete_admin" ON rooms;
CREATE POLICY "rooms_delete_admin" ON rooms
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- ---- BOOKINGS ----
DROP POLICY IF EXISTS "bookings_select_own_or_admin" ON bookings;
CREATE POLICY "bookings_select_own_or_admin" ON bookings
  FOR SELECT TO authenticated
  USING (
    member_id = get_current_member_id() OR is_admin()
  );

-- No INSERT/UPDATE policies for direct client access - use RPC functions
-- (create_booking, cancel_booking, update_booking_status)

DROP POLICY IF EXISTS "bookings_delete_admin" ON bookings;
CREATE POLICY "bookings_delete_admin" ON bookings
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- ---- AUDIT LOGS ----
DROP POLICY IF EXISTS "audit_logs_select_admin" ON audit_logs;
CREATE POLICY "audit_logs_select_admin" ON audit_logs
  FOR SELECT TO authenticated
  USING (is_admin());
-- No INSERT/UPDATE/DELETE policies - append-only via RPC functions

-- ---- NOTIFICATIONS ----
DROP POLICY IF EXISTS "notifications_select_own" ON notifications;
CREATE POLICY "notifications_select_own" ON notifications
  FOR SELECT TO authenticated
  USING (member_id = get_current_member_id());

DROP POLICY IF EXISTS "notifications_insert_admin" ON notifications;
CREATE POLICY "notifications_insert_admin" ON notifications
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "notifications_update_own" ON notifications;
CREATE POLICY "notifications_update_own" ON notifications
  FOR UPDATE TO authenticated
  USING (member_id = get_current_member_id())
  WITH CHECK (member_id = get_current_member_id());

DROP POLICY IF EXISTS "notifications_delete_admin" ON notifications;
CREATE POLICY "notifications_delete_admin" ON notifications
  FOR DELETE TO authenticated
  USING (is_admin());

-- ---- SETTINGS ----
DROP POLICY IF EXISTS "settings_select_all" ON settings;
CREATE POLICY "settings_select_all" ON settings
  FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "settings_insert_admin" ON settings;
CREATE POLICY "settings_insert_admin" ON settings
  FOR INSERT TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "settings_update_admin" ON settings;
CREATE POLICY "settings_update_admin" ON settings
  FOR UPDATE TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "settings_delete_super_admin" ON settings;
CREATE POLICY "settings_delete_super_admin" ON settings
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- ============================================================
-- 7. TRIGGERS
-- ============================================================

-- Auto-update updated_at on all tables with that column
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_members_updated_at ON members;
CREATE TRIGGER trg_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_wallets_updated_at ON wallets;
CREATE TRIGGER trg_wallets_updated_at
  BEFORE UPDATE ON wallets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_vouchers_updated_at ON vouchers;
CREATE TRIGGER trg_vouchers_updated_at
  BEFORE UPDATE ON vouchers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_rooms_updated_at ON rooms;
CREATE TRIGGER trg_rooms_updated_at
  BEFORE UPDATE ON rooms
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_bookings_updated_at ON bookings;
CREATE TRIGGER trg_bookings_updated_at
  BEFORE UPDATE ON bookings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

DROP TRIGGER IF EXISTS trg_settings_updated_at ON settings;
CREATE TRIGGER trg_settings_updated_at
  BEFORE UPDATE ON settings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- Auto-create member + wallet when a new auth user signs up
-- First user becomes super_admin (bootstrap)
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  new_member_id uuid;
  member_num text;
  member_count int;
  assigned_role text;
BEGIN
  SELECT COUNT(*) INTO member_count FROM members;
  IF member_count = 0 THEN
    assigned_role := 'super_admin';
  ELSE
    assigned_role := 'member';
  END IF;

  member_num := 'M13' || lpad(nextval('member_number_seq')::text, 6, '0');

  INSERT INTO members (user_id, email, full_name, member_number, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'New Member'),
    member_num,
    assigned_role
  )
  RETURNING id INTO new_member_id;

  INSERT INTO wallets (member_id, balance)
  VALUES (new_member_id, 0.00);

  INSERT INTO notifications (member_id, title, message, type)
  VALUES (
    new_member_id,
    'Welcome to M13 Club',
    'Your membership has been created. Your member ID is ' || member_num || '.',
    'success'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- Protect sensitive fields from non-admin modification
CREATE OR REPLACE FUNCTION protect_member_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  IF NOT is_admin() THEN
    NEW.role := OLD.role;
    NEW.status := OLD.status;
  END IF;
  -- These fields are always immutable
  NEW.member_number := OLD.member_number;
  NEW.user_id := OLD.user_id;
  NEW.joined_at := OLD.joined_at;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_protect_member_fields ON members;
CREATE TRIGGER trg_protect_member_fields
  BEFORE UPDATE ON members
  FOR EACH ROW EXECUTE FUNCTION protect_member_fields();
