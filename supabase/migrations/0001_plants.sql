-- Ticket #3: Plant record CRUD (manual entry).
-- Column shape mirrors packages/domain/src/plant.ts's PlantRow — keep them in sync.

create table if not exists public.plants (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,

  common_name text not null check (char_length(trim(common_name)) > 0),
  scientific_name text not null check (char_length(trim(scientific_name)) > 0),
  cultivar text,
  flower_color text,

  bloom_start_month smallint check (bloom_start_month between 1 and 12),
  bloom_start_day smallint check (bloom_start_day between 1 and 31),
  bloom_end_month smallint check (bloom_end_month between 1 and 12),
  bloom_end_day smallint check (bloom_end_day between 1 and 31),
  constraint plants_bloom_window_complete check (
    (bloom_start_month is null) = (bloom_start_day is null)
    and (bloom_start_month is null) = (bloom_end_month is null)
    and (bloom_start_month is null) = (bloom_end_day is null)
  ),

  sun_requirement text check (sun_requirement in ('full-sun', 'part-sun', 'part-shade', 'full-shade')),
  mature_height_inches numeric check (mature_height_inches > 0),
  mature_spread_inches numeric check (mature_spread_inches > 0),
  hardiness_zone text,
  foliage_type text check (foliage_type in ('deciduous', 'evergreen')),
  native_status text check (native_status in ('native', 'non-native')),

  -- Reference photos only (visual identification). Tag Scan photos are a
  -- separate category per CONTEXT.md and never land in this column.
  reference_photo_paths text[] not null default '{}',

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists plants_user_id_idx on public.plants (user_id);

alter table public.plants enable row level security;

create policy "Plants are selectable by their owner"
  on public.plants for select
  using (auth.uid () = user_id);

create policy "Plants are insertable by their owner"
  on public.plants for insert
  with check (auth.uid () = user_id);

create policy "Plants are updatable by their owner"
  on public.plants for update
  using (auth.uid () = user_id)
  with check (auth.uid () = user_id);

create policy "Plants are deletable by their owner"
  on public.plants for delete
  using (auth.uid () = user_id);

create or replace function public.set_updated_at ()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger plants_set_updated_at
  before update on public.plants
  for each row
  execute function public.set_updated_at ();

-- Reference photos, stored under `<user_id>/<plant_id>/<filename>` so the
-- storage policies below can key off the path's leading folder alone.
insert into storage.buckets (id, name, public)
values ('plant-reference-photos', 'plant-reference-photos', false)
on conflict (id) do nothing;

create policy "Reference photos are readable by their owner"
  on storage.objects for select
  using (
    bucket_id = 'plant-reference-photos'
    and auth.uid ()::text = (storage.foldername (name)) [1]
  );

create policy "Reference photos are uploadable by their owner"
  on storage.objects for insert
  with check (
    bucket_id = 'plant-reference-photos'
    and auth.uid ()::text = (storage.foldername (name)) [1]
  );

create policy "Reference photos are deletable by their owner"
  on storage.objects for delete
  using (
    bucket_id = 'plant-reference-photos'
    and auth.uid ()::text = (storage.foldername (name)) [1]
  );
