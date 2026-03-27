-- =============================================================================
-- Migration 00027: Query Generator — saved_queries table + RLS
-- =============================================================================
-- Adds: saved_queries table for persisting user-built join queries
-- Updates: get_accessible_pages() to include 'studio.queries'
-- Seeds: page access for existing default policies
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Table
-- -----------------------------------------------------------------------------

create type public.query_status as enum ('draft', 'published');

create table if not exists public.saved_queries (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  slug        text not null,
  description text,
  status      public.query_status not null default 'draft',
  definition  jsonb not null default '{}',
  -- definition shape:
  -- {
  --   "collections": [{ "id": "uuid", "slug": "text", "alias": "A" }],
  --   "joins": [{ "type": "inner|left|right|full", "left": { "alias": "A", "field": "f" }, "right": { "alias": "B", "field": "f" } }],
  --   "fields": [{ "alias": "A", "field": "name", "display": "Employee Name" }],
  --   "filters": [{ "alias": "A", "field": "status", "operator": "=", "value": "Active", "logic": "and" }],
  --   "aggregations": [{ "function": "COUNT|SUM|AVG|MIN|MAX", "alias": "A", "field": "id", "output_name": "total" }],
  --   "group_by": [{ "alias": "A", "field": "department" }],
  --   "sort": [{ "alias": "A", "field": "name", "direction": "asc|desc" }],
  --   "limit": 500
  -- }
  created_by  uuid not null references auth.users(id),
  updated_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(tenant_id, slug)
);

create index if not exists idx_saved_queries_tenant on public.saved_queries(tenant_id);
create index if not exists idx_saved_queries_status on public.saved_queries(tenant_id, status);

-- -----------------------------------------------------------------------------
-- 2. RLS
-- -----------------------------------------------------------------------------

alter table public.saved_queries enable row level security;

-- Drafts: only the creator can see them
-- Published: anyone in the same tenant can see them
-- (collection-level read permission is checked in application code at execution time)
create policy "saved_queries_select" on public.saved_queries
  for select using (
    tenant_id in (
      select tu.tenant_id from public.tenant_users tu
      where tu.user_id = auth.uid() and tu.is_active = true
    )
    and (
      status = 'published'
      or created_by = auth.uid()
    )
  );

-- Only authenticated users in the tenant can insert
create policy "saved_queries_insert" on public.saved_queries
  for insert with check (
    tenant_id in (
      select tu.tenant_id from public.tenant_users tu
      where tu.user_id = auth.uid() and tu.is_active = true
    )
    and created_by = auth.uid()
  );

-- Only the creator or super_admin can update
create policy "saved_queries_update" on public.saved_queries
  for update using (
    created_by = auth.uid() or public.is_super_admin()
  );

-- Only the creator or super_admin can delete
create policy "saved_queries_delete" on public.saved_queries
  for delete using (
    created_by = auth.uid() or public.is_super_admin()
  );

-- -----------------------------------------------------------------------------
-- 3. Update get_accessible_pages() to include studio.queries
-- -----------------------------------------------------------------------------

create or replace function public.get_accessible_pages()
returns setof text
language plpgsql
security definer
stable
as $$
begin
  if public.is_super_admin() then
    return query values
      ('dashboard'),
      ('users'),
      ('tenants'),
      ('studio.system-collections'),
      ('studio.content-catalog'),
      ('studio.tenant-collections'),
      ('studio.queries'),
      ('roles'),
      ('policies'),
      ('apps');
    return;
  end if;

  return query
    select distinct pp.resource_id
    from public.tenant_users tu
    join public.role_policies rp on rp.role_id = tu.role_id
    join public.policy_permissions pp on pp.policy_id = rp.policy_id
    where tu.user_id = auth.uid()
      and tu.is_active = true
      and pp.resource_type = 'page'
      and (pp.permissions ->> 'access')::boolean = true;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Seed studio.queries page access into existing default policies
-- -----------------------------------------------------------------------------

-- Give all tenants' "Tenant Management" policy access to queries page
do $$
declare
  pol record;
begin
  for pol in
    select id from public.policies where name = 'Tenant Management' and is_system = true
  loop
    insert into public.policy_permissions (policy_id, resource_type, resource_id, permissions)
    values (pol.id, 'page', 'studio.queries', '{"access": true}'::jsonb)
    on conflict (policy_id, resource_type, resource_id) do nothing;
  end loop;

  -- Also give "Full Platform Access" policy access
  for pol in
    select id from public.policies where name = 'Full Platform Access' and is_system = true
  loop
    insert into public.policy_permissions (policy_id, resource_type, resource_id, permissions)
    values (pol.id, 'page', 'studio.queries', '{"access": true}'::jsonb)
    on conflict (policy_id, resource_type, resource_id) do nothing;
  end loop;
end;
$$;
