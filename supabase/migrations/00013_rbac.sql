-- =============================================================================
-- Migration 00013: RBAC — Roles, Policies, Nav Folders
-- =============================================================================
-- Adds: roles, policies, policy_permissions, role_policies, nav_folders, nav_items
-- Adds: role_id column to tenant_users (role text kept for now, dropped in 00014)
-- Adds: has_permission(), has_page_access(), get_accessible_collection_ids() functions
-- Seeds: default roles + policies for all existing tenants
-- Updates: RLS on collections, collection_fields, collection_items to use policy functions
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tables
-- -----------------------------------------------------------------------------

create table if not exists public.roles (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  slug        text not null,
  description text,
  is_system   boolean not null default false,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(tenant_id, slug)
);

create table if not exists public.policies (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  description text,
  is_system   boolean not null default false,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(tenant_id, name)
);

create table if not exists public.policy_permissions (
  id              uuid primary key default gen_random_uuid(),
  policy_id       uuid not null references public.policies(id) on delete cascade,
  resource_type   text not null check (resource_type in ('page', 'collection')),
  resource_id     text not null,
  permissions     jsonb not null default '{}',
  -- Collections: { "read": true, "create": true, "update": true, "delete": true,
  --               "export": true, "import": true, "manage_schema": false }
  -- Pages:       { "access": true }
  unique(policy_id, resource_type, resource_id)
);

create table if not exists public.role_policies (
  role_id     uuid not null references public.roles(id) on delete cascade,
  policy_id   uuid not null references public.policies(id) on delete cascade,
  primary key (role_id, policy_id)
);

create table if not exists public.nav_folders (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  name        text not null,
  icon        text,
  parent_id   uuid references public.nav_folders(id) on delete cascade,
  sort_order  integer not null default 0,
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now()
);

create index if not exists idx_nav_folders_tenant on public.nav_folders(tenant_id);
create index if not exists idx_nav_folders_parent on public.nav_folders(parent_id);

create table if not exists public.nav_items (
  id              uuid primary key default gen_random_uuid(),
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  resource_type   text not null check (resource_type in ('page', 'collection')),
  resource_id     text not null,
  label           text,
  icon            text,
  folder_id       uuid references public.nav_folders(id) on delete set null,
  sort_order      integer not null default 0,
  unique(tenant_id, resource_type, resource_id)
);

create index if not exists idx_nav_items_tenant on public.nav_items(tenant_id);
create index if not exists idx_nav_items_folder on public.nav_items(folder_id);

-- Add role_id to tenant_users (nullable for now; made NOT NULL in migration 00014)
alter table public.tenant_users
  add column if not exists role_id uuid references public.roles(id);

-- -----------------------------------------------------------------------------
-- 2. Helper functions
-- -----------------------------------------------------------------------------

-- Returns true if the current user has a specific permission on a resource
-- (checks through role → role_policies → policies → policy_permissions chain)
create or replace function public.has_permission(
  p_resource_type text,
  p_resource_id   text,
  p_permission    text
) returns boolean
language plpgsql
security definer
stable
as $$
begin
  -- Super admin bypass
  if public.is_super_admin() then
    return true;
  end if;

  return exists (
    select 1
    from public.tenant_users tu
    join public.role_policies rp on rp.role_id = tu.role_id
    join public.policy_permissions pp on pp.policy_id = rp.policy_id
    where tu.user_id = auth.uid()
      and tu.is_active = true
      and pp.resource_type = p_resource_type
      and pp.resource_id = p_resource_id
      and (pp.permissions ->> p_permission)::boolean = true
  );
end;
$$;

-- Returns true if the current user has 'access' permission on a page
create or replace function public.has_page_access(p_page_slug text)
returns boolean
language sql
security definer
stable
as $$
  select public.has_permission('page', p_page_slug, 'access');
$$;

