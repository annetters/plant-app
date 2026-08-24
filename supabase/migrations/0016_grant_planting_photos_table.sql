-- Follow-up to 0015_planting_photos.sql, same reason as 0014's grant.
grant usage on schema public to authenticated;

grant select, insert, delete on public.planting_photos to authenticated;
