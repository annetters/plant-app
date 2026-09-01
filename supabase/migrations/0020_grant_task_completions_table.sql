-- Follow-up to 0019_task_completions.sql: see 0002_grant_plants_table.sql
-- for why an explicit grant is required alongside RLS.
grant select, insert, update on public.task_completions to authenticated;