-- Returns all collection UUIDs the current user can perform p_permission on
-- Used in RLS policies for efficient set-based filtering
create or replace function public.get_accessible_collection_ids(p_permission text)
returns setof uuid
language plpgsql
security definer
stable
as $$
begin
  -- Super admin sees everything
  if public.is_super_admin() then
    return query select id from public.collections;
    return;
  end if;

  return query
    select distinct pp.resource_id::uuid
    from public.tenant_users tu
    join public.role_policies rp on rp.role_id = tu.role_id
    join public.policy_permissions pp on pp.policy_id = rp.policy_id
    where tu.user_id = auth.uid()
      and tu.is_active = true
      and pp.resource_type = 'collection'
      and (pp.permissions ->> p_permission)::boolean = true;
end;
$$;

-- Returns all page slugs the current user has 'access' permission on
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
      ('roles');
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
-- 3. Seed default roles, policies, and policy_permissions for all tenants
-- -----------------------------------------------------------------------------

do $$
declare
  v_tenant record;
  v_role_super_id uuid;
  v_role_tenant_admin_id uuid;
  v_policy_full_access_id uuid;
  v_policy_tenant_mgmt_id uuid;
  v_policy_catalog_mgmt_id uuid;
  v_col record;
begin

  for v_tenant in select id, slug, is_super from public.tenants loop

    -- -------------------------------------------------------------------------
    -- Create tenant_admin role (all tenants)
    -- -------------------------------------------------------------------------
    insert into public.roles (tenant_id, name, slug, description, is_system)
    values (v_tenant.id, 'Tenant Admin', 'tenant_admin', 'Full access within this tenant', true)
    on conflict (tenant_id, slug) do nothing
    returning id into v_role_tenant_admin_id;

    -- If already existed, get the id
    if v_role_tenant_admin_id is null then
      select id into v_role_tenant_admin_id from public.roles
      where tenant_id = v_tenant.id and slug = 'tenant_admin';
    end if;

    -- -------------------------------------------------------------------------
    -- Create super_admin role (BIPO only)
    -- -------------------------------------------------------------------------
    if v_tenant.is_super then
      insert into public.roles (tenant_id, name, slug, description, is_system)
      values (v_tenant.id, 'Super Admin', 'super_admin', 'Full platform access (BIPO only)', true)
      on conflict (tenant_id, slug) do nothing
      returning id into v_role_super_id;

      if v_role_super_id is null then
        select id into v_role_super_id from public.roles
        where tenant_id = v_tenant.id and slug = 'super_admin';
      end if;
    end if;

    -- -------------------------------------------------------------------------
    -- Seed "Tenant Management" policy for all tenants
    -- -------------------------------------------------------------------------
    insert into public.policies (tenant_id, name, description, is_system)
    values (v_tenant.id, 'Tenant Management', 'Default access for tenant administrators', true)
    on conflict (tenant_id, name) do nothing
    returning id into v_policy_tenant_mgmt_id;

    if v_policy_tenant_mgmt_id is null then
      select id into v_policy_tenant_mgmt_id from public.policies
      where tenant_id = v_tenant.id and name = 'Tenant Management';
    end if;

    -- Page permissions for tenant admin
    insert into public.policy_permissions (policy_id, resource_type, resource_id, permissions) values
      (v_policy_tenant_mgmt_id, 'page', 'dashboard',                    '{"access": true}'),
      (v_policy_tenant_mgmt_id, 'page', 'users',                        '{"access": true}'),
      (v_policy_tenant_mgmt_id, 'page', 'studio.system-collections',    '{"access": true}'),
      (v_policy_tenant_mgmt_id, 'page', 'studio.tenant-collections',    '{"access": true}'),
      (v_policy_tenant_mgmt_id, 'page', 'roles',                        '{"access": true}')
    on conflict (policy_id, resource_type, resource_id) do nothing;

    -- System collections: read + export
    for v_col in select id from public.collections where type = 'system' loop
      insert into public.policy_permissions (policy_id, resource_type, resource_id, permissions)
      values (
        v_policy_tenant_mgmt_id,
        'collection',
        v_col.id::text,
        '{"read": true, "create": false, "update": false, "delete": false, "export": true, "import": false, "manage_schema": false}'
      )
      on conflict (policy_id, resource_type, resource_id) do nothing;
    end loop;

    -- Tenant collections for this tenant: full CRUD
    for v_col in select id from public.collections where type = 'tenant' and tenant_id = v_tenant.id loop
      insert into public.policy_permissions (policy_id, resource_type, resource_id, permissions)
      values (
        v_policy_tenant_mgmt_id,
        'collection',
        v_col.id::text,
        '{"read": true, "create": true, "update": true, "delete": true, "export": true, "import": true, "manage_schema": true}'
      )
      on conflict (policy_id, resource_type, resource_id) do nothing;
    end loop;

    -- Assign Tenant Management policy to tenant_admin role
    insert into public.role_policies (role_id, policy_id)
    values (v_role_tenant_admin_id, v_policy_tenant_mgmt_id)
    on conflict do nothing;

    -- -------------------------------------------------------------------------
    -- BIPO-only: "Full Platform Access" + "Content Catalog Management" policies
    -- -------------------------------------------------------------------------
    if v_tenant.is_super then

      -- "Full Platform Access" for super_admin
      insert into public.policies (tenant_id, name, description, is_system)
      values (v_tenant.id, 'Full Platform Access', 'Complete access to all platform features', true)
      on conflict (tenant_id, name) do nothing
      returning id into v_policy_full_access_id;

      if v_policy_full_access_id is null then
        select id into v_policy_full_access_id from public.policies
        where tenant_id = v_tenant.id and name = 'Full Platform Access';
      end if;

      -- All pages
      insert into public.policy_permissions (policy_id, resource_type, resource_id, permissions) values
        (v_policy_full_access_id, 'page', 'dashboard',                  '{"access": true}'),
        (v_policy_full_access_id, 'page', 'users',                      '{"access": true}'),
        (v_policy_full_access_id, 'page', 'tenants',                    '{"access": true}'),
        (v_policy_full_access_id, 'page', 'studio.system-collections',  '{"access": true}'),
        (v_policy_full_access_id, 'page', 'studio.content-catalog',     '{"access": true}'),
        (v_policy_full_access_id, 'page', 'studio.tenant-collections',  '{"access": true}'),
        (v_policy_full_access_id, 'page', 'roles',                      '{"access": true}')
      on conflict (policy_id, resource_type, resource_id) do nothing;

      -- All collections: full access
      for v_col in select id from public.collections loop
        insert into public.policy_permissions (policy_id, resource_type, resource_id, permissions)
        values (
          v_policy_full_access_id,
          'collection',
          v_col.id::text,
          '{"read": true, "create": true, "update": true, "delete": true, "export": true, "import": true, "manage_schema": true}'
        )
        on conflict (policy_id, resource_type, resource_id) do nothing;
      end loop;

      insert into public.role_policies (role_id, policy_id)
      values (v_role_super_id, v_policy_full_access_id)
      on conflict do nothing;

      -- "Content Catalog Management" for BIPO tenant_admin
      insert into public.policies (tenant_id, name, description, is_system)
      values (v_tenant.id, 'Content Catalog Management', 'Access to manage content catalogs', true)
      on conflict (tenant_id, name) do nothing
      returning id into v_policy_catalog_mgmt_id;

      if v_policy_catalog_mgmt_id is null then
        select id into v_policy_catalog_mgmt_id from public.policies
        where tenant_id = v_tenant.id and name = 'Content Catalog Management';
      end if;

      insert into public.policy_permissions (policy_id, resource_type, resource_id, permissions)
      values (v_policy_catalog_mgmt_id, 'page', 'studio.content-catalog', '{"access": true}')
      on conflict (policy_id, resource_type, resource_id) do nothing;

      insert into public.role_policies (role_id, policy_id)
      values (v_role_tenant_admin_id, v_policy_catalog_mgmt_id)
      on conflict do nothing;

    end if; -- is_super

  end loop; -- tenants

