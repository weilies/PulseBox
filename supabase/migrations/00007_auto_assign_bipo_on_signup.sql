-- Fix: Auto-assign new users to BIPO super tenant on signup
-- This ensures every user has at least one tenant assignment

-- Drop the old trigger function
drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- Create new trigger function that also assigns to BIPO
create or replace function public.handle_new_user()
returns trigger as $$
declare
  bipo_tenant_id uuid;
begin
  -- Insert user profile
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', '')
  );

  -- Get BIPO super tenant ID
  select id into bipo_tenant_id from public.tenants where is_super = true limit 1;

  -- Auto-assign to BIPO as tenant_admin, set as default
  if bipo_tenant_id is not null then
    insert into public.tenant_users (tenant_id, user_id, role, is_default)
    values (bipo_tenant_id, new.id, 'tenant_admin', true)
    on conflict (tenant_id, user_id) do nothing;
  end if;

  return new;
end;
$$ language plpgsql security definer;

-- Recreate trigger
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();
