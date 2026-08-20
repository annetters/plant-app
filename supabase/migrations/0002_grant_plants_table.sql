-- Follow-up to 0001_plants.sql: newer Supabase projects no longer
-- auto-expose new public-schema tables to the Data API roles (see this
-- repo's supabase/config.toml, `auto_expose_new_tables` comment). Without
-- an explicit GRANT, every request 403s with "permission denied for table
-- plants" before RLS is ever evaluated — RLS narrows access *within* a
-- grant, it doesn't substitute for one.
grant usage on schema public to authenticated;

grant select, insert, update, delete on public.plants to authenticated;