end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Migrate existing tenant_users.role → role_id
-- -----------------------------------------------------------------------------

update public.tenant_users tu
set role_id = r.id
from public.roles r
where r.tenant_id = tu.tenant_id
  and r.slug = case
    when tu.role = 'super_admin' then 'super_admin'
    else 'tenant_admin'
  end
  and tu.role_id is null;

-- -----------------------------------------------------------------------------
-- 5. Seed nav_items for existing pages and collections (per tenant)
-- -----------------------------------------------------------------------------

do $$
declare
  v_tenant record;
  v_col record;
  v_sort int;
begin
  for v_tenant in select id, is_super from public.tenants loop

    -- Seed page nav_items
    v_sort := 0;
    insert into public.nav_items (tenant_id, resource_type, resource_id, sort_order) values
      (v_tenant.id, 'page', 'dashboard',                   v_sort),
      (v_tenant.id, 'page', 'users',                       v_sort + 1),
      (v_tenant.id, 'page', 'studio.system-collections',   v_sort + 2),
      (v_tenant.id, 'page', 'studio.tenant-collections',   v_sort + 3),
      (v_tenant.id, 'page', 'roles',                       v_sort + 5)
    on conflict (tenant_id, resource_type, resource_id) do nothing;

    if v_tenant.is_super then
      insert into public.nav_items (tenant_id, resource_type, resource_id, sort_order) values
        (v_tenant.id, 'page', 'tenants',                     v_sort + 4),
        (v_tenant.id, 'page', 'studio.content-catalog',      v_sort + 3)
      on conflict (tenant_id, resource_type, resource_id) do nothing;
    end if;

    -- Seed collection nav_items for this tenant
    v_sort := 10;
    for v_col in
      select id from public.collections
      where (type = 'system' or (type = 'tenant' and tenant_id = v_tenant.id))
        and is_hidden = false
    loop
      insert into public.nav_items (tenant_id, resource_type, resource_id, sort_order)
      values (v_tenant.id, 'collection', v_col.id::text, v_sort)
      on conflict (tenant_id, resource_type, resource_id) do nothing;
      v_sort := v_sort + 1;
    end loop;

  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. RLS — enable on new tables
