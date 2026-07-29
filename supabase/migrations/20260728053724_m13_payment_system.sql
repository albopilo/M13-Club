/*
# Payment System: Branches, Transaction PIN, Process Payment

## Overview
Replaces the booking system with a payment system. Members make payments at branch
stores using a 4-digit transaction PIN. Staff can view payment logs.

## New Tables
1. `branches` - Branch store locations where members make payments
   - `id` (uuid PK)
   - `name` (text, not null)
   - `address` (text, nullable)
   - `is_active` (boolean, default true)
   - `created_by` (uuid, FK to auth.users)
   - `created_at`, `updated_at` (timestamps)

## Modified Tables
1. `members` - Added `transaction_pin` column (text, nullable) for storing hashed PIN
2. `transactions` - Added `branch_id` column (uuid, nullable, FK to branches) and
   `branch_name` (text, nullable) for denormalized branch name in logs

## New RPC Functions
1. `set_transaction_pin(p_pin, p_current_pin)` - Creates or updates a member's 4-digit
   transaction PIN. First-time setup requires no current PIN; updates require the old PIN.
2. `process_payment(p_amount, p_branch_id, p_pin)` - Processes a payment:
   - Verifies the member's PIN
   - Checks that wallet balance >= amount (declines if insufficient)
   - Creates a debit transaction with branch info
   - Deducts from wallet balance
   - Returns success/failure with new balance
3. `get_payment_logs(p_limit, p_offset)` - Returns payment log entries for staff/admin
   with member name, branch name, amount, and timestamp.

## Security
- `branches`: All authenticated users can SELECT (members need to see branches for
  payment). Only super_admin can INSERT/UPDATE/DELETE.
- `transaction_pin` is hashed using pgcrypto's crypt()/gen_salt() - never stored in
  plaintext.
- PIN verification uses crypt() to compare.
- Balance check is inside the RPC function (SECURITY DEFINER) so it cannot be bypassed.
- Payment logs: staff and admin roles can access all logs; members can only see their own.

## Extensions
- Requires `pgcrypto` extension for PIN hashing (already enabled in Supabase by default).
*/

-- Ensure pgcrypto is available for crypt() and gen_salt()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1. branches table
-- ============================================================
CREATE TABLE IF NOT EXISTS branches (
  id uuid PRIMARY KEY DEFAULT extensions.gen_random_uuid(),
  name text NOT NULL,
  address text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE branches ENABLE ROW LEVEL SECURITY;

-- All authenticated users can see active branches (needed for payment)
DROP POLICY IF EXISTS "branches_select_all" ON branches;
CREATE POLICY "branches_select_all" ON branches
  FOR SELECT TO authenticated
  USING (is_active = true);

-- Only super_admin can create branches
DROP POLICY IF EXISTS "branches_insert_super_admin" ON branches;
CREATE POLICY "branches_insert_super_admin" ON branches
  FOR INSERT TO authenticated
  WITH CHECK (is_super_admin());

-- Only super_admin can update branches
DROP POLICY IF EXISTS "branches_update_super_admin" ON branches;
CREATE POLICY "branches_update_super_admin" ON branches
  FOR UPDATE TO authenticated
  USING (is_super_admin()) WITH CHECK (is_super_admin());

-- Only super_admin can delete branches
DROP POLICY IF EXISTS "branches_delete_super_admin" ON branches;
CREATE POLICY "branches_delete_super_admin" ON branches
  FOR DELETE TO authenticated
  USING (is_super_admin());

-- ============================================================
-- 2. Add transaction_pin to members
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'members' AND column_name = 'transaction_pin'
  ) THEN
    ALTER TABLE members ADD COLUMN transaction_pin text;
  END IF;
END $$;

-- ============================================================
-- 3. Add branch_id and branch_name to transactions
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'branch_id'
  ) THEN
    ALTER TABLE transactions ADD COLUMN branch_id uuid REFERENCES branches(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'transactions' AND column_name = 'branch_name'
  ) THEN
    ALTER TABLE transactions ADD COLUMN branch_name text;
  END IF;
END $$;

