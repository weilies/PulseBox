-- App Logs table for tracking page views, errors, and events
create table public.app_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  level text not null check (level in ('info', 'warn', 'error', 'fatal')),
  category text not null check (category in ('page_view', 'click_error', 'unhandled_error', 'component_error', 'api_error')),
  message text not null,
  metadata jsonb default '{}',
  created_at timestamptz default now()
);

-- Index for querying by tenant and time
create index idx_app_logs_tenant_created on public.app_logs (tenant_id, created_at desc);

-- Index for filtering by level (useful for error monitoring)
create index idx_app_logs_level on public.app_logs (level) where level in ('error', 'fatal');

-- Enable RLS
alter table public.app_logs enable row level security;

-- Any authenticated user can insert their own logs
create policy "Users can insert own logs"
  on public.app_logs for insert
  to authenticated
  with check (auth.uid() = user_id);

-- Tenant admins and above can read logs for their tenant
create policy "Tenant admins can read tenant logs"
  on public.app_logs for select
  to authenticated
  using (
    exists (
      select 1 from public.tenant_users tu
      where tu.tenant_id = app_logs.tenant_id
        and tu.user_id = auth.uid()
        and tu.role in ('super_admin', 'tenant_admin')
        and tu.is_active = true
    )
  );

-- Super admins can read all logs
create policy "Super admins can read all logs"
  on public.app_logs for select
  to authenticated
  using (
    exists (
      select 1 from public.tenant_users tu
      join public.tenants t on t.id = tu.tenant_id
      where tu.user_id = auth.uid()
        and tu.role = 'super_admin'
        and t.is_super = true
    )
  );