-- -----------------------------------------------------------------------------

alter table public.roles enable row level security;
alter table public.policies enable row level security;
alter table public.policy_permissions enable row level security;
alter table public.role_policies enable row level security;
alter table public.nav_folders enable row level security;
alter table public.nav_items enable row level security;

-- Roles: visible within own tenant; editable if user has page 'roles' access
create policy "roles_select" on public.roles
  for select using (
    public.is_super_admin()
    or tenant_id in (select public.get_my_tenant_ids())
  );

create policy "roles_insert" on public.roles
  for insert with check (
    public.is_super_admin()
    or (
      tenant_id in (select public.get_my_tenant_ids())
      and public.has_page_access('roles')
      and not is_system
    )
  );

create policy "roles_update" on public.roles
  for update using (
    public.is_super_admin()
    or (
      tenant_id in (select public.get_my_tenant_ids())
      and public.has_page_access('roles')
      and not is_system
    )
  );

create policy "roles_delete" on public.roles
  for delete using (
    tenant_id in (select public.get_my_tenant_ids())
    and public.has_page_access('roles')
    and not is_system
  );

-- Policies
create policy "policies_select" on public.policies
  for select using (
    public.is_super_admin()
    or tenant_id in (select public.get_my_tenant_ids())
  );

create policy "policies_manage" on public.policies
  for all using (
    public.is_super_admin()
    or (
      tenant_id in (select public.get_my_tenant_ids())
      and public.has_page_access('roles')
    )
  );

-- Policy permissions
create policy "pp_select" on public.policy_permissions
  for select using (
    public.is_super_admin()
    or policy_id in (
      select id from public.policies
      where tenant_id in (select public.get_my_tenant_ids())
    )
  );

create policy "pp_manage" on public.policy_permissions
  for all using (
    public.is_super_admin()
    or (
      public.has_page_access('roles')
      and policy_id in (
        select id from public.policies
        where tenant_id in (select public.get_my_tenant_ids())
      )
    )
  );

-- Role policies join table
create policy "rp_select" on public.role_policies
  for select using (
    public.is_super_admin()
    or role_id in (
      select id from public.roles
      where tenant_id in (select public.get_my_tenant_ids())
    )
  );

create policy "rp_manage" on public.role_policies
  for all using (
    public.is_super_admin()
    or (
      public.has_page_access('roles')
      and role_id in (
        select id from public.roles
        where tenant_id in (select public.get_my_tenant_ids())
      )
    )
  );

