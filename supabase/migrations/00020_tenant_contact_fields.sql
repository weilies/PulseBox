-- Migration: 00020_tenant_contact_fields.sql
-- Adds Person In Charge (contact_name, contact_email) to the tenants table.

ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS contact_name  text,
  ADD COLUMN IF NOT EXISTS contact_email text;
