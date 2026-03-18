-- Fix: Ensure weilies.chok@gmail.com has super_admin role in the BIPO super-tenant.
-- Migration 00008 incorrectly set role = 'tenant_admin' for all tenants,
-- which downgraded the super_admin role in the BIPO tenant.
-- Also backfills role_id to match the super_admin role record (added in 00013).

UPDATE public.tenant_users tu
SET
  role    = 'super_admin',
  role_id = r.id
FROM auth.users u
JOIN public.tenants t ON t.is_super = true
JOIN public.roles r   ON r.tenant_id = t.id AND r.slug = 'super_admin'
WHERE u.email      = 'weilies.chok@gmail.com'
  AND tu.user_id   = u.id
  AND tu.tenant_id = t.id;
