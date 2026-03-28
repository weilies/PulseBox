-- ============================================================
-- 00047_app_store_page_access.sql
-- Add studio.app-store to get_accessible_pages() and seed policies
-- ============================================================

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
      ('studio.app-store'),
      ('roles'),
      ('policies'),
      ('apps'),
      ('webhooks'),
      ('studio.logs');
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

-- Seed studio.app-store access into default policies
do $$
declare
  pol record;
begin
  for pol in
    select id from public.policies where name in ('Tenant Management', 'Full Platform Access') and is_system = true
  loop
    insert into public.policy_permissions (policy_id, resource_type, resource_id, permissions)
    values (pol.id, 'page', 'studio.app-store', '{"access": true}'::jsonb)
    on conflict (policy_id, resource_type, resource_id) do nothing;
  end loop;
end;
$$ language plpgsql;