-- ============================================================
-- 4. RPC: set_transaction_pin
-- ============================================================
CREATE OR REPLACE FUNCTION set_transaction_pin(p_pin text, p_current_pin text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_existing_pin text;
BEGIN
  -- Validate PIN format (exactly 4 digits)
  IF p_pin !~ '^\d{4}$' THEN
    RETURN jsonb_build_object('success', false, 'error', 'PIN must be exactly 4 digits');
  END IF;

  v_member_id := get_current_member_id();
  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT transaction_pin INTO v_existing_pin FROM members WHERE id = v_member_id;

  -- If PIN already set, require the current PIN to change it
  IF v_existing_pin IS NOT NULL THEN
    IF p_current_pin IS NULL OR extensions.crypt(p_current_pin, v_existing_pin) != v_existing_pin THEN
      RETURN jsonb_build_object('success', false, 'error', 'Current PIN is incorrect');
    END IF;
  END IF;

  -- Hash and store the new PIN
  UPDATE members
SET transaction_pin = extensions.crypt(
    p_pin,
    extensions.gen_salt('bf')
)  WHERE id = v_member_id;

  RETURN jsonb_build_object('success', true);
END;
$$;

-- ============================================================
-- 5. RPC: process_payment
-- ============================================================
CREATE OR REPLACE FUNCTION process_payment(p_amount numeric, p_branch_id uuid, p_pin text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_wallet wallets%ROWTYPE;
  v_balance_before numeric(12,2);
  v_transaction_id uuid;
  v_stored_pin text;
  v_branch branches%ROWTYPE;
  v_transaction_type text;
BEGIN
  -- Validate amount
  IF p_amount IS NULL OR p_amount <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid amount');
  END IF;

  -- Get current member
  v_member_id := get_current_member_id();
  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  -- Verify PIN
  SELECT transaction_pin INTO v_stored_pin FROM members WHERE id = v_member_id;
  IF v_stored_pin IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Please set up your transaction PIN first');
  END IF;

  IF extensions.crypt(p_pin, v_stored_pin) != v_stored_pin THEN
    RETURN jsonb_build_object('success', false, 'error', 'Incorrect PIN');
  END IF;

  -- Validate branch
  SELECT * INTO v_branch FROM branches WHERE id = p_branch_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid branch');
  END IF;

  -- Lock wallet row and check balance
  SELECT * INTO v_wallet FROM wallets WHERE member_id = v_member_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Wallet not found');
  END IF;

  v_balance_before := v_wallet.balance;

  -- CRITICAL: Check if balance is sufficient - payment declined if not
  IF v_balance_before < p_amount THEN
    RETURN jsonb_build_object(
      'success', false,
      'error', 'Payment declined: insufficient balance',
      'balance', v_balance_before
    );
  END IF;

  -- Create transaction (debit)
  INSERT INTO transactions (
    member_id, amount, type, description, reference_type, reference_id,
    balance_before, balance_after, operator_id, reason, approval_status,
    branch_id, branch_name
  )
  VALUES (
    v_member_id,
    p_amount,
    'debit',
    'Payment at ' || v_branch.name,
    'payment',
    NULL,
    v_balance_before,
    v_balance_before - p_amount,
    NULL,
    'Member payment at ' || v_branch.name,
    'approved',
    p_branch_id,
    v_branch.name
  )
  RETURNING id INTO v_transaction_id;

  -- Update wallet balance
  UPDATE wallets SET balance = balance - p_amount, updated_at = now()
  WHERE member_id = v_member_id;

  -- Notify member
  INSERT INTO notifications (member_id, title, message, type)
  VALUES (
    v_member_id,
    'Payment Successful',
    'Payment of MC ' || p_amount::text || ' at ' || v_branch.name || ' was successful. New balance: MC ' || (v_balance_before - p_amount)::text,
    'success'
  );

  RETURN jsonb_build_object(
    'success', true,
    'transaction_id', v_transaction_id,
    'new_balance', v_balance_before - p_amount,
    'branch_name', v_branch.name,
    'amount', p_amount
  );
END;
$$;

-- ============================================================
-- 6. RPC: get_payment_logs
-- Returns all payment transactions (debit type with branch_id) for staff/admin
-- ============================================================
CREATE OR REPLACE FUNCTION get_payment_logs(p_limit int DEFAULT 100, p_offset int DEFAULT 0)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_role text;
BEGIN
  v_member_id := get_current_member_id();
  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  SELECT role INTO v_role FROM members WHERE id = v_member_id;

  -- Only staff, admin, super_admin, manager, finance can view all payment logs
  IF v_role NOT IN ('staff', 'admin', 'super_admin', 'manager', 'finance') THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized');
  END IF;

RETURN COALESCE(
  (
    SELECT jsonb_agg(row_data)
    FROM (
      SELECT
        jsonb_build_object(
          'id', t.id,
          'amount', t.amount,
          'member_name', m.full_name,
          'member_number', m.member_number,
          'branch_name', COALESCE(t.branch_name, 'N/A'),
          'description', t.description,
          'balance_before', t.balance_before,
          'balance_after', t.balance_after,
          'created_at', t.created_at
        ) AS row_data
      FROM transactions t
      JOIN members m
        ON m.id = t.member_id
      WHERE
        t.type = 'debit'
        AND t.reference_type = 'payment'
      ORDER BY t.created_at DESC
      LIMIT p_limit
      OFFSET p_offset
    ) q
  ),
  '[]'::jsonb
);
END;
$$;

-- ============================================================
-- 7. Grant execute on new RPC functions
-- ============================================================
GRANT EXECUTE ON FUNCTION set_transaction_pin(text, text) TO authenticated;
GRANT EXECUTE ON FUNCTION process_payment(numeric, uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION get_payment_logs(int, int) TO authenticated;

-- ============================================================
-- 8. Seed a few default branches
-- ============================================================
INSERT INTO branches (name, address)
SELECT 'M13 HQ', 'Kuala Lumpur, Malaysia'
WHERE NOT EXISTS (SELECT 1 FROM branches LIMIT 1);

INSERT INTO branches (name, address)
SELECT 'M13 Branch Penang', 'Penang, Malaysia'
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE name = 'M13 Branch Penang');

INSERT INTO branches (name, address)
SELECT 'M13 Branch Johor', 'Johor Bahru, Malaysia'
WHERE NOT EXISTS (SELECT 1 FROM branches WHERE name = 'M13 Branch Johor');
