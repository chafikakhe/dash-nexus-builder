-- ============================================================
-- 001_ADD_OWNER_ID_TO_ORGS.sql
-- Migration: Add owner_id column and backfill from created_by
-- ============================================================

-- Add owner_id column if it doesn't exist
ALTER TABLE public.orgs
ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id) ON DELETE SET NULL;

-- Backfill owner_id from created_by for existing rows
UPDATE public.orgs
SET owner_id = created_by
WHERE owner_id IS NULL AND created_by IS NOT NULL;

-- Add comment for documentation
COMMENT ON COLUMN public.orgs.owner_id IS 'Primary owner of the org, used for RLS insert policy';
