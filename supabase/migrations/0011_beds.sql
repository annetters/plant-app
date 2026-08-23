-- Ticket #7: Bed drawing (desktop).
-- Column shape mirrors packages/domain/src/bed.ts's BedRow — keep them in sync.

create table if not exists public.beds (
  id uuid primary key default gen_random_uuid(),
  property_id uuid not null references public.properties (id) on delete cascade,

  name text not null check (char_length(trim(name)) > 0),
  tool text not null check (tool in ('freehand', 'rectangle', 'oval', 'pen')),

  -- Raw traced outline in real-world feet, never pixels — an array of
  -- {x, y} points. Stored raw, smoothed only at render time (see
  -- smoothing_enabled below and ADR-0001): this is what keeps a Bed's
  -- geometry correct even after its Property's base image is replaced.
  points jsonb not null,
  smoothing_enabled boolean not null default false,

  created_at timestamptz not null default now(),

  constraint beds_points_has_at_least_3_points check (jsonb_array_length(points) >= 3)
);

create index if not exists beds_property_id_idx on public.beds (property_id);

alter table public.beds enable row level security;

-- Ownership is via the parent Property, not a direct user_id column — a Bed
-- has no owner of its own, per CONTEXT.md. Same pattern as
-- care_task_templates' ownership-via-plants join.
create policy "Beds are selectable by their property's owner"
  on public.beds for select
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_id and p.user_id = auth.uid ()
    )
  );

create policy "Beds are insertable by their property's owner"
  on public.beds for insert
  with check (
    exists (
      select 1 from public.properties p
      where p.id = property_id and p.user_id = auth.uid ()
    )
  );

create policy "Beds are deletable by their property's owner"
  on public.beds for delete
  using (
    exists (
      select 1 from public.properties p
      where p.id = property_id and p.user_id = auth.uid ()
    )
  );
