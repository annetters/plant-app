-- Ticket #8: Planting: create + place Pin, view on tap.
-- Column shape mirrors packages/domain/src/planting.ts's PlantingRow — keep them in sync.

create table if not exists public.plantings (
  id uuid primary key default gen_random_uuid(),
  plant_id uuid not null references public.plants (id) on delete cascade,
  bed_id uuid not null references public.beds (id) on delete cascade,

  quantity integer not null check (quantity >= 1),
  year_acquired integer check (year_acquired between 1900 and 2100),
  source_nursery text,

  -- Pin location, in the same Property-relative real-world-feet coordinate
  -- space as the parent Bed's own outline points (see 0011_beds.sql /
  -- bed.ts) — never pixels, and never a Bed-local offset, so a Bed's
  -- outline and every Pin within it stay in one consistent frame.
  pin_x numeric not null,
  pin_y numeric not null,

  created_at timestamptz not null default now()
);

create index if not exists plantings_plant_id_idx on public.plantings (plant_id);
create index if not exists plantings_bed_id_idx on public.plantings (bed_id);

alter table public.plantings enable row level security;

-- Ownership is via the parent Bed (-> Property), not a direct user_id
-- column — a Planting has no owner of its own, per CONTEXT.md. Same
-- ownership-via-join pattern as beds' own join to properties.
create policy "Plantings are selectable by their bed's property owner"
  on public.plantings for select
  using (
    exists (
      select 1 from public.beds b
      join public.properties p on p.id = b.property_id
      where b.id = bed_id and p.user_id = auth.uid ()
    )
  );

-- Insert also checks the referenced Plant's ownership, not just the Bed's —
-- a Planting has two parent references, and both must belong to the same
-- account, or a client could point plant_id at another account's Plant.
create policy "Plantings are insertable by their bed's property owner"
  on public.plantings for insert
  with check (
    exists (
      select 1 from public.beds b
      join public.properties p on p.id = b.property_id
      where b.id = bed_id and p.user_id = auth.uid ()
    )
    and exists (
      select 1 from public.plants pl
      where pl.id = plant_id and pl.user_id = auth.uid ()
    )
  );

create policy "Plantings are deletable by their bed's property owner"
  on public.plantings for delete
  using (
    exists (
      select 1 from public.beds b
      join public.properties p on p.id = b.property_id
      where b.id = bed_id and p.user_id = auth.uid ()
    )
  );
