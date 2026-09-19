/*
# Voucher Sales Categories & Random Reveal

## Overview
Reworks the voucher sales flow so staff select a voucher category (grouped by MC value)
from a dropdown, then a random available voucher code from that category is revealed.
Once revealed, a voucher is marked "sold" and cannot be revealed again.

## Modified Tables
1. `vouchers` — Added 4 new columns:
   - `status` (text, default 'available', CHECK in 'available','sold'): tracks whether
     a voucher is still revealable by staff. Existing rows default to 'available'.
   - `sold_by` (uuid, nullable, FK to members): the staff member who sold it.
   - `sold_at` (timestamptz, nullable): when the sale happened.
   - `revealed_at` (timestamptz, nullable): when the code was revealed to staff.

## New RPC Functions
1. `get_voucher_categories()` — Returns distinct MC values that have at least one
   available, active voucher. Each row includes the value and the count of available
   codes. Accessible by staff and admin roles.

2. `sell_voucher_by_category(p_value numeric)` — Atomically picks one random available
   voucher matching the given MC value, marks it "sold", records sold_by/sold_at/
   revealed_at, logs to audit_logs, and returns the voucher code + details.
   Only staff and admin roles can call this.

## Security
- Updated `vouchers` SELECT policy to allow staff (in addition to admin) to view
  vouchers, so they can populate the category dropdown and see voucher details.
- UPDATE remains admin-only via RLS, but the new `sell_voucher_by_category` RPC
  (SECURITY DEFINER) performs the update with elevated privileges after verifying
  the caller is staff or admin.
- INSERT/DELETE policies unchanged.
*/

-- ============================================================
-- 1. Add status / sold_by / sold_at / revealed_at to vouchers
-- ============================================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vouchers' AND column_name = 'status'
  ) THEN
    ALTER TABLE vouchers ADD COLUMN status text NOT NULL DEFAULT 'available'
      CHECK (status IN ('available', 'sold'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vouchers' AND column_name = 'sold_by'
  ) THEN
    ALTER TABLE vouchers ADD COLUMN sold_by uuid REFERENCES members(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vouchers' AND column_name = 'sold_at'
  ) THEN
    ALTER TABLE vouchers ADD COLUMN sold_at timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'vouchers' AND column_name = 'revealed_at'
  ) THEN
    ALTER TABLE vouchers ADD COLUMN revealed_at timestamptz;
  END IF;
END $$;

-- Index for fast category lookups
CREATE INDEX IF NOT EXISTS idx_vouchers_status_value ON vouchers(status, value) WHERE is_active = true;

-- ============================================================
-- 2. Helper: is_staff_or_admin()
-- ============================================================
CREATE OR REPLACE FUNCTION is_staff_or_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE user_id = auth.uid()
    AND role IN ('staff', 'admin', 'super_admin', 'manager', 'finance')
    AND status = 'active'
  );
$$;

-- ============================================================
-- 3. Update vouchers SELECT policy to include staff
-- ============================================================
DROP POLICY IF EXISTS "vouchers_select_admin" ON vouchers;
DROP POLICY IF EXISTS "vouchers_select_staff_or_admin" ON vouchers;

CREATE POLICY "vouchers_select_staff_or_admin" ON vouchers
  FOR SELECT TO authenticated
  USING (is_staff_or_admin());

-- ============================================================
-- 4. RPC: get_voucher_categories()
-- ============================================================
CREATE OR REPLACE FUNCTION get_voucher_categories()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_staff_or_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: staff or admin access required');
  END IF;

  RETURN COALESCE(
    (
      SELECT jsonb_agg(row_data)
      FROM (
        SELECT
          jsonb_build_object(
            'value', value,
            'available_count', COUNT(*)
          ) AS row_data
        FROM vouchers
        WHERE is_active = true
          AND status = 'available'
          AND (expires_at IS NULL OR expires_at > now())
        GROUP BY value
        ORDER BY value ASC
      ) q
    ),
    '[]'::jsonb
  );
END;
$$;

GRANT EXECUTE ON FUNCTION get_voucher_categories() TO authenticated;

-- ============================================================
-- 5. RPC: sell_voucher_by_category(p_value numeric)
-- ============================================================
CREATE OR REPLACE FUNCTION sell_voucher_by_category(p_value numeric)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_member_id uuid;
  v_voucher vouchers%ROWTYPE;
  v_now timestamptz := now();
BEGIN
  v_member_id := get_current_member_id();
  IF v_member_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'error', 'Not authenticated');
  END IF;

  IF NOT is_staff_or_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: staff or admin access required');
  END IF;

  IF p_value IS NULL OR p_value <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid voucher value');
  END IF;

  -- Atomically pick one random available voucher matching the value
  SELECT * INTO v_voucher
  FROM vouchers
  WHERE value = p_value
    AND is_active = true
    AND status = 'available'
    AND (expires_at IS NULL OR expires_at > now())
  ORDER BY random()
  LIMIT 1
  FOR UPDATE SKIP LOCKED;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'No available vouchers in this category');
  END IF;

  -- Mark as sold
  UPDATE vouchers
  SET status = 'sold',
      sold_by = v_member_id,
      sold_at = v_now,
      revealed_at = v_now,
      updated_at = v_now
  WHERE id = v_voucher.id AND status = 'available';

  -- Audit log
  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'voucher_sold',
    'voucher',
    v_voucher.id,
    jsonb_build_object(
      'code', v_voucher.code,
      'value', v_voucher.value,
      'description', v_voucher.description
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'voucher_id', v_voucher.id,
    'code', v_voucher.code,
    'description', v_voucher.description,
    'value', v_voucher.value
  );
END;
$$;

GRANT EXECUTE ON FUNCTION sell_voucher_by_category(numeric) TO authenticated;