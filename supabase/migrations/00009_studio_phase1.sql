-- ============================================================
-- STUDIO PHASE 1: Foundation
-- Tables: modules, tenant_modules, collections, collection_fields,
--         collection_items, collection_items_audit,
--         global_lists, global_list_items, collection_views
-- RLS policies, audit trigger, seed data
-- ============================================================


-- ============================================================
-- HELPER FUNCTION: is_super_admin (no table dependencies)
-- ============================================================

-- Returns true if the current user is a super_admin of the BIPO super-tenant
create or replace function public.is_super_admin()
returns boolean
language sql
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_users tu
    join public.tenants t on t.id = tu.tenant_id
    where tu.user_id = auth.uid()
      and t.is_super = true
      and tu.role = 'super_admin'
      and tu.is_active = true
  )
$$;


-- ============================================================
-- MODULES (BIPO-maintained module definitions)
-- ============================================================

create table public.modules (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  icon        text,
  created_at  timestamptz not null default now()
);


-- ============================================================
-- TENANT_MODULES (licensing: which tenant has which module)
-- ============================================================

create table public.tenant_modules (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  module_id   uuid not null references public.modules(id) on delete cascade,
  licensed_at timestamptz not null default now(),
  expires_at  timestamptz,
  is_active   boolean not null default true,
  unique (tenant_id, module_id)
);

-- Returns module IDs licensed to any of the current user's tenants
-- (defined here because it depends on tenant_modules table)
create or replace function public.get_my_licensed_module_ids()
returns setof uuid
language sql
security definer
set search_path = ''
as $$
  select distinct tm.module_id
  from public.tenant_modules tm
  where tm.tenant_id in (select public.get_my_tenant_ids())
    and tm.is_active = true
$$;


-- ============================================================
-- COLLECTIONS (schema definitions — system or tenant-owned)
-- ============================================================

