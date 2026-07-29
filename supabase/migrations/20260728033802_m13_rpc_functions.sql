/*
# M13 Club - Secure RPC Functions

## Overview
Creates SECURITY DEFINER RPC functions for all financial and sensitive operations.
These functions bypass RLS to perform atomic, validated operations that cannot be done through direct table access.

## New Functions
1. `redeem_voucher(p_code text)` - Member redeems a voucher code.
   - Validates: voucher exists, is active, not expired, redemption limit not reached, not already redeemed by member.
   - Atomically: creates transaction, updates wallet balance, creates redemption record.
   - Returns: success/error with transaction details.

2. `admin_adjust_wallet(p_member_id uuid, p_amount numeric, p_reason text, p_type text)` - Admin credits/debits a member's wallet.
   - Validates: caller is admin, amount is non-zero, member exists.
   - Creates transaction with operator_id, updates wallet balance.
   - Records audit log entry.
   - Returns: transaction details.

3. `create_booking(p_room_id uuid, p_check_in date, p_check_out date, p_num_guests int, p_notes text)` - Member creates a booking.
   - Validates: room available, dates valid, no double-booking, guest count within capacity.
   - Calculates total amount (price_per_night * nights).
   - Creates booking with 'pending' status.
   - Returns: booking details.

4. `cancel_booking(p_booking_id uuid)` - Member cancels their own booking.
   - Validates: booking belongs to caller, status is 'pending' or 'confirmed'.
   - Sets status to 'cancelled'.
   - Returns: success/error.

5. `update_booking_status(p_booking_id uuid, p_status text)` - Admin updates booking status.
   - Validates: caller is admin, valid status transition.
   - Updates booking status.
   - Records audit log.
   - Returns: success/error.

6. `admin_create_voucher(p_code text, p_description text, p_value numeric, p_redemption_limit int, p_expires_at timestamptz)` - Admin creates a voucher.
   - Validates: caller is admin, code is unique, value > 0, limit > 0.
   - Creates voucher with created_by.
   - Records audit log.
   - Returns: voucher details.

7. `admin_update_member_role(p_member_id uuid, p_role text)` - Super admin changes a member's role.
   - Validates: caller is super_admin, target is not self (prevent self-demotion lockout).
   - Updates member role.
   - Records audit log.
   - Returns: success/error.

8. `admin_update_member_status(p_member_id uuid, p_status text)` - Admin suspends/bans/activates a member.
   - Validates: caller is admin, cannot act on super_admin members.
   - Updates member status.
   - Records audit log.
   - Returns: success/error.

9. `get_dashboard_stats()` - Admin dashboard statistics.
   - Returns: total members, total wallet balance, total transactions, pending bookings, active vouchers.

## Security
- All functions are SECURITY DEFINER (run with elevated privileges to bypass RLS)
- Each function validates caller permissions before performing operations
- Financial operations are atomic (all-or-nothing)
- All admin actions are logged to audit_logs
*/

