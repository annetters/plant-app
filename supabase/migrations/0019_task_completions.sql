-- Ticket #12: Task completion logging, history, and one-off todos.
-- Column shape mirrors packages/domain/src/taskCompletion.ts's TaskCompletionRow — keep them in sync.

create table if not exists public.task_completions (
  id uuid primary key default gen_random_uuid(),
  care_task_template_id uuid not null references public.care_task_templates (id) on delete cascade,
  planting_id uuid not null references public.plantings (id) on delete cascade,

  year integer not null check (year between 1900 and 2100),
  status text not null check (status in ('done', 'missed')),

  created_at timestamptz not null default now(),

  -- One completion per template/Planting/year — marking a task done again
  -- for the same trio updates the existing record instead of piling up
  -- duplicates (see CONTEXT.md's Task completion entry: a Plant with N
  -- templates always produces N completions per year per Planting, never
  -- more).
  constraint task_completions_unique_template_planting_year
    unique (care_task_template_id, planting_id, year)
);

create index if not exists task_completions_planting_id_idx on public.task_completions (planting_id);
create index if not exists task_completions_care_task_template_id_idx
  on public.task_completions (care_task_template_id);

alter table public.task_completions enable row level security;

-- Ownership is via the parent Planting (-> Bed -> Property), not a direct
-- user_id column — same ownership-via-join pattern as planting_photos
-- (0015_planting_photos.sql).
create policy "Task completions are selectable by their planting's owner"
  on public.task_completions for select
  using (
    exists (
      select 1 from public.plantings pl
      join public.beds b on b.id = pl.bed_id
      join public.properties p on p.id = b.property_id
      where pl.id = planting_id and p.user_id = auth.uid ()
    )
  );

-- Insert/update also checks the referenced Care task template's ownership,
-- not just the Planting's — same two-parent-reference guard as plantings'
-- own insert policy (0013_plantings.sql), so a client can't point
-- care_task_template_id at another account's template.
create policy "Task completions are insertable by their planting's owner"
  on public.task_completions for insert
  with check (
    exists (
      select 1 from public.plantings pl
      join public.beds b on b.id = pl.bed_id
      join public.properties p on p.id = b.property_id
      where pl.id = planting_id and p.user_id = auth.uid ()
    )
    and exists (
      select 1 from public.care_task_templates t
      join public.plants pt on pt.id = t.plant_id
      where t.id = care_task_template_id and pt.user_id = auth.uid ()
    )
  );

create policy "Task completions are updatable by their planting's owner"
  on public.task_completions for update
  using (
    exists (
      select 1 from public.plantings pl
      join public.beds b on b.id = pl.bed_id
      join public.properties p on p.id = b.property_id
      where pl.id = planting_id and p.user_id = auth.uid ()
    )
  )
  with check (
    exists (
      select 1 from public.plantings pl
      join public.beds b on b.id = pl.bed_id
      join public.properties p on p.id = b.property_id
      where pl.id = planting_id and p.user_id = auth.uid ()
    )
    and exists (
      select 1 from public.care_task_templates t
      join public.plants pt on pt.id = t.plant_id
      where t.id = care_task_template_id and pt.user_id = auth.uid ()
    )
  );
