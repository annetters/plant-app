-- Ticket #6: Property: photographed/in-app-drawn base map + Scale Reference.
-- Column shape mirrors packages/domain/src/property.ts's PropertyRow — keep them in sync.
--
-- Every existing Property row created before this migration has aerial
-- imagery (ticket #5's only source so far), so defaulting base_map_source to
-- 'aerial' with no backfill is correct for them too — same no-backfill
-- precedent as migrations 0005/0008 (personal single-user app).

alter table public.properties
  add column if not exists base_map_source text not null default 'aerial'
    check (base_map_source in ('aerial', 'photo', 'drawn')),
  add column if not exists base_map_photo_path text,
  -- Hand-drawn structural plan: one polyline (array of {x, y} points) per
  -- stroke, in the drawing canvas's own pixel space — never feet, since this
  -- *is* the base layer Beds get drawn against, not a Bed outline itself.
  add column if not exists base_map_drawing jsonb,
  -- {pointA, pointB, realDistanceFeet, mode} — see scaleReference.ts.
  -- Always null for an 'aerial' Property, which derives scale from
  -- latitude/imagery_zoom instead.
  add column if not exists scale_reference jsonb;

-- Ticket #6's own acceptance criterion ("one base-map source per Property,
-- no mixing") enforced at the schema level, not just by application code
-- always writing all three columns together in one update (`updateBaseMap`)
-- — same precedent as 0001_plants.sql's plants_bloom_window_complete check.
alter table public.properties
  drop constraint if exists properties_base_map_source_consistent;

alter table public.properties
  add constraint properties_base_map_source_consistent check (
    case base_map_source
      when 'aerial' then base_map_photo_path is null and base_map_drawing is null and scale_reference is null
      when 'photo' then base_map_photo_path is not null and base_map_drawing is null and scale_reference is not null
      when 'drawn' then base_map_photo_path is null and base_map_drawing is not null and scale_reference is not null
    end
  );

-- Stored under `<user_id>/<property_id>/<filename>`, same convention as
-- plant-reference-photos/tag-photos/planting-photos.
insert into storage.buckets (id, name, public)
values ('property-base-map-photos', 'property-base-map-photos', false)
on conflict (id) do nothing;

create policy "Property base map photos are readable by their owner"
  on storage.objects for select
  using (
    bucket_id = 'property-base-map-photos'
    and auth.uid ()::text = (storage.foldername (name)) [1]
  );

create policy "Property base map photos are uploadable by their owner"
  on storage.objects for insert
  with check (
    bucket_id = 'property-base-map-photos'
    and auth.uid ()::text = (storage.foldername (name)) [1]
  );

create policy "Property base map photos are deletable from storage by their owner"
  on storage.objects for delete
  using (
    bucket_id = 'property-base-map-photos'
    and auth.uid ()::text = (storage.foldername (name)) [1]
  );
