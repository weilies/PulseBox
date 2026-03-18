-- Add direct FK from tenant_users.user_id to profiles.id
-- This enables PostgREST to resolve the join: tenant_users → profiles
alter table public.tenant_users
  add constraint tenant_users_profile_fk
  foreign key (user_id) references public.profiles(id);
