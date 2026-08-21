-- Follow-up to 0006_properties.sql, mirroring 0002/0004's grant for the
-- same reason: newer Supabase projects don't auto-expose new public-schema
-- tables to the Data API roles, so without this every request 403s before
-- RLS is ever evaluated.
grant usage on schema public to authenticated;

grant select, insert, update, delete on public.properties to authenticated;