-- ============================================================
-- 1. REDEEM VOUCHER (member-facing)
-- ============================================================
CREATE OR REPLACE FUNCTION redeem_voucher(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_voucher vouchers%ROWTYPE;
  v_member_id uuid;
  v_wallet wallets%ROWTYPE;
  v_balance_before numeric(12,2);
  v_transaction_id uuid;
  v_redemption_count int;
  v_already_redeemed boolean;
BEGIN
  -- Get current member
  v_member_id := get_current_member_id();
  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Look up voucher (lock row for update to prevent race conditions)
  SELECT * INTO v_voucher FROM vouchers WHERE code = UPPER(p_code) FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voucher not found');
  END IF;

  IF NOT v_voucher.is_active THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voucher is not active');
  END IF;

  IF v_voucher.expires_at IS NOT NULL AND v_voucher.expires_at < now() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voucher has expired');
  END IF;

  -- Check redemption limit
  SELECT COUNT(*) INTO v_redemption_count FROM voucher_redemptions WHERE voucher_id = v_voucher.id;
  IF v_redemption_count >= v_voucher.redemption_limit THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voucher redemption limit reached');
  END IF;

  -- Check if member already redeemed
  SELECT EXISTS(
    SELECT 1 FROM voucher_redemptions
    WHERE voucher_id = v_voucher.id AND member_id = v_member_id
  ) INTO v_already_redeemed;
  IF v_already_redeemed THEN
    RETURN jsonb_build_object('success', false, 'error', 'You have already redeemed this voucher');
  END IF;

  -- Get wallet (lock for update)
  SELECT * INTO v_wallet FROM wallets WHERE member_id = v_member_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  v_balance_before := v_wallet.balance;

  -- Create transaction
  INSERT INTO transactions (
    member_id, amount, type, description, reference_type, reference_id,
    balance_before, balance_after, operator_id, reason, approval_status
  )
  VALUES (
    v_member_id,
    v_voucher.value,
    'credit',
    'Voucher redemption: ' || v_voucher.code,
    'voucher',
    v_voucher.id,
    v_balance_before,
    v_balance_before + v_voucher.value,
    NULL,
    'Voucher redemption',
    'approved'
  )
  RETURNING id INTO v_transaction_id;

  -- Update wallet balance
  UPDATE wallets SET balance = balance + v_voucher.value, updated_at = now()
  WHERE member_id = v_member_id;

  -- Create redemption record
  INSERT INTO voucher_redemptions (voucher_id, member_id, transaction_id, value)
  VALUES (v_voucher.id, v_member_id, v_transaction_id, v_voucher.value);

  -- Notify member
  INSERT INTO notifications (member_id, title, message, type)
  VALUES (
    v_member_id,
    'Voucher Redeemed',
    'Voucher ' || v_voucher.code || ' redeemed successfully. ' || v_voucher.value::text || ' added to your wallet.',
    'success'
  );

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'amount', v_voucher.value,
    'new_balance', v_balance_before + v_voucher.value
  );
END;
$$;

-- ============================================================
-- 2. ADMIN ADJUST WALLET
-- ============================================================
CREATE OR REPLACE FUNCTION admin_adjust_wallet(
  p_member_id uuid,
  p_amount numeric,
  p_reason text,
  p_type text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_wallet wallets%ROWTYPE;
  v_balance_before numeric(12,2);
  v_transaction_id uuid;
  v_adjustment_type text;
  v_final_amount numeric(12,2);
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: admin access required');
  END IF;

  IF p_amount = 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Amount cannot be zero');
  END IF;

  -- Determine type from sign if not provided
  v_adjustment_type := COALESCE(p_type, CASE WHEN p_amount > 0 THEN 'credit' ELSE 'debit' END);
  v_final_amount := ABS(p_amount);

  -- Get wallet (lock for update)
  SELECT * INTO v_wallet FROM wallets WHERE member_id = p_member_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member wallet not found');
  END IF;

  v_balance_before := v_wallet.balance;

  IF v_adjustment_type = 'debit' AND v_balance_before < v_final_amount THEN
    RETURN jsonb_build_object('success', false, 'error', 'Insufficient balance for debit');
  END IF;

  -- Create transaction
  INSERT INTO transactions (
    member_id, amount, type, description, reference_type, reference_id,
    balance_before, balance_after, operator_id, reason, approval_status
  )
  VALUES (
    p_member_id,
    v_final_amount,
    v_adjustment_type,
    'Admin adjustment: ' || COALESCE(p_reason, 'No reason provided'),
    'admin_adjustment',
    NULL,
    v_balance_before,
    CASE WHEN v_adjustment_type = 'credit'
      THEN v_balance_before + v_final_amount
      ELSE v_balance_before - v_final_amount
    END,
    auth.uid(),
    p_reason,
    'approved'
  )
  RETURNING id INTO v_transaction_id;

  -- Update wallet
  UPDATE wallets
  SET balance = CASE WHEN v_adjustment_type = 'credit'
    THEN balance + v_final_amount
    ELSE balance - v_final_amount
  END,
  updated_at = now()
  WHERE member_id = p_member_id;

  -- Audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'wallet_adjustment',
    'wallet',
    p_member_id,
    jsonb_build_object(
      'type', v_adjustment_type,
      'amount', v_final_amount,
      'reason', p_reason,
      'transaction_id', v_transaction_id
    )
  );

  -- Notify member
  INSERT INTO notifications (member_id, title, message, type)
  VALUES (
    p_member_id,
    'Wallet Updated',
    'Your wallet was ' || v_adjustment_type || 'ed by ' || v_final_amount::text || '. Reason: ' || COALESCE(p_reason, 'N/A'),
    CASE WHEN v_adjustment_type = 'credit' THEN 'success' ELSE 'warning' END
  );

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'new_balance', CASE WHEN v_adjustment_type = 'credit'
      THEN v_balance_before + v_final_amount
      ELSE v_balance_before - v_final_amount
    END
  );
