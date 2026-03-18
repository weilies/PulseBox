-- ============================================================
-- TENANTS
-- ============================================================
create table public.tenants (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text not null unique,
  is_super      boolean not null default false,
  settings      jsonb not null default '{}',
  created_at    timestamptz not null default now()
);

-- Seed BIPO as the super-tenant
insert into public.tenants (name, slug, is_super)
values ('BIPO Service', 'bipo', true);

-- ============================================================
-- PROFILES (synced from auth.users via trigger)
-- ============================================================
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  updated_at  timestamptz not null default now()
);

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ============================================================
-- TENANT_USERS (join table: user <-> tenant with role)
-- ============================================================
create table public.tenant_users (
  id          uuid primary key default gen_random_uuid(),
  tenant_id   uuid not null references public.tenants(id) on delete cascade,
  user_id     uuid not null references auth.users(id) on delete cascade,
  role        text not null default 'employee'
                check (role in ('super_admin','tenant_admin','manager','employee')),
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  unique (tenant_id, user_id)
);

-- ============================================================
-- ROW-LEVEL SECURITY
-- ============================================================

-- Tenants
alter table public.tenants enable row level security;

create policy "Users see own tenants" on public.tenants
  for select using (
    id in (
      select tenant_id from public.tenant_users
      where user_id = auth.uid()
    )
  );

create policy "Super admins manage tenants" on public.tenants
  for all using (
    exists (
      select 1 from public.tenant_users
      where user_id = auth.uid()
        and role = 'super_admin'
    )
  );

-- Tenant Users
alter table public.tenant_users enable row level security;

create policy "See own tenant members" on public.tenant_users
  for select using (
    tenant_id in (
      select tu.tenant_id from public.tenant_users tu
      where tu.user_id = auth.uid()
    )
  );

create policy "Admins manage members" on public.tenant_users
  for all using (
    exists (
      select 1 from public.tenant_users tu
      where tu.user_id = auth.uid()
        and tu.tenant_id = tenant_users.tenant_id
        and tu.role in ('super_admin', 'tenant_admin')
    )
  );

-- Profiles
alter table public.profiles enable row level security;

create policy "Authenticated read profiles" on public.profiles
  for select using (auth.uid() is not null);

create policy "Users update own profile" on public.profiles
  for update using (id = auth.uid());
