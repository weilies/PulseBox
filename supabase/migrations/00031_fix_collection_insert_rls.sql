-- Fix: allow tenant_admins to create tenant-type collections for their own tenant.
-- Previously the insert policy only permitted is_super_admin().

drop policy if exists "collections_insert" on public.collections;

create policy "collections_insert" on public.collections
  for insert with check (
    public.is_super_admin()
    or (
      type = 'tenant'
      and tenant_id in (
        select tenant_id
        from public.tenant_users
        where user_id = auth.uid()
          and role in ('tenant_admin', 'super_admin')
      )
    )
  );
