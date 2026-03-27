-- Backfill role_id for all tenant_users rows where role_id is NULL
-- or doesn't match the role slug. This fixes stale role_id values
-- left over from before the RBAC sync fix in dashboard actions.

UPDATE public.tenant_users tu
SET role_id = r.id
FROM public.roles r
WHERE r.tenant_id = tu.tenant_id
  AND r.slug = tu.role
  AND (tu.role_id IS NULL OR tu.role_id != r.id);