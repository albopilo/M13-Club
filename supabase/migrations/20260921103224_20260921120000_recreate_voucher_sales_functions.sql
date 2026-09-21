/*
# Recreate Voucher Sales RPC Functions

## Why
The `get_voucher_categories()` and `sell_voucher_by_category(numeric)` functions
exist in pg_proc but PostgREST returns 404 for them — its schema cache does not
expose them. Recreating the functions (DROP + CREATE) forces PostgREST to
re-detect them on the next schema cache refresh.

## What changes
1. Drops and re-creates `is_staff_or_admin()` helper.
2. Drops and re-creates `get_voucher_categories()` — returns available voucher
   categories grouped by MC value, with available count.
3. Drops and re-creates `sell_voucher_by_category(p_value numeric)` — atomically
   picks a random available voucher, marks it sold, logs to audit_logs.
4. Re-grants EXECUTE to `authenticated`.

## Security
- All functions are SECURITY DEFINER with `search_path = public`.
- `get_voucher_categories` and `sell_voucher_by_category` check `is_staff_or_admin()`
  before performing any work.
- Vouchers SELECT policy updated to allow staff + admin roles.
*/

-- ============================================================
-- 1. Helper: is_staff_or_admin()
-- ============================================================
DROP FUNCTION IF EXISTS is_staff_or_admin() CASCADE;
DROP FUNCTION IF EXISTS is_voucher_seller() CASCADE;

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

GRANT EXECUTE ON FUNCTION is_staff_or_admin() TO authenticated;

-- ============================================================
-- 2. Update vouchers SELECT policy to include staff
-- ============================================================
ALTER TABLE vouchers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "vouchers_select_admin" ON vouchers;
DROP POLICY IF EXISTS "vouchers_select_staff_or_admin" ON vouchers;

CREATE POLICY "vouchers_select_staff_or_admin" ON vouchers
  FOR SELECT TO authenticated
  USING (is_staff_or_admin());

-- ============================================================
-- 3. RPC: get_voucher_categories()
-- ============================================================
DROP FUNCTION IF EXISTS get_voucher_categories() CASCADE;

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
-- 4. RPC: sell_voucher_by_category(p_value numeric)
-- ============================================================
DROP FUNCTION IF EXISTS sell_voucher_by_category(numeric) CASCADE;

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

-- Force PostgREST schema cache reload
NOTIFY pgrst, 'reload schema';
