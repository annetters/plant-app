-- Ticket #36: the USDA species lookup missed most garden plants.
--
-- The cause was never USDA's coverage — it was the table being queried.
-- `characteristicSearchResults` is a 2,186-entry NRCS conservation-plant
-- traits subset, and the app treated it as the species universe, so a plain
-- binomial like *Dahlia pinnata* could not be recognised as a real plant name
-- at all. USDA's full checklist carries 48,994 accepted names plus 44,163
-- synonyms, and resolved 57 of 60 ordinary garden ornamentals against that
-- subset's 10. `docs/research/usda-plants-name-resolution.md` measured it.
--
-- Direction taken (agreed with the user 2026-09-08): **ingest, don't proxy** —
-- names live here, traits stay live from USDA. USDA's Help Document states the
-- plant data "is not copyrighted and is free for any use", citation requested;
-- images are a separate, stricter regime and are deliberately untouched. A
-- table rather than a bundled file because one copy serves web and mobile, a
-- refresh needs no App Store release, and it moves an undocumented endpoint
-- out of the per-keystroke path.
--
--   USDA, NRCS. The PLANTS Database (http://plants.usda.gov, 9 September 2026).
--   National Plant Data Team, Greensboro, NC USA.

-- Substring matching over 93k rows per keystroke. USDA's compound common
-- names make this unavoidable: "sunflower" has to find "common sunflower",
-- which no prefix index can do.
create extension if not exists pg_trgm with schema extensions;

create table if not exists public.usda_plant_names (
  -- The *accepted* taxon's symbol. Synonym rows repeat it — that repetition
  -- is what makes them a synonym mapping, and it's why the lookup can answer
  -- "Sedum spectabile" with the accepted *Hylotelephium spectabile*.
  symbol text not null,
  -- This row's own symbol when it is a synonym. Empty string, not null, on an
  -- accepted row: it is half the primary key, and a nullable key column would
  -- make `on conflict` upserts silently insert duplicates instead of updating.
  synonym_symbol text not null default '',

  -- Author stripped (`usdaScientificNameWithoutAuthor`) — the form a gardener
  -- types and the form written into a Plant.
  scientific_name text not null check (char_length(trim(scientific_name)) > 0),
  -- Kept verbatim so a correction to the parser can be re-derived without
  -- re-downloading 6.7 MB from an endpoint that has no uptime promise.
  scientific_name_with_author text not null,
  common_name text,
  family text,

  -- Stamped with the refresh run that wrote the row, so the run can sweep away
  -- taxa USDA has dropped without ever emptying the table: upsert everything,
  -- then delete what this run didn't touch. A run that dies half way leaves a
  -- mix of old and new rows — every one of them a real name — rather than a
  -- hole where the lookup used to be.
  refreshed_at timestamptz not null default now(),

  -- USDA collapses the space in most compound common names: the file holds
  -- "beebalm" 29 times and "bee balm" zero, so the way a human writes it
  -- matches nothing. Generated and indexed rather than computed per query so
  -- the trigram index can actually be used.
  common_name_collapsed text generated always as (
    regexp_replace(lower(coalesce(common_name, '')), '[^a-z0-9]', '', 'g')
  ) stored,

  primary key (symbol, synonym_symbol)
);

comment on table public.usda_plant_names is
  'USDA PLANTS checklist (plantlst.txt), refreshed by the usda-plant-names-refresh Edge Function. Public-domain reference data, not user data. See #36.';

create index if not exists usda_plant_names_scientific_name_trgm_idx
  on public.usda_plant_names using gin (lower(scientific_name) extensions.gin_trgm_ops);
create index if not exists usda_plant_names_common_name_trgm_idx
  on public.usda_plant_names using gin (common_name_collapsed extensions.gin_trgm_ops);
-- Exact scientific-name resolution (the traits path) shouldn't pay for a
-- trigram scan.
create index if not exists usda_plant_names_scientific_name_lower_idx
  on public.usda_plant_names (lower(scientific_name));
-- The stale-row sweep at the end of a refresh.
create index if not exists usda_plant_names_refreshed_at_idx
  on public.usda_plant_names (refreshed_at);
-- Every match joins back to its accepted row.
create index if not exists usda_plant_names_accepted_idx
  on public.usda_plant_names (symbol)
  where synonym_symbol = '';

-- When the checklist was last pulled, and what USDA's `Last-Modified` said at
-- the time, so a refresh can be a conditional request. USDA publishes no
-- update schedule — check the header, never assume a cadence.
create table if not exists public.usda_plant_names_refresh (
  id boolean primary key default true check (id),
  source_last_modified text,
  source_row_count integer,
  refreshed_at timestamptz not null default now()
);

-- Public-domain reference data with no user rows in it, but RLS is on so the
-- table can't be reached without a policy saying so. Reads are open to any
-- signed-in user; writes have no policy at all, so only the service role (used
-- by the refresh function, which bypasses RLS) can write.
alter table public.usda_plant_names enable row level security;
alter table public.usda_plant_names_refresh enable row level security;

create policy "USDA plant names are readable by any signed-in user"
  on public.usda_plant_names for select
  to authenticated
  using (true);

create policy "USDA refresh state is readable by any signed-in user"
  on public.usda_plant_names_refresh for select
  to authenticated
  using (true);

-- Per 0002_grant_plants_table.sql: a GRANT is required before RLS is ever
-- evaluated on this project.
grant select on public.usda_plant_names to authenticated;
grant select on public.usda_plant_names_refresh to authenticated;

/*
 * Name resolution, ranked. One entry point for both the common-name lookup
 * and (later) #43's as-you-type suggestions, so the two can't drift apart.
 *
 * Returns one row per *accepted taxon*, never one per matching name row: a
 * synonym hit resolves to the name USDA accepts today, which is the whole
 * value of ingesting the 44,163 synonym rows. Nursery tags print outdated
 * names routinely.
 */
create or replace function public.search_usda_plant_names (
  search_text text,
  result_limit integer default 25
)
returns table (
  symbol text,
  scientific_name text,
  common_name text,
  family text,
  matched_name text,
  is_synonym boolean
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  with input as (
    select
      needle,
      -- Escaped for LIKE. A gardener has no reason to type `%` or `_`, but
      -- unescaped they are wildcards, and `%` alone would match every row.
      replace(replace(replace(needle, '\', '\\'), '%', '\%'), '_', '\_') as needle_like,
      -- USDA collapses the space in most compound common names — the file
      -- holds "beebalm" 29 times and "bee balm" zero — so both sides get
      -- flattened to letters and digits before comparing. That also leaves
      -- nothing here for LIKE to treat as a wildcard.
      regexp_replace(needle, '[^a-z0-9]', '', 'g') as collapsed,
      -- One caller passing a silly number must not be able to ask for 93k rows.
      least(greatest(coalesce(result_limit, 25), 1), 100) as capped_limit
    from (select lower(trim(coalesce(search_text, ''))) as needle) raw
  ),
  matches as (
    select distinct on (n.symbol)
      n.symbol,
      -- The three orphan synonym rows in the 2025-05-29 file point at an
      -- accepted symbol that isn't in it, hence the left join and coalesce.
      coalesce(a.scientific_name, n.scientific_name) as scientific_name,
      coalesce(a.common_name, n.common_name) as common_name,
      coalesce(a.family, n.family) as family,
      n.scientific_name as matched_name,
      n.synonym_symbol <> '' as is_synonym,
      case
        when lower(n.scientific_name) = i.needle then 0
        when lower(n.common_name) = i.needle then 1
        when i.collapsed <> '' and n.common_name_collapsed = i.collapsed then 2
        when lower(n.scientific_name) like i.needle_like || '%' escape '\' then 3
        when i.collapsed <> '' and n.common_name_collapsed like i.collapsed || '%' then 4
        when lower(n.scientific_name) like '%' || i.needle_like || '%' escape '\' then 5
        else 6
      end as rank,
      char_length(coalesce(a.scientific_name, n.scientific_name)) as name_length
    from input i
    join public.usda_plant_names n
      on lower(n.scientific_name) like '%' || i.needle_like || '%' escape '\'
      -- Guarded: a query of pure punctuation collapses to the empty string,
      -- and `like '%%'` would quietly match all 93,157 rows.
      or (i.collapsed <> '' and n.common_name_collapsed like '%' || i.collapsed || '%')
    left join public.usda_plant_names a
      on a.symbol = n.symbol and a.synonym_symbol = ''
    -- Below three characters a substring search matches a large slice of the
    -- database and the result reads as an ambiguity between species when it
    -- is really just noise. Mirrors MINIMUM_COMMON_NAME_LOOKUP_LENGTH in
    -- apps/mobile/src/species/speciesLookup.ts.
    where char_length(i.needle) >= 3
    -- Which of a taxon's names represents it: the best-ranked one, and only
    -- then the accepted name over a synonym. Rank has to come first. A
    -- gardener typing the synonym *Sedum spectabile* also substring-matches
    -- the accepted *Hylotelephium spectabile*, and preferring accepted rows
    -- ahead of rank would hand back the accepted row as the *match* — turning
    -- an exact hit into a fuzzy one and failing the caller's exactness check.
    order by n.symbol, rank, (n.synonym_symbol <> ''), char_length(n.scientific_name)
  )
  select m.symbol, m.scientific_name, m.common_name, m.family, m.matched_name, m.is_synonym
  from matches m
  order by m.rank, m.is_synonym, m.name_length, m.scientific_name
  limit (select capped_limit from input);
$$;

grant execute on function public.search_usda_plant_names (text, integer) to authenticated;
