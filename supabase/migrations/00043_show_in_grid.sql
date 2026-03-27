-- Add show_in_grid column to collection_fields
alter table collection_fields
  add column if not exists show_in_grid boolean not null default false;

-- Backfill: all existing fields become visible in grid
update collection_fields set show_in_grid = true;
