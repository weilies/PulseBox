-- Migration: 00021_timezone.sql
-- Adds timezone support at tenant level (default Asia/Singapore) and user level (optional override).
-- Resolution order: user profile timezone → tenant timezone → 'Asia/Singapore'

-- Tenant-level default timezone
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Singapore';

-- Backfill all existing tenants to Singapore timezone
UPDATE tenants SET timezone = 'Asia/Singapore' WHERE timezone IS NULL OR timezone = '';

-- User-level override (NULL = inherit from tenant)
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS timezone text;
