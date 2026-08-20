-- Follow-up to 0003_care_task_templates.sql: see 0002_grant_plants_table.sql
-- for why an explicit grant is required alongside RLS.
grant select, insert, update, delete on public.care_task_templates to authenticated;
