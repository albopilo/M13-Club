/*
# Fix: handle_new_user search_path

## Issue
The `handle_new_user` trigger function (SECURITY DEFINER) was failing during signup
because it didn't have an explicit `search_path`. When Supabase auth triggers fire,
the search_path may not include the `public` schema, causing table references to fail.

## Fix
Recreate the `handle_new_user` function with `SET search_path = public` to ensure
all table references (members, wallets, notifications, member_number_seq) resolve
correctly regardless of the caller's search_path.

Also add `SET search_path = public` to all other SECURITY DEFINER functions for safety.
*/

-- Fix handle_new_user
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Fix is_admin
CREATE OR REPLACE FUNCTION is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE user_id = auth.uid()
    AND role IN ('admin', 'super_admin', 'manager', 'finance')
    AND status = 'active'
  );
$$;

-- Fix is_super_admin
CREATE OR REPLACE FUNCTION is_super_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM members
    WHERE user_id = auth.uid()
    AND role = 'super_admin'
    AND status = 'active'
  );
$$;

-- Fix get_current_member_id
CREATE OR REPLACE FUNCTION get_current_member_id()
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT id FROM members WHERE user_id = auth.uid();
$$;

-- Fix protect_member_fields
CREATE OR REPLACE FUNCTION protect_member_fields()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT is_admin() THEN
    NEW.role := OLD.role;
    NEW.status := OLD.status;
  END IF;
  NEW.member_number := OLD.member_number;
  NEW.user_id := OLD.user_id;
  NEW.joined_at := OLD.joined_at;
  RETURN NEW;
END;
$$;
