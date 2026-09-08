-- Removes the task system entirely: Care task templates, Task triggers, Task
-- completions and One-off todos. See docs/adr/0005-remove-the-task-system.md
-- for why, including why this reverses the 2026-09-03 decision to retain the
-- feature live but outside the MVP commitment.
--
-- This is a data-destroying migration, run deliberately: the gardener chose
-- not to export the rows first (every account on this project belongs to the
-- same person, confirmed 2026-09-08). Reverting the accompanying commit
-- restores the application code; it does not restore these rows.
--
-- Drop order follows the foreign keys: task_completions references both
-- care_task_templates and plantings, so it goes first. Nothing in the schema
-- references these three tables, so nothing else is affected — the mentions
-- of care_task_templates in 0011 and 0015 are explanatory comments about the
-- ownership-via-join RLS pattern, not dependencies.
--
-- Creating migrations, superseded by this one: 0003/0004 (care_task_templates
-- and its grants), 0019/0020 (task_completions), 0021/0022 (one_off_todos).
-- Their policies and grants are dropped with the tables they belong to.

drop table if exists public.task_completions;
drop table if exists public.care_task_templates;
drop table if exists public.one_off_todos;
