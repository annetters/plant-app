-- Follow-up to 0025_usda_plant_names.sql, and the same trap 0002 documented
-- for `plants`: this project does not auto-expose new public-schema tables to
-- the Data API roles (see supabase/config.toml, `auto_expose_new_tables`).
--
-- 0025 granted `authenticated` its reads and stopped there, on the reasoning
-- that writes should reach the checklist only through the refresh function,
-- which uses the service role and so bypasses RLS. Bypassing RLS is not the
-- same as having a GRANT: the first refresh run failed with
--
--   permission denied for table usda_plant_names
--
-- before any policy was evaluated. RLS narrows access *within* a grant; it
-- never substitutes for one, and that holds for `service_role` exactly as it
-- does for `authenticated`.
grant select, insert, update, delete on public.usda_plant_names to service_role;
grant select, insert, update, delete on public.usda_plant_names_refresh to service_role;
