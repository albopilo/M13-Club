/*
# Bulk Create Vouchers RPC

## Overview
Adds an admin RPC function to bulk-create multiple voucher codes at once
for the sales page. Each generated voucher gets a unique code by appending
a sequential number to the provided prefix.

## New RPC Functions
1. `admin_bulk_create_vouchers(p_code_prefix text, p_description text, p_value numeric, p_quantity int, p_redemption_limit int, p_expires_at timestamptz)`
   - Validates: caller is admin, value > 0, quantity > 0, limit > 0, prefix is non-empty
   - Generates `p_quantity` voucher codes by appending -001, -002, etc. to the prefix
   - Each code is unique (checks for collisions)
   - Creates audit log entry summarizing the bulk creation
   - Returns: success with count of created vouchers

## Security
- SECURITY DEFINER function, only callable by admin roles (is_admin check)
- GRANT EXECUTE TO authenticated
*/

CREATE OR REPLACE FUNCTION admin_bulk_create_vouchers(
  p_code_prefix text,
  p_description text,
  p_value numeric,
  p_quantity int DEFAULT 1,
  p_redemption_limit int DEFAULT 1,
  p_expires_at timestamptz DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count int := 0;
  v_code text;
  v_voucher_id uuid;
  v_existing_count int;
  v_i int;
  v_suffix text;
BEGIN
  IF NOT is_admin() THEN
    RETURN jsonb_build_object('success', false, 'error', 'Unauthorized: admin access required');
  END IF;

  IF p_code_prefix IS NULL OR TRIM(p_code_prefix) = '' THEN
    RETURN jsonb_build_object('success', false, 'error', 'Code prefix is required');
  END IF;

  IF p_value IS NULL OR p_value <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Value must be greater than zero');
  END IF;

  IF p_quantity IS NULL OR p_quantity <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Quantity must be greater than zero');
  END IF;

  IF p_quantity > 1000 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Cannot create more than 1000 vouchers at once');
  END IF;

  IF p_redemption_limit IS NULL OR p_redemption_limit <= 0 THEN
    RETURN jsonb_build_object('success', false, 'error', 'Redemption limit must be greater than zero');
  END IF;

  FOR v_i IN 1..p_quantity LOOP
    v_suffix := lpad(v_i::text, 3, '0');
    v_code := UPPER(TRIM(p_code_prefix)) || '-' || v_suffix;

    -- Check if code already exists, skip if so
    SELECT COUNT(*) INTO v_existing_count FROM vouchers WHERE code = v_code;
    IF v_existing_count > 0 THEN
      CONTINUE;
    END IF;

    INSERT INTO vouchers (code, description, value, is_active, redemption_limit, expires_at, created_by, status)
    VALUES (v_code, p_description, p_value, true, p_redemption_limit, p_expires_at, auth.uid(), 'available')
    RETURNING id INTO v_voucher_id;

    v_count := v_count + 1;
  END LOOP;

  INSERT INTO audit_logs (actor_id, action, entity_type, entity_id, details)
  VALUES (
    auth.uid(),
    'voucher_bulk_create',
    'voucher',
    NULL,
    jsonb_build_object(
      'prefix', UPPER(TRIM(p_code_prefix)),
      'description', p_description,
      'value', p_value,
      'quantity', p_quantity,
      'created_count', v_count,
      'redemption_limit', p_redemption_limit
    )
  );

  RETURN jsonb_build_object(
    'success', true,
    'created_count', v_count
  );
END;
$$;

GRANT EXECUTE ON FUNCTION admin_bulk_create_vouchers(text, text, numeric, int, int, timestamptz) TO authenticated;
