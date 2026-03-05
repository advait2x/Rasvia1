-- ============================================================================
-- FIX: party_sessions Row-Level Security
-- "new row violates row-level security policy for table 'party_sessions'"
--
-- The table only has a SELECT policy. We need INSERT, UPDATE, and DELETE
-- policies so authenticated users can create / manage their own sessions.
--
-- Run this in the Supabase SQL Editor (Dashboard → SQL Editor → New query).
-- ============================================================================

-- Allow authenticated users to create a group order session (they become host)
CREATE POLICY "Authenticated users can create sessions"
    ON public.party_sessions
    FOR INSERT
    TO authenticated
    WITH CHECK (host_user_id = auth.uid());

-- Allow the host to update their own session (e.g. change status to 'submitted')
CREATE POLICY "Host can update own session"
    ON public.party_sessions
    FOR UPDATE
    TO authenticated
    USING (host_user_id = auth.uid())
    WITH CHECK (host_user_id = auth.uid());

-- Allow the host to delete / cancel their own session
CREATE POLICY "Host can delete own session"
    ON public.party_sessions
    FOR DELETE
    TO authenticated
    USING (host_user_id = auth.uid());
