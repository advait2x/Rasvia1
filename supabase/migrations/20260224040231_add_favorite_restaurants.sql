-- Add favorite_restaurants array to profiles table
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS favorite_restaurants BIGINT[] DEFAULT '{}'::BIGINT[];

-- Update RLS policies to ensure users can read/write their own favorites along with their profile data
-- The existing policies on profiles likely cover this, but we'll ensure they are robust.
-- Usually, there is a policy like:
-- CREATE POLICY "Users can update own profile." ON profiles FOR UPDATE USING (auth.uid() = id);
-- CREATE POLICY "Public profiles are viewable by everyone." ON profiles FOR SELECT USING (true);
