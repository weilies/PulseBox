-- Add is_default flag to tenant_users for default tenant selection on login
alter table public.tenant_users add column is_default boolean not null default false;

-- Ensure only one default per user
create unique index idx_tenant_users_default
  on public.tenant_users (user_id) where (is_default = true);
