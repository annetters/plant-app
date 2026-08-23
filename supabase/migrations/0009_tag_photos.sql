-- Ticket #20: Tag Scan build.
-- Column shape mirrors packages/domain/src/tagScanCandidate.ts and
-- tagScanMatching.ts's use of tag photos — keep them in sync.
--
-- A tag photo is captured before a Plant record exists (at the start of a
-- scan, before OCR/manual entry and duplicate matching decide whether a new
-- Plant gets created or an existing one is reused) — so it needs its own
-- table with a nullable plant_id linked after the fact, not a column on
-- plants. It is also its own category, distinct from plants' reference
-- photos and never mixed with them (see 0001_plants.sql's reference_photo_paths
-- comment) — kept by default, deletable afterward.

create table if not exists public.tag_photos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plant_id uuid references public.plants (id) on delete set null,

  storage_path text not null check (char_length(trim(storage_path)) > 0),
  kept boolean not null default true,

  created_at timestamptz not null default now()
);

create index if not exists tag_photos_user_id_idx on public.tag_photos (user_id);
create index if not exists tag_photos_plant_id_idx on public.tag_photos (plant_id);

alter table public.tag_photos enable row level security;

create policy "Tag photos are selectable by their owner"
  on public.tag_photos for select
  using (auth.uid () = user_id);

create policy "Tag photos are insertable by their owner"
  on public.tag_photos for insert
  with check (auth.uid () = user_id);

create policy "Tag photos are updatable by their owner"
  on public.tag_photos for update
  using (auth.uid () = user_id)
  with check (auth.uid () = user_id);

create policy "Tag photos are deletable by their owner"
  on public.tag_photos for delete
  using (auth.uid () = user_id);

-- Stored under `<user_id>/<scan_id>/<filename>` — scan_id (client-generated),
-- not plant_id, since the photo is uploaded before a Plant id exists.
insert into storage.buckets (id, name, public)
values ('tag-photos', 'tag-photos', false)
on conflict (id) do nothing;

create policy "Tag photos are readable by their owner"
  on storage.objects for select
  using (
    bucket_id = 'tag-photos'
    and auth.uid ()::text = (storage.foldername (name)) [1]
  );

create policy "Tag photos are uploadable by their owner"
  on storage.objects for insert
  with check (
    bucket_id = 'tag-photos'
    and auth.uid ()::text = (storage.foldername (name)) [1]
  );

create policy "Tag photos are deletable from storage by their owner"
  on storage.objects for delete
  using (
    bucket_id = 'tag-photos'
    and auth.uid ()::text = (storage.foldername (name)) [1]
  );
