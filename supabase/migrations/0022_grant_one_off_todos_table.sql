-- Follow-up to 0021_one_off_todos.sql: see 0002_grant_plants_table.sql
-- for why an explicit grant is required alongside RLS.
grant select, insert, update, delete on public.one_off_todos to authenticated;
