-- ============================================================================
-- MAKE USER ADMIN & RESTAURANT OWNER
-- Paste this into the Supabase SQL Editor and run it.
-- This grants mattarithwik@gmail.com full access to "Biryani Pot".
-- ============================================================================

DO $$
DECLARE
    target_user_id uuid;
BEGIN
    -- 1. Find the user by their email
    SELECT id INTO target_user_id
    FROM auth.users
    WHERE email = 'mattarithwik@gmail.com';

    -- Make sure we found the user
    IF target_user_id IS NULL THEN
        RAISE EXCEPTION 'User not found. Check if the email is exactly correct.';
    END IF;

    -- 2. Upgrade their profile role
    UPDATE public.profiles
    SET role = 'admin'
    WHERE id = target_user_id;

    -- 3. Link them to Restaurant #1 (Biryani Pot) as Owner
    INSERT INTO public.restaurant_staff (user_id, restaurant_id, role)
    VALUES (target_user_id, 1, 'admin')
    ON CONFLICT DO NOTHING;

    -- 4. Optionally, make them the official owner of the row in the restaurants table
    UPDATE public.restaurants
    SET owner_id = target_user_id
    WHERE id = 1;

END $$;