create table public.collections (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  icon        text,
  type        text not null check (type in ('system', 'tenant')),
  tenant_id   uuid references public.tenants(id) on delete cascade,  -- null = system (BIPO)
  module_id   uuid references public.modules(id),                     -- only for system collections
  is_hidden   boolean not null default false,                         -- true for auto-created M2M junction collections
  created_by  uuid references auth.users(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint system_collection_no_tenant  check (type = 'tenant' or tenant_id is null),
  constraint tenant_collection_has_tenant check (type = 'system' or tenant_id is not null),
  constraint tenant_collection_no_module  check (type = 'system' or module_id is null)
);


-- ============================================================
-- COLLECTION_FIELDS (field definitions per collection)
-- ============================================================

create table public.collection_fields (
  id              uuid primary key default gen_random_uuid(),
  collection_id   uuid not null references public.collections(id) on delete cascade,
  slug            text not null,
  name            text not null,
  field_type      text not null check (field_type in (
    'text', 'number', 'date', 'datetime', 'boolean', 'file',
    'select', 'multiselect', 'richtext', 'json', 'relation'
  )),
  options         jsonb not null default '{}',
  -- options schema by field_type:
  --   text:        { "max_length": 255, "placeholder": "..." }
  --   number:      { "min": 0, "max": 100, "decimals": 2 }
  --   select:      { "choices": ["a","b"] } OR { "global_list_slug": "gender" }
  --   multiselect: same as select
  --   file:        { "allowed_types": ["image/*","application/pdf"], "max_size_mb": 10 }
  --   relation:    { "related_collection_id": "uuid", "relation_type": "m2o|o2o|m2m",
  --                  "junction_collection_id": "uuid" (m2m only) }
  is_required     boolean not null default false,
  is_unique       boolean not null default false,
  sort_order      integer not null default 0,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (collection_id, slug)
);


-- ============================================================
-- COLLECTION_ITEMS (EAV data store — actual records)
-- ============================================================

create table public.collection_items (
  id              uuid primary key default gen_random_uuid(),
  collection_id   uuid not null references public.collections(id) on delete cascade,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  data            jsonb not null default '{}',
  created_by      uuid references auth.users(id),
  updated_by      uuid references auth.users(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index idx_collection_items_tenant_collection
  on public.collection_items(tenant_id, collection_id);

create index idx_collection_items_data
  on public.collection_items using gin(data);


-- ============================================================
-- COLLECTION_ITEMS_AUDIT (immutable audit log)
-- ============================================================

create table public.collection_items_audit (
  id              uuid primary key default gen_random_uuid(),
  item_id         uuid not null,          -- no FK — items may be hard-deleted
  collection_id   uuid not null,
  tenant_id       uuid not null references public.tenants(id),
  action          text not null check (action in ('insert', 'update', 'delete')),
  old_data        jsonb,
  new_data        jsonb,
  changed_by      uuid references auth.users(id),
  changed_at      timestamptz not null default now()
);

create index idx_audit_tenant     on public.collection_items_audit(tenant_id);
create index idx_audit_item       on public.collection_items_audit(item_id);
create index idx_audit_collection on public.collection_items_audit(collection_id);


-- Audit trigger function
create or replace function public.audit_collection_item_changes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.collection_items_audit
      (item_id, collection_id, tenant_id, action, new_data, changed_by)
    values
      (new.id, new.collection_id, new.tenant_id, 'insert', new.data, new.created_by);
    return new;

  elsif tg_op = 'UPDATE' then
    insert into public.collection_items_audit
      (item_id, collection_id, tenant_id, action, old_data, new_data, changed_by)
    values
      (new.id, new.collection_id, new.tenant_id, 'update', old.data, new.data, new.updated_by);
    return new;

  elsif tg_op = 'DELETE' then
    insert into public.collection_items_audit
      (item_id, collection_id, tenant_id, action, old_data, changed_by)
    values
      (old.id, old.collection_id, old.tenant_id, 'delete', old.data, old.updated_by);
    return old;
  end if;

  return null;
end;
$$;

create trigger trg_audit_collection_items
  after insert or update or delete on public.collection_items
  for each row execute function public.audit_collection_item_changes();


-- ============================================================
-- GLOBAL_LISTS + GLOBAL_LIST_ITEMS (BIPO-maintained lookups)
-- ============================================================

create table public.global_lists (
  id          uuid primary key default gen_random_uuid(),
  slug        text unique not null,
  name        text not null,
  description text,
  created_at  timestamptz not null default now()
);

create table public.global_list_items (
  id          uuid primary key default gen_random_uuid(),
  list_id     uuid not null references public.global_lists(id) on delete cascade,
  value       text not null,
  label       text not null,
  sort_order  integer not null default 0,
  is_active   boolean not null default true,
  unique (list_id, value)
);


-- ============================================================
-- COLLECTION_VIEWS (saved view configurations per tenant)
-- ============================================================

create table public.collection_views (
  id              uuid primary key default gen_random_uuid(),
  collection_id   uuid not null references public.collections(id) on delete cascade,
  tenant_id       uuid not null references public.tenants(id) on delete cascade,
  name            text not null,
  type            text not null check (type in ('grid', 'kanban')),
  config          jsonb not null default '{}',
  -- config schema: {
  --   columns: [{ field_slug, width, visible }],
  --   sort: { field_slug, direction: "asc"|"desc" },
  --   filters: [{ field_slug, operator, value }],
  --   kanban_field_slug: "status"  (kanban only)
  -- }
  is_default      boolean not null default false,
  created_by      uuid references auth.users(id),
  created_at      timestamptz not null default now()
);


-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

alter table public.modules                enable row level security;
alter table public.tenant_modules         enable row level security;
alter table public.collections            enable row level security;
alter table public.collection_fields      enable row level security;
alter table public.collection_items       enable row level security;
alter table public.collection_items_audit enable row level security;
alter table public.global_lists           enable row level security;
alter table public.global_list_items      enable row level security;
alter table public.collection_views       enable row level security;


-- --- modules ---
-- all authenticated users can read; only super_admin can write
create policy "modules_select" on public.modules
  for select using (auth.uid() is not null);

create policy "modules_all_super_admin" on public.modules
  for all using (public.is_super_admin());


-- --- tenant_modules ---
-- tenant members can see their own licenses; super_admin manages all
create policy "tenant_modules_select" on public.tenant_modules
  for select using (
    tenant_id in (select public.get_my_tenant_ids())
  );

create policy "tenant_modules_all_super_admin" on public.tenant_modules
  for all using (public.is_super_admin());


-- --- collections ---
-- read: system collections (if module licensed or no module) + own tenant collections + super_admin
create policy "collections_select" on public.collections
  for select using (
    public.is_super_admin()
    or
    (type = 'tenant' and tenant_id in (select public.get_my_tenant_ids()))
    or
    (type = 'system' and (
      module_id is null
      or module_id in (select public.get_my_licensed_module_ids())
    ))
  );

-- write: tenant_admin can manage their tenant collections; super_admin manages system collections
create policy "collections_insert" on public.collections
  for insert with check (
    public.is_super_admin()
    or (
      type = 'tenant'
      and public.get_my_role_in_tenant(tenant_id) in ('super_admin', 'tenant_admin')
    )
  );

create policy "collections_update" on public.collections
  for update using (
    public.is_super_admin()
    or (
      type = 'tenant'
      and public.get_my_role_in_tenant(tenant_id) in ('super_admin', 'tenant_admin')
    )
  );

create policy "collections_delete" on public.collections
  for delete using (
    public.is_super_admin()
    or (
      type = 'tenant'
      and public.get_my_role_in_tenant(tenant_id) in ('super_admin', 'tenant_admin')
    )
  );


-- --- collection_fields ---
-- visibility mirrors the parent collection
create policy "collection_fields_select" on public.collection_fields
  for select using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id
        and (
          public.is_super_admin()
          or (c.type = 'tenant' and c.tenant_id in (select public.get_my_tenant_ids()))
          or (c.type = 'system' and (
            c.module_id is null
            or c.module_id in (select public.get_my_licensed_module_ids())
          ))
        )
    )
  );

-- write: super_admin for system collections; tenant_admin for their own tenant collections
create policy "collection_fields_write" on public.collection_fields
  for all using (
    exists (
      select 1 from public.collections c
      where c.id = collection_id
        and (
          public.is_super_admin()
          or (
            c.type = 'tenant'
            and public.get_my_role_in_tenant(c.tenant_id) in ('super_admin', 'tenant_admin')
          )
        )
    )
  );


-- --- collection_items ---
-- full CRUD scoped to user's tenants only
create policy "collection_items_select" on public.collection_items
  for select using (
    tenant_id in (select public.get_my_tenant_ids())
  );

create policy "collection_items_insert" on public.collection_items
  for insert with check (
    tenant_id in (select public.get_my_tenant_ids())
  );

create policy "collection_items_update" on public.collection_items
  for update using (
    tenant_id in (select public.get_my_tenant_ids())
  );

create policy "collection_items_delete" on public.collection_items
  for delete using (
    tenant_id in (select public.get_my_tenant_ids())
  );


-- --- collection_items_audit ---
-- read-only for tenant members; no direct writes (trigger only)
create policy "audit_select" on public.collection_items_audit
  for select using (
    tenant_id in (select public.get_my_tenant_ids())
  );


-- --- global_lists ---
-- all authenticated users can read; only super_admin can write
create policy "global_lists_select" on public.global_lists
  for select using (auth.uid() is not null);

create policy "global_lists_all_super_admin" on public.global_lists
  for all using (public.is_super_admin());


-- --- global_list_items ---
create policy "global_list_items_select" on public.global_list_items
  for select using (auth.uid() is not null);

create policy "global_list_items_all_super_admin" on public.global_list_items
  for all using (public.is_super_admin());


-- --- collection_views ---
create policy "collection_views_select" on public.collection_views
  for select using (
    tenant_id in (select public.get_my_tenant_ids())
  );

create policy "collection_views_write" on public.collection_views
  for all using (
    tenant_id in (select public.get_my_tenant_ids())
  );


-- ============================================================
-- SEED: GLOBAL LISTS (BIPO-maintained)
-- ============================================================

insert into public.global_lists (slug, name, description) values
  ('gender',          'Gender',          'Biological or identified gender'),
  ('country',         'Country',         'ISO country list'),
  ('marital-status',  'Marital Status',  'Marital status options'),
  ('race',            'Race / Ethnicity', 'Race or ethnicity (SG context)'),
  ('religion',        'Religion',        'Religion options'),
  ('employment-type', 'Employment Type', 'Full-time, part-time, contract, etc.'),
  ('leave-type',      'Leave Type',      'Annual, medical, maternity, etc.');


-- Gender
insert into public.global_list_items (list_id, value, label, sort_order)
select id, value, label, sort_order from public.global_lists, (values
  ('Male',   'Male',   1),
  ('Female', 'Female', 2),
  ('Other',  'Other',  3)
) as v(value, label, sort_order)
where slug = 'gender';

-- Marital Status
insert into public.global_list_items (list_id, value, label, sort_order)
select id, value, label, sort_order from public.global_lists, (values
  ('Single',   'Single',   1),
  ('Married',  'Married',  2),
  ('Divorced', 'Divorced', 3),
  ('Widowed',  'Widowed',  4)
) as v(value, label, sort_order)
where slug = 'marital-status';

-- Race (Singapore HR context)
insert into public.global_list_items (list_id, value, label, sort_order)
select id, value, label, sort_order from public.global_lists, (values
  ('Chinese',  'Chinese',  1),
  ('Malay',    'Malay',    2),
  ('Indian',   'Indian',   3),
  ('Eurasian', 'Eurasian', 4),
  ('Others',   'Others',   5)
) as v(value, label, sort_order)
where slug = 'race';

-- Religion
insert into public.global_list_items (list_id, value, label, sort_order)
select id, value, label, sort_order from public.global_lists, (values
  ('Buddhism',    'Buddhism',    1),
  ('Christianity','Christianity',2),
  ('Islam',       'Islam',       3),
  ('Hinduism',    'Hinduism',    4),
  ('Taoism',      'Taoism',      5),
  ('None',        'None / No Religion', 6),
  ('Others',      'Others',      7)
) as v(value, label, sort_order)
where slug = 'religion';

-- Employment Type
insert into public.global_list_items (list_id, value, label, sort_order)
select id, value, label, sort_order from public.global_lists, (values
  ('Full-Time',  'Full-Time',  1),
  ('Part-Time',  'Part-Time',  2),
  ('Contract',   'Contract',   3),
  ('Intern',     'Intern',     4),
  ('Freelance',  'Freelance',  5)
) as v(value, label, sort_order)
where slug = 'employment-type';

-- Leave Type
insert into public.global_list_items (list_id, value, label, sort_order)
select id, value, label, sort_order from public.global_lists, (values
  ('Annual',    'Annual Leave',    1),
  ('Medical',   'Medical Leave',   2),
  ('Maternity', 'Maternity Leave', 3),
  ('Paternity', 'Paternity Leave', 4),
  ('Unpaid',    'Unpaid Leave',    5),
  ('Childcare', 'Childcare Leave', 6),
  ('Compassionate', 'Compassionate Leave', 7)
) as v(value, label, sort_order)
where slug = 'leave-type';

-- Country (abbreviated — top countries relevant to SG context + common ones)
insert into public.global_list_items (list_id, value, label, sort_order)
select id, value, label, sort_order from public.global_lists, (values
  ('SG', 'Singapore',      1),
  ('MY', 'Malaysia',       2),
  ('IN', 'India',          3),
  ('CN', 'China',          4),
  ('PH', 'Philippines',    5),
  ('ID', 'Indonesia',      6),
  ('TH', 'Thailand',       7),
  ('VN', 'Vietnam',        8),
  ('MM', 'Myanmar',        9),
  ('BD', 'Bangladesh',     10),
  ('AU', 'Australia',      11),
  ('GB', 'United Kingdom', 12),
  ('US', 'United States',  13),
  ('CA', 'Canada',         14),
  ('JP', 'Japan',          15),
  ('KR', 'South Korea',    16),
  ('HK', 'Hong Kong',      17),
  ('TW', 'Taiwan',         18),
  ('NZ', 'New Zealand',    19),
  ('ZZ', 'Others',         99)
) as v(value, label, sort_order)
where slug = 'country';
