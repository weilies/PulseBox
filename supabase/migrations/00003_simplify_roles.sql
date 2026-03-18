-- Simplify roles: remove manager and employee, keep only super_admin and tenant_admin

-- Update any existing manager/employee users to tenant_admin
update public.tenant_users set role = 'tenant_admin' where role in ('manager', 'employee');

-- Drop old constraint and add new one
alter table public.tenant_users drop constraint if exists tenant_users_role_check;
alter table public.tenant_users add constraint tenant_users_role_check
  check (role in ('super_admin', 'tenant_admin'));

-- Update default
alter table public.tenant_users alter column role set default 'tenant_admin';
