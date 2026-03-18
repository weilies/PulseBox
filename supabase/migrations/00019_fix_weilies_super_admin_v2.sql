-- Fix v2: Directly set weilies as super_admin in BIPO tenant using scalar subqueries.
-- Migration 00018 used a multi-table JOIN in FROM which likely matched 0 rows silently.

UPDATE public.tenant_users
SET
  role    = 'super_admin',
  role_id = (
    SELECT r.id
    FROM public.roles r
    JOIN public.tenants t ON t.id = r.tenant_id
    WHERE t.is_super = true
      AND r.slug = 'super_admin'
    LIMIT 1
  )
WHERE user_id = (
    SELECT id FROM auth.users
    WHERE email = 'weilies.chok@gmail.com'
    LIMIT 1
  )
  AND tenant_id = (
    SELECT id FROM public.tenants
    WHERE is_super = true
    LIMIT 1
  );
