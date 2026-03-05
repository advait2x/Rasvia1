-- ============================================================================
-- Add a helper function to look up a user's UUID by their email
-- This is needed because auth.users is not directly accessible from the client.
-- Run this in the Supabase SQL Editor.
-- ============================================================================

CREATE OR REPLACE FUNCTION public.get_user_id_by_email(lookup_email text)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT id FROM auth.users WHERE email = lower(trim(lookup_email)) LIMIT 1;
$$;

COMMENT ON FUNCTION public.get_user_id_by_email IS 
'Looks up a user UUID by email. Used when adding staff members to a restaurant. Safe to call from the frontend — only returns the UUID, not any sensitive data.';
