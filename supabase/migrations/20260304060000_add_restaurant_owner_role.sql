-- ============================================================
-- Restaurant Owner Role: Run this in the Supabase SQL Editor
-- ============================================================

-- 1. Add owner_id column to restaurants
--    Links each restaurant to the Supabase user who owns it.
ALTER TABLE public.restaurants
  ADD COLUMN IF NOT EXISTS owner_id UUID REFERENCES auth.users(id);

-- 2. Create an index for fast lookups by owner
CREATE INDEX IF NOT EXISTS idx_restaurants_owner
  ON public.restaurants(owner_id);

-- ============================================================
-- After running the above, set role + owner_id for each owner:
--
--   UPDATE public.profiles
--   SET role = 'restaurant_owner'
--   WHERE id = '<user-uuid>';
--
--   UPDATE public.restaurants
--   SET owner_id = '<user-uuid>'
--   WHERE id = <restaurant_id>;
-- ============================================================

-- 3. RLS: Allow owners to update ONLY their own restaurant
--    (Dev admins bypass this via their existing authenticated policy.)
CREATE POLICY "owner_update_own_restaurant"
  ON public.restaurants FOR UPDATE
  USING (
    owner_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 4. RLS: Lock menu_item writes to owner's restaurant only
--    First, check existing permissive policies:
--      SELECT * FROM pg_policies WHERE tablename = 'menu_items';
--    If there is a broad UPDATE policy (role = 'authenticated'), drop it:
--      DROP POLICY IF EXISTS "auth_update_menu_items" ON public.menu_items;
--      DROP POLICY IF EXISTS "auth_delete_menu_items" ON public.menu_items;
--      DROP POLICY IF EXISTS "auth_insert_menu_items" ON public.menu_items;
--    Then run the scoped ones below:

CREATE POLICY "owner_update_own_menu_items"
  ON public.menu_items FOR UPDATE
  USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "owner_insert_own_menu_items"
  ON public.menu_items FOR INSERT
  WITH CHECK (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "owner_delete_own_menu_items"
  ON public.menu_items FOR DELETE
  USING (
    restaurant_id IN (
      SELECT id FROM public.restaurants WHERE owner_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
