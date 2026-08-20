-- Ticket #4: Care task templates on Plant.
-- Column shape mirrors packages/domain/src/careTaskTemplate.ts's
-- CareTaskTemplateRow — keep them in sync.

create table if not exists public.care_task_templates (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants (id) on delete cascade,

  name text not null check (char_length(trim(name)) > 0),

  trigger_type text not null check (trigger_type in ('date-range', 'seasonal-marker')),

  date_start_month smallint check (date_start_month between 1 and 12),
  date_start_day smallint check (date_start_day between 1 and 31),
  date_end_month smallint check (date_end_month between 1 and 12),
  date_end_day smallint check (date_end_day between 1 and 31),
  seasonal_marker_text text,

  -- Exactly one trigger's fields are populated, matching trigger_type — a
  -- template is never left ambiguous between a computed date and freeform text.
  constraint care_task_templates_trigger_fields_match_type check (
    (
      trigger_type = 'date-range'
      and date_start_month is not null
      and date_start_day is not null
      and date_end_month is not null
      and date_end_day is not null
      and seasonal_marker_text is null
    )
    or (
      trigger_type = 'seasonal-marker'
      and date_start_month is null
      and date_start_day is null
      and date_end_month is null
      and date_end_day is null
      and seasonal_marker_text is not null
      and char_length(trim(seasonal_marker_text)) > 0
    )
  ),

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists care_task_templates_plant_id_idx on public.care_task_templates (plant_id);

alter table public.care_task_templates enable row level security;

-- Ownership is via the parent Plant, not a direct user_id column — a Care
-- task template has no owner of its own, per CONTEXT.md.
create policy "Care task templates are selectable by their plant's owner"
  on public.care_task_templates for select
  using (
    exists (
      select 1 from public.plants p
      where p.id = plant_id and p.user_id = auth.uid ()
    )
  );

create policy "Care task templates are insertable by their plant's owner"
  on public.care_task_templates for insert
  with check (
    exists (
      select 1 from public.plants p
      where p.id = plant_id and p.user_id = auth.uid ()
    )
  );

create policy "Care task templates are updatable by their plant's owner"
  on public.care_task_templates for update
  using (
    exists (
      select 1 from public.plants p
      where p.id = plant_id and p.user_id = auth.uid ()
    )
  )
  with check (
    exists (
      select 1 from public.plants p
      where p.id = plant_id and p.user_id = auth.uid ()
    )
  );

create policy "Care task templates are deletable by their plant's owner"
  on public.care_task_templates for delete
  using (
    exists (
      select 1 from public.plants p
      where p.id = plant_id and p.user_id = auth.uid ()
    )
  );

create trigger care_task_templates_set_updated_at
  before update on public.care_task_templates
  for each row
  execute function public.set_updated_at ();
