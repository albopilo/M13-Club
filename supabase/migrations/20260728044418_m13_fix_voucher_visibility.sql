/*
# Fix: Hide vouchers from members (admin-only visibility)

## Issue
Members could see the full list of available vouchers, which is a business security concern.
Vouchers should only be redeemable via code entry, not browsable.

## Changes
1. Update the SELECT policy on `vouchers` so only admins can view vouchers.
   Members can no longer browse the voucher list.
2. Redemption still works via the `redeem_voucher` RPC function (SECURITY DEFINER),
   which validates the code server-side.

## Security
- Members can only redeem by entering a code they received through other channels.
- Admins retain full CRUD access to vouchers.
*/

-- Drop the old select policy that allowed members to see active vouchers
DROP POLICY IF EXISTS "vouchers_select_all" ON vouchers;

-- New policy: only admins can view vouchers
CREATE POLICY "vouchers_select_admin" ON vouchers
  FOR SELECT TO authenticated
  USING (is_admin());
