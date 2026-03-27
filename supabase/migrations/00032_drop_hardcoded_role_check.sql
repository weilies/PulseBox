-- The tenant_users_role_check constraint was created in 00003 with only
-- ('super_admin', 'tenant_admin').  The RBAC migration (00013) introduced
-- custom roles stored in the `roles` table, but never relaxed this CHECK.
-- Any attempt to assign a custom role slug now fails.
--
-- Fix: drop the hardcoded CHECK.  Valid roles are already enforced by the
-- application layer (the availableRoles dropdown only offers roles that
-- exist in the `roles` table for the relevant tenant).

ALTER TABLE public.tenant_users DROP CONSTRAINT IF EXISTS tenant_users_role_check;