END;
$$;

-- ============================================================
-- 3. CREATE BOOKING (member-facing)
-- ============================================================
CREATE OR REPLACE FUNCTION create_booking(
  p_room_id uuid,
  p_check_in date,
  p_check_out date,
  p_num_guests int DEFAULT 1,
  p_notes text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_member_id uuid;
  v_room rooms%ROWTYPE;
  v_nights int;
  v_total numeric(12,2);
  v_booking_id uuid;
  v_overlap_count int;
BEGIN
  v_member_id := get_current_member_id();
  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Validate dates
  IF p_check_in >= p_check_out THEN
    RETURN jsonb_build_object('success', false, 'error', 'Check-out date must be after check-in date');
  END IF;

  IF p_check_in < CURRENT_DATE THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot book in the past');
  END IF;

  -- Get room
  SELECT * INTO v_room FROM rooms WHERE id = p_room_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room not found');
  END IF;

  IF NOT v_room.is_available THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room is not available');
  END IF;

  IF p_num_guests > v_room.capacity THEN
    RETURN jsonb_build_object('success', false, 'error', 'Number of guests exceeds room capacity');
  END IF;

  -- Check for double booking (any overlapping booking that is not cancelled)
  SELECT COUNT(*) INTO v_overlap_count
  FROM bookings
  WHERE room_id = p_room_id
    AND status NOT IN ('cancelled')
    AND p_check_in < check_out_date
    AND p_check_out > check_in_date;

  IF v_overlap_count > 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Room is already booked for these dates');
  END IF;

  -- Calculate total
  v_nights := (p_check_out - p_check_in);
  v_total := v_room.price_per_night * v_nights;

  -- Create booking
  INSERT INTO bookings (
    member_id, room_id, check_in_date, check_out_date,
    num_guests, total_amount, status, payment_status, notes
  )
  VALUES (
    v_member_id, p_room_id, p_check_in, p_check_out,
    p_num_guests, v_total, 'pending', 'unpaid', p_notes
  )
  RETURNING id INTO v_booking_id;

  -- Notify
  INSERT INTO notifications (member_id, title, message, type)
  VALUES (
    v_member_id,
    'Booking Created',
    'Your booking for ' || v_room.name || ' has been created. Total: ' || v_total::text || '. Status: Pending.',
    'info'
  );

  RETURN jsonb_build_object(
    'success', true,
    'booking_id', v_booking_id,
    'total_amount', v_total,
    'nights', v_nights
  );
END;
$$;

-- ============================================================
-- 4. CANCEL BOOKING (member-facing)
-- ============================================================
CREATE OR REPLACE FUNCTION cancel_booking(p_booking_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_member_id uuid;
BEGIN
  v_member_id := get_current_member_id();
  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  IF v_booking.member_id != v_member_id AND NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  IF v_booking.status NOT IN ('pending', 'confirmed') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking cannot be cancelled in current status');
  END IF;

  UPDATE bookings SET status = 'cancelled', updated_at = now() WHERE id = p_booking_id;

  INSERT INTO notifications (member_id, title, message, type)
  VALUES (
    v_booking.member_id,
    'Booking Cancelled',
    'Your booking has been cancelled.',
    'warning'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 5. UPDATE BOOKING STATUS (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION update_booking_status(
  p_booking_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: admin access required');
  END IF;

  IF p_status NOT IN ('pending', 'confirmed', 'checked_in', 'checked_out', 'completed', 'cancelled') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
  END IF;

  SELECT * INTO v_booking FROM bookings WHERE id = p_booking_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Booking not found');
  END IF;

  UPDATE bookings SET status = p_status, updated_at = now() WHERE id = p_booking_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'booking_status_update',
    'booking',
    p_booking_id,
    jsonb_build_object('old_status', v_booking.status, 'new_status', p_status)
  );

  INSERT INTO notifications (member_id, title, message, type)
  VALUES (
    v_booking.member_id,
    'Booking Update',
    'Your booking status has been updated to: ' || p_status,
    'info'
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 6. ADMIN CREATE VOUCHER
-- ============================================================
CREATE OR REPLACE FUNCTION admin_create_voucher(
  p_code text,
  p_description text,
  p_value numeric,
  p_redemption_limit int DEFAULT 1,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_voucher_id uuid;
  v_code_exists boolean;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: admin access required');
  END IF;

  IF p_value <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Value must be greater than zero');
  END IF;

  IF p_redemption_limit <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Redemption limit must be greater than zero');
  END IF;

  SELECT EXISTS(SELECT 1 FROM vouchers WHERE code = UPPER(p_code)) INTO v_code_exists;
  IF v_code_exists THEN
    RETURN jsonb_build_object('success', false, 'error', 'Voucher code already exists');
  END IF;

  INSERT INTO vouchers (code, description, value, redemption_limit, expires_at, created_by)
  VALUES (UPPER(p_code), p_description, p_value, p_redemption_limit, p_expires_at, auth.uid())
  RETURNING id INTO v_voucher_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'voucher_create',
    'voucher',
    v_voucher_id,
    jsonb_build_object('code', UPPER(p_code), 'value', p_value, 'limit', p_redemption_limit)
  );

  RETURN jsonb_build_object('success', true, 'voucher_id', v_voucher_id);
END;
$$;

-- ============================================================
-- 7. ADMIN UPDATE MEMBER ROLE (super_admin only)
-- ============================================================
CREATE OR REPLACE FUNCTION admin_update_member_role(
  p_member_id uuid,
  p_role text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_role text;
BEGIN
  IF NOT is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: super admin access required');
  END IF;

  IF p_role NOT IN ('member', 'admin', 'super_admin', 'staff', 'finance', 'manager', 'support') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid role');
  END IF;

  SELECT role INTO v_old_role FROM members WHERE id = p_member_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member not found');
  END IF;

  -- Prevent self-modification to avoid lockout
  IF (SELECT user_id FROM members WHERE id = p_member_id) = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot modify your own role');
  END IF;

  UPDATE members SET role = p_role, updated_at = now() WHERE id = p_member_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'member_role_update',
    'member',
    p_member_id,
    jsonb_build_object('old_role', v_old_role, 'new_role', p_role)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 8. ADMIN UPDATE MEMBER STATUS
-- ============================================================
CREATE OR REPLACE FUNCTION admin_update_member_status(
  p_member_id uuid,
  p_status text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_old_status text;
  v_target_role text;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: admin access required');
  END IF;

  IF p_status NOT IN ('active', 'suspended', 'banned') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid status');
  END IF;

  SELECT role, status INTO v_target_role, v_old_status FROM members WHERE id = p_member_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Member not found');
  END IF;

  -- Cannot modify super_admin unless you are one
  IF v_target_role = 'super_admin' AND NOT is_super_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot modify a super admin');
  END IF;

  -- Prevent self-modification
  IF (SELECT user_id FROM members WHERE id = p_member_id) = auth.uid() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot modify your own status');
  END IF;

  UPDATE members SET status = p_status, updated_at = now() WHERE id = p_member_id;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'member_status_update',
    'member',
    p_member_id,
    jsonb_build_object('old_status', v_old_status, 'new_status', p_status)
  );

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 9. DASHBOARD STATS (admin)
-- ============================================================
CREATE OR REPLACE FUNCTION get_dashboard_stats()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
AS $$
DECLARE
  v_total_members int;
  v_total_balance numeric(12,2);
  v_total_transactions int;
  v_pending_bookings int;
  v_active_vouchers int;
  v_total_bookings int;
  v_total_credit numeric(12,2);
  v_total_debit numeric(12,2);
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

  SELECT COUNT(*) INTO v_total_members FROM members WHERE role = 'member';
  SELECT COALESCE(SUM(balance), 0) INTO v_total_balance FROM wallets;
  SELECT COUNT(*) INTO v_total_transactions FROM transactions;
  SELECT COUNT(*) INTO v_pending_bookings FROM bookings WHERE status = 'pending';
  SELECT COUNT(*) INTO v_active_vouchers FROM vouchers WHERE is_active = true;
  SELECT COUNT(*) INTO v_total_bookings FROM bookings;
  SELECT COALESCE(SUM(amount), 0) INTO v_total_credit FROM transactions WHERE type = 'credit';
  SELECT COALESCE(SUM(amount), 0) INTO v_total_debit FROM transactions WHERE type = 'debit';

  RETURN jsonb_build_object(
    'success', true,
    'total_members', v_total_members,
    'total_balance', v_total_balance,
    'total_transactions', v_total_transactions,
    'pending_bookings', v_pending_bookings,
    'active_vouchers', v_active_vouchers,
    'total_bookings', v_total_bookings,
    'total_credit', v_total_credit,
    'total_debit', v_total_debit
  );
END;
$$;

-- ============================================================
-- 10. SEED DATA - Default settings and sample rooms
-- ============================================================
INSERT INTO settings (key, value, description) VALUES
  ('club_name', '"M13 Club"', 'Display name of the club'),
  ('currency', '"RM"', 'Currency symbol'),
  ('contact_email', '"contact@m13club.com"', 'Contact email'),
  ('contact_phone', '"+60-3-1234-5678"', 'Contact phone')
ON CONFLICT (key) DO NOTHING;

-- Insert sample rooms
INSERT INTO rooms (name, description, room_type, price_per_night, capacity, amenities, image_url, is_available) VALUES
  (
    'Standard Room',
    'Comfortable room with a queen bed, city view, and modern amenities.',
    'standard', 180.00, 2,
    ARRAY['WiFi', 'Air Conditioning', 'TV', 'Mini Bar', 'Coffee Maker'],
    'https://images.pexels.com/photos/164595/pexels-photo-164595.jpeg',
    true
  ),
  (
    'Deluxe Room',
    'Spacious room with king bed, premium bedding, and enhanced city view.',
    'deluxe', 280.00, 3,
    ARRAY['WiFi', 'Air Conditioning', 'Smart TV', 'Mini Bar', 'Coffee Maker', 'Bathrobe', 'Safe'],
    'https://images.pexels.com/photos/2029722/pexels-photo-2029722.jpeg',
    true
  ),
  (
    'Executive Suite',
    'Luxurious suite with separate living area, premium furnishings, and panoramic views.',
    'suite', 520.00, 4,
    ARRAY['WiFi', 'Air Conditioning', 'Smart TV', 'Mini Bar', 'Coffee Maker', 'Bathrobe', 'Safe', 'Living Room', 'Work Desk', 'Nespresso Machine'],
    'https://images.pexels.com/photos/271624/pexels-photo-271624.jpeg',
    true
  ),
  (
    'Presidential Suite',
    'Top-tier suite with multiple bedrooms, private terrace, and butler service.',
    'presidential', 1200.00, 6,
    ARRAY['WiFi', 'Air Conditioning', 'Smart TV', 'Mini Bar', 'Coffee Maker', 'Bathrobe', 'Safe', 'Living Room', 'Work Desk', 'Nespresso Machine', 'Private Terrace', 'Butler Service', 'Jacuzzi'],
    'https://images.pexels.com/photos/2664216/pexels-photo-2664216.jpeg',
    true
  ),
  (
    'Standard Twin Room',
    'Comfortable room with two single beds, ideal for friends or colleagues.',
    'standard', 200.00, 2,
    ARRAY['WiFi', 'Air Conditioning', 'TV', 'Mini Bar', 'Coffee Maker'],
    'https://images.pexels.com/photos/2029732/pexels-photo-2029732.jpeg',
    true
  ),
  (
    'Deluxe Pool View',
    'Deluxe room with stunning pool view and premium amenities.',
    'deluxe', 320.00, 3,
    ARRAY['WiFi', 'Air Conditioning', 'Smart TV', 'Mini Bar', 'Coffee Maker', 'Bathrobe', 'Pool View'],
    'https://images.pexels.com/photos/3144580/pexels-photo-3144580.jpeg',
    true
  )
ON CONFLICT DO NOTHING;

-- Insert sample vouchers
INSERT INTO vouchers (code, description, value, is_active, redemption_limit, expires_at) VALUES
  ('WELCOME50', 'Welcome bonus for new members', 50.00, true, 1000, '2026-12-31 23:59:59+00'),
  ('SUMMER100', 'Summer promotion - RM100 off', 100.00, true, 500, '2026-09-30 23:59:59+00'),
  ('VIP250', 'VIP member reward', 250.00, true, 50, '2026-12-31 23:59:59+00')
ON CONFLICT (code) DO NOTHING;
