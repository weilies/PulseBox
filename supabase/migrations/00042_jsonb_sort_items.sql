-- JSONB field sorting for collection items
-- Allows sorting items by any field stored in the JSONB `data` column

create or replace function public.get_collection_items_sorted(
  p_collection_id uuid,
  p_tenant_id uuid,
  p_sort_field text,
  p_sort_ascending boolean default true,
  p_offset int default 0,
  p_limit int default 20
)
returns table (
  id uuid,
  data jsonb,
  created_at timestamptz,
  updated_at timestamptz,
  total_count bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  return query
    select
      ci.id,
      ci.data,
      ci.created_at,
      ci.updated_at,
      count(*) over () as total_count
    from public.collection_items ci
    where ci.collection_id = p_collection_id
      and ci.tenant_id = p_tenant_id
    order by
      case when p_sort_ascending then ci.data ->> p_sort_field end asc nulls last,
      case when not p_sort_ascending then ci.data ->> p_sort_field end desc nulls last
    offset p_offset
    limit p_limit;
end;
$$;
