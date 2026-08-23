-- Follow-up to 0009_tag_photos.sql, same reason as 0002_grant_plants_table.sql:
-- an explicit GRANT is required or every request 403s before RLS is evaluated.
grant select, insert, update, delete on public.tag_photos to authenticated;
