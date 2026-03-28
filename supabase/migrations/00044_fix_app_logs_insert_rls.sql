-- Fix app_logs INSERT policy.
-- The original policy (00002) required auth.uid() = user_id, which blocks inserts
-- when user_id is null or doesn't match. Migration 00011 attempted to fix this,
-- but the policy may not have been applied on the cloud instance.
-- This migration ensures the correct permissive policy is in place.

DROP POLICY IF EXISTS "Users can insert own logs" ON public.app_logs;

CREATE POLICY "Users can insert own logs" ON public.app_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
