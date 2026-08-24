-- Follow-up to 0013_plantings.sql, mirroring 0002/0004/0007/0010/0012's
-- grant for the same reason: newer Supabase projects don't auto-expose new
-- public-schema tables to the Data API roles, so without this every
-- request 403s before RLS is ever evaluated.
grant usage on schema public to authenticated;

grant select, insert, delete on public.plantings to authenticated;