-- Nav folders
create policy "nav_folders_select" on public.nav_folders
  for select using (
    public.is_super_admin()
    or tenant_id in (select public.get_my_tenant_ids())
  );

create policy "nav_folders_manage" on public.nav_folders
  for all using (
    public.is_super_admin()
    or (
      tenant_id in (select public.get_my_tenant_ids())
      and public.has_page_access('roles')
    )
  );

-- Nav items
create policy "nav_items_select" on public.nav_items
  for select using (
    public.is_super_admin()
    or tenant_id in (select public.get_my_tenant_ids())
  );

create policy "nav_items_manage" on public.nav_items
  for all using (
    public.is_super_admin()
    or (
      tenant_id in (select public.get_my_tenant_ids())
      and public.has_page_access('roles')
    )
  );

-- -----------------------------------------------------------------------------
-- 7. Update collection / collection_items RLS to use policy-based functions
-- -----------------------------------------------------------------------------

-- Drop ALL existing policies on these tables (recreating from scratch)
drop policy if exists "collections_select"          on public.collections;
drop policy if exists "collections_insert"          on public.collections;
drop policy if exists "collections_update"          on public.collections;
drop policy if exists "collections_delete"          on public.collections;
drop policy if exists "super_admin_all_collections" on public.collections;
drop policy if exists "collection_fields_select"    on public.collection_fields;
drop policy if exists "collection_fields_write"     on public.collection_fields;
drop policy if exists "items_tenant_isolation"      on public.collection_items;
drop policy if exists "super_admin_items"           on public.collection_items;
drop policy if exists "system_items_select"         on public.collection_items;
drop policy if exists "items_read"                  on public.collection_items;
drop policy if exists "items_write"                 on public.collection_items;
drop policy if exists "collection_items_select"     on public.collection_items;
drop policy if exists "collection_items_insert"     on public.collection_items;
drop policy if exists "collection_items_update"     on public.collection_items;
drop policy if exists "collection_items_delete"     on public.collection_items;

-- Collections: readable if user has read permission via policy chain
-- (super_admin gets all via get_accessible_collection_ids bypass)
create policy "collections_select" on public.collections
  for select using (
    id in (select public.get_accessible_collection_ids('read'))
  );

-- Super admin can write any collection; others need manage_schema
create policy "collections_insert" on public.collections
  for insert with check (
    public.is_super_admin()
  );

create policy "collections_update" on public.collections
  for update using (
    public.is_super_admin()
    or id in (select public.get_accessible_collection_ids('manage_schema'))
  );

create policy "collections_delete" on public.collections
  for delete using (
    public.is_super_admin()
    or id in (select public.get_accessible_collection_ids('manage_schema'))
  );

-- Collection fields mirror parent collection visibility
create policy "collection_fields_select" on public.collection_fields
  for select using (
    collection_id in (select public.get_accessible_collection_ids('read'))
  );

create policy "collection_fields_insert" on public.collection_fields
  for insert with check (
    public.is_super_admin()
    or collection_id in (select public.get_accessible_collection_ids('manage_schema'))
  );

create policy "collection_fields_update" on public.collection_fields
  for update using (
    public.is_super_admin()
    or collection_id in (select public.get_accessible_collection_ids('manage_schema'))
  );

create policy "collection_fields_delete" on public.collection_fields
  for delete using (
    public.is_super_admin()
    or collection_id in (select public.get_accessible_collection_ids('manage_schema'))
  );

-- Collection items: full CRUD gated by permissions
create policy "collection_items_select" on public.collection_items
  for select using (
    collection_id in (select public.get_accessible_collection_ids('read'))
  );

create policy "collection_items_insert" on public.collection_items
  for insert with check (
    public.is_super_admin()
    or collection_id in (select public.get_accessible_collection_ids('create'))
  );

create policy "collection_items_update" on public.collection_items
  for update using (
    public.is_super_admin()
    or collection_id in (select public.get_accessible_collection_ids('update'))
  );

create policy "collection_items_delete" on public.collection_items
  for delete using (
    public.is_super_admin()
    or collection_id in (select public.get_accessible_collection_ids('delete'))
  );
