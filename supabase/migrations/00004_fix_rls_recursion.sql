-- Fix infinite recursion in tenant_users RLS policies
-- The old policies queried tenant_users from within tenant_users policies, causing recursion.
-- Solution: use a security definer function that bypasses RLS to get the user's tenant IDs.

-- Helper function: returns tenant IDs for the current auth user (bypasses RLS)
create or replace function public.get_my_tenant_ids()
returns setof uuid
language sql
security definer
set search_path = ''
as $$
  select tenant_id from public.tenant_users where user_id = auth.uid() and is_active = true
$$;

-- Helper function: returns the current user's role in a given tenant (bypasses RLS)
create or replace function public.get_my_role_in_tenant(p_tenant_id uuid)
returns text
language sql
security definer
set search_path = ''
as $$
  select role from public.tenant_users
  where user_id = auth.uid() and tenant_id = p_tenant_id and is_active = true
  limit 1
$$;

-- Drop old tenant_users policies
drop policy if exists "See own tenant members" on public.tenant_users;
drop policy if exists "Admins manage members" on public.tenant_users;

-- New policies using the helper functions (no recursion)
create policy "See own tenant members" on public.tenant_users
  for select using (
    tenant_id in (select public.get_my_tenant_ids())
  );

create policy "Admins manage members" on public.tenant_users
  for all using (
    public.get_my_role_in_tenant(tenant_id) in ('super_admin', 'tenant_admin')
  );

-- Also fix the tenants table policy that references tenant_users
drop policy if exists "Users see own tenants" on public.tenants;

create policy "Users see own tenants" on public.tenants
  for select using (
    id in (select public.get_my_tenant_ids())
  );
