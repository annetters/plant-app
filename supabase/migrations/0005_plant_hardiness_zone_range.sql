-- Reworks Plant.hardinessZone from a single value into a whole-zone
-- range — a nursery tag reads "Zones 5-7", never a single value, and
-- never with a/b half-zone precision (that only applies to a single
-- real-world location's zone, not a plant's tolerance range). Column
-- shape mirrors packages/domain/src/plant.ts's PlantRow — keep in sync.

alter table public.plants drop column if exists hardiness_zone;

alter table public.plants
  add column hardiness_zone_min smallint check (hardiness_zone_min between 1 and 13),
  add column hardiness_zone_max smallint check (hardiness_zone_max between 1 and 13);

alter table public.plants
  add constraint plants_hardiness_zone_range_complete check (
    (hardiness_zone_min is null) = (hardiness_zone_max is null)
  ),
  add constraint plants_hardiness_zone_range_ordered check (
    hardiness_zone_max is null or hardiness_zone_max >= hardiness_zone_min
  );
