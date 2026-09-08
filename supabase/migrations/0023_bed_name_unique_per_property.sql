-- QA finding (2026-09-07): three Beds could be created on one Property named
-- "Test", "test" and "test". A Bed is identified by its id and the name is a
-- convenience layer for the gardener — but it is the layer the Registry's map
-- links are written in ("View in Front Border on the map"), so duplicate names
-- make those links ambiguous and make a misplaced Pin impossible to describe.
--
-- Applied with a backfill rather than grandfathered because every account on
-- this project today belongs to the same person (confirmed 2026-09-07), so
-- renaming a row is not rewriting someone else's content. Do NOT reuse this
-- shape once there are third-party users: there is no Bed rename anywhere in
-- the app (bedsRepository has list/create/remove and no update), so a renamed
-- Bed cannot be corrected in-app except by deleting it, which cascades away
-- every Planting on it.

-- Step 1: de-duplicate existing names, per Property, case- and
-- whitespace-insensitively. The oldest Bed in each colliding group keeps its
-- name; the rest are suffixed by their position within the group.
--
-- Looped because a rename can collide afresh: a Property holding "Test",
-- "test" and an existing "Test 2" turns the second "test" into "Test 2",
-- which now duplicates the one already there. Each pass strictly lengthens
-- the names it touches, so this converges; the counter is a guard against a
-- pathological case rather than an expected path.
do $$
declare
  renamed integer;
  passes integer := 0;
begin
  loop
    with ranked as (
      select
        id,
        name,
        row_number() over (
          partition by property_id, lower(trim(name))
          order by created_at, id
        ) as position
      from public.beds
    )
    update public.beds b
    set name = trim(r.name) || ' ' || r.position
    from ranked r
    where b.id = r.id
      and r.position > 1;

    get diagnostics renamed = row_count;
    passes := passes + 1;

    if renamed > 0 then
      raise notice 'Bed name de-duplication pass %: renamed % Bed(s)', passes, renamed;
    end if;

    exit when renamed = 0;

    if passes >= 10 then
      raise exception 'Bed name de-duplication did not converge after % passes', passes;
    end if;
  end loop;

  raise notice 'Bed name de-duplication complete after % pass(es)', passes;
end;
$$;

-- Step 2: the constraint itself. Case- and whitespace-insensitive, matching
-- `validateBedInput`'s own normalization in packages/domain/src/bed.ts — keep
-- the two in sync. The app check is what produces a readable message; this
-- index is what makes the rule true in the data.
create unique index if not exists beds_unique_name_per_property
  on public.beds (property_id, lower(trim(name)));
