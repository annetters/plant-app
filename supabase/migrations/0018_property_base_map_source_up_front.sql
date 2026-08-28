-- Follow-up to ticket #6, raised after 0017 had already shipped: base-map
-- source is now a free, up-front choice at Property creation (aerial /
-- photo / drawn), not just a fallback offered once an address turns out to
-- have no aerial coverage. A 'photo'/'drawn' Property may have no address
-- at all — some gardeners pick those sources specifically so no address is
-- ever geocoded or sent to Esri for their Property — and is identified by
-- a user-chosen `name` instead. An 'aerial' Property still requires
-- address/latitude/longitude, enforced below.
alter table public.properties
  alter column address drop not null,
  alter column latitude drop not null,
  alter column longitude drop not null,
  add column if not exists name text;

alter table public.properties
  add constraint properties_identified_by_address_or_name check (
    address is not null or name is not null
  );

alter table public.properties
  add constraint properties_aerial_requires_location check (
    base_map_source <> 'aerial' or (address is not null and latitude is not null and longitude is not null)
  );
