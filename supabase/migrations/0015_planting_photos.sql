-- Ticket #8: Planting: create + place Pin, view on tap.
-- Column shape mirrors packages/domain/src/planting.ts's PlantingPhotoRow —
-- keep them in sync.
--
-- A Planting's dated photo log gets its own table, not an array column like
-- plants.reference_photo_paths (0001_plants.sql) — each photo carries its
-- own date, which a plain path list can't.

create table if not exists public.planting_photos (
  id uuid primary key default gen_random_uuid(),
  planting_id uuid not null references public.plantings (id) on delete cascade,

  storage_path text not null check (char_length(trim(storage_path)) > 0),
  taken_on date not null,

  created_at timestamptz not null default now()
);

create index if not exists planting_photos_planting_id_idx on public.planting_photos (planting_id);

alter table public.planting_photos enable row level security;

-- Ownership is via the parent Planting -> Bed -> Property chain, not a
-- direct user_id column — same ownership-via-join pattern used throughout
-- (care_task_templates -> plants, beds -> properties, plantings -> beds).
create policy "Planting photos are selectable by their planting's owner"
  on public.planting_photos for select
  using (
    exists (
      select 1 from public.plantings pl
      join public.beds b on b.id = pl.bed_id
      join public.properties p on p.id = b.property_id
      where pl.id = planting_id and p.user_id = auth.uid ()
    )
  );

create policy "Planting photos are insertable by their planting's owner"
  on public.planting_photos for insert
  with check (
    exists (
      select 1 from public.plantings pl
      join public.beds b on b.id = pl.bed_id
      join public.properties p on p.id = b.property_id
      where pl.id = planting_id and p.user_id = auth.uid ()
    )
  );

create policy "Planting photos are deletable by their planting's owner"
  on public.planting_photos for delete
  using (
    exists (
      select 1 from public.plantings pl
      join public.beds b on b.id = pl.bed_id
      join public.properties p on p.id = b.property_id
      where pl.id = planting_id and p.user_id = auth.uid ()
    )
  );

-- Stored under `<user_id>/<planting_id>/<filename>`, mirroring
-- plant-reference-photos'/tag-photos' path convention so the storage
-- policies below can key off the path's leading folder alone.
insert into storage.buckets (id, name, public)
values ('planting-photos', 'planting-photos', false)
on conflict (id) do nothing;

create policy "Planting photos are readable by their owner"
  on storage.objects for select
  using (
    bucket_id = 'planting-photos'
    and auth.uid ()::text = (storage.foldername (name)) [1]
  );

create policy "Planting photos are uploadable by their owner"
  on storage.objects for insert
  with check (
    bucket_id = 'planting-photos'
    and auth.uid ()::text = (storage.foldername (name)) [1]
  );

create policy "Planting photos are deletable from storage by their owner"
  on storage.objects for delete
  using (
    bucket_id = 'planting-photos'
    and auth.uid ()::text = (storage.foldername (name)) [1]
  );
