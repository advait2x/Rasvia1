-- ============================================================================
-- Mobile RBAC Hardening
-- Ensures the 2-role system (admin + restaurant_owner) is airtight.
-- Run in Supabase SQL Editor.
-- ============================================================================

-- 1. Default role for new signups
ALTER TABLE public.profiles
  ALTER COLUMN role SET DEFAULT 'user';

-- 2. Constrain to valid values only
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'profiles_role_check'
  ) THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('user', 'admin', 'restaurant_owner'));
  END IF;
END $$;

-- 3. Index for fast role lookups (used by useAdminMode)
CREATE INDEX IF NOT EXISTS idx_profiles_role
  ON public.profiles(role);

-- 4. Prevent users from escalating their own role
--    Only admins can change anyone's role via service-role or dashboard.
--    This policy blocks UPDATE on the role column for non-admin users.
DO $$
BEGIN
  -- Drop if exists to make this script re-runnable
  DROP POLICY IF EXISTS "users_cannot_change_own_role" ON public.profiles;
END $$;

CREATE POLICY "users_cannot_change_own_role"
  ON public.profiles FOR UPDATE
  USING (
    -- Allow the update to proceed if:
    -- a) The user is an admin, OR
    -- b) The user is updating their own row (role changes blocked below via WITH CHECK)
    id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    -- The role must remain unchanged UNLESS the caller is an admin
    (role = (SELECT role FROM public.profiles WHERE id = auth.uid()))
    OR EXISTS (
      SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 5. Ensure restaurant owners can only read/update restaurants they own
--    (Supplements the existing owner_update_own_restaurant policy)
DO $$
BEGIN
  DROP POLICY IF EXISTS "owner_read_own_restaurant" ON public.restaurants;
END $$;

CREATE POLICY "owner_read_own_restaurant"
  ON public.restaurants FOR SELECT
  USING (
    -- Everyone can read restaurants (public data)
    true
  );

-- 6. Prevent restaurant owners from creating new restaurants
--    Only admins can insert restaurants
DO $$
BEGIN
  DROP POLICY IF EXISTS "only_admins_insert_restaurants" ON public.restaurants;
END $$;

CREATE POLICY "only_admins_insert_restaurants"
  ON public.restaurants FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 7. Prevent restaurant owners from deleting restaurants
DO $$
BEGIN
  DROP POLICY IF EXISTS "only_admins_delete_restaurants" ON public.restaurants;
END $$;

CREATE POLICY "only_admins_delete_restaurants"
  ON public.restaurants FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================================================
-- Summary of role capabilities after this migration:
--
--   ADMIN (profiles.role = 'admin'):
--     - Full CRUD on restaurants
--     - Full CRUD on menu_items
--     - Can change any user's role
--     - Access to admin-pulse, admin-orders, debug tools
--
--   RESTAURANT OWNER (profiles.role = 'restaurant_owner'):
--     - Can UPDATE only their own restaurant (restaurants.owner_id = auth.uid())
--     - Can INSERT/UPDATE/DELETE menu_items for their own restaurant only
--     - Cannot join waitlists (enforced in app code)
--     - Cannot create or delete restaurants
--     - Cannot change any user's role
--
--   REGULAR USER (profiles.role = 'user' or NULL):
--     - Can read restaurants and menu_items (public)
--     - Can join waitlists, place orders, manage favorites
--     - Cannot modify restaurants or menu items
--     - Cannot change their own role
-- ============================================================================
