-- ============================================================================
-- FIX v2: Roles RLS — use SECURITY DEFINER helpers to avoid ALL self-references
-- Run this in the Supabase SQL Editor.
-- ============================================================================
-- 
-- ROOT CAUSE: RLS policies on restaurant_staff / restaurant_roles / 
-- role_permissions all subquery restaurant_staff to determine access.
-- When restaurant_staff's OWN policy also subqueries restaurant_staff,
-- PostgreSQL either hits infinite recursion or silently returns 0 rows.
--
-- FIX: Create two tiny SECURITY DEFINER functions that bypass RLS,
-- then use those in all policies so no table ever references itself.
-- ============================================================================

-- ── Helper functions (bypass RLS) ───────────────────────────────────────────

-- Returns the restaurant_id for the currently logged-in user (or NULL)
CREATE OR REPLACE FUNCTION public.get_my_restaurant_id()
RETURNS bigint
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT restaurant_id FROM restaurant_staff WHERE user_id = auth.uid() LIMIT 1;
$$;

-- Returns TRUE if the current user has admin/owner role at their restaurant
CREATE OR REPLACE FUNCTION public.am_i_restaurant_admin()
RETURNS boolean
LANGUAGE sql STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT EXISTS (
        SELECT 1 FROM restaurant_staff
        WHERE user_id = auth.uid()
          AND (role = 'admin' OR role = 'owner')
    );
$$;

-- ── Drop ALL old policies on these three tables ─────────────────────────────

-- restaurant_staff
DROP POLICY IF EXISTS "Staff can view own link"          ON public.restaurant_staff;
DROP POLICY IF EXISTS "Staff can view restaurant team"   ON public.restaurant_staff;
DROP POLICY IF EXISTS "Owners can manage staff"          ON public.restaurant_staff;

-- restaurant_roles
DROP POLICY IF EXISTS "Staff can view own restaurant roles" ON public.restaurant_roles;
DROP POLICY IF EXISTS "Owners can manage roles"             ON public.restaurant_roles;

-- role_permissions
DROP POLICY IF EXISTS "Staff can view role permissions"     ON public.role_permissions;
DROP POLICY IF EXISTS "Owners can manage role permissions"  ON public.role_permissions;

-- ── Recreate policies using the helper functions ────────────────────────────

-- restaurant_staff: staff see their whole team, admins can CRUD
CREATE POLICY "Staff can view restaurant team"
    ON public.restaurant_staff FOR SELECT
    USING (restaurant_id = get_my_restaurant_id());

CREATE POLICY "Owners can manage staff"
    ON public.restaurant_staff FOR ALL
    USING (restaurant_id = get_my_restaurant_id() AND am_i_restaurant_admin())
    WITH CHECK (restaurant_id = get_my_restaurant_id() AND am_i_restaurant_admin());

-- restaurant_roles: staff can read, admins can CRUD
CREATE POLICY "Staff can view own restaurant roles"
    ON public.restaurant_roles FOR SELECT
    USING (restaurant_id = get_my_restaurant_id());

CREATE POLICY "Owners can manage roles"
    ON public.restaurant_roles FOR ALL
    USING (restaurant_id = get_my_restaurant_id() AND am_i_restaurant_admin())
    WITH CHECK (restaurant_id = get_my_restaurant_id() AND am_i_restaurant_admin());

-- role_permissions: staff can read their restaurant's perms, admins can CRUD
CREATE POLICY "Staff can view role permissions"
    ON public.role_permissions FOR SELECT
    USING (role_id IN (
        SELECT id FROM restaurant_roles WHERE restaurant_id = get_my_restaurant_id()
    ));

CREATE POLICY "Owners can manage role permissions"
    ON public.role_permissions FOR ALL
    USING (
        am_i_restaurant_admin()
        AND role_id IN (SELECT id FROM restaurant_roles WHERE restaurant_id = get_my_restaurant_id())
    )
    WITH CHECK (
        am_i_restaurant_admin()
        AND role_id IN (SELECT id FROM restaurant_roles WHERE restaurant_id = get_my_restaurant_id())
    );
