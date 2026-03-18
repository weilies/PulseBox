-- Fix: Assign weilies.chok@gmail.com to both BIPO and Next Novas tenants
-- This handles the case where the user was created before auto-assignment was implemented

-- Find weilies user and assign to all tenants as tenant_admin
insert into public.tenant_users (tenant_id, user_id, role, is_default)
select
  tenants.id,
  users.id,
  'tenant_admin' as role,
  tenants.is_super as is_default  -- BIPO is the default, others are not
from auth.users as users
cross join public.tenants
where users.email = 'weilies.chok@gmail.com'
  and users.id is not null
on conflict (tenant_id, user_id) do update
set role = 'tenant_admin', is_default = excluded.is_default;

-- Ensure BIPO is marked as the default
update public.tenant_users
set is_default = true
where user_id = (select id from auth.users where email = 'weilies.chok@gmail.com' limit 1)
  and tenant_id = (select id from public.tenants where is_super = true limit 1);
