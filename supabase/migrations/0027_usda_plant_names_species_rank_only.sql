-- Follow-up to 0025_usda_plant_names.sql, found by running the real index.
--
-- USDA's checklist carries 5,082 accepted rows *above* species rank — genera,
-- families and higher — alongside the 43,912 at species rank or below. With
-- them included, "dahlia" answered with the genus row `Dahlia` ranked first,
-- ahead of *Dahlia pinnata*.
--
-- Two things wrong with that. CONTEXT.md's Tag Scan rule is explicit —
-- matching "resolves to genus, species, **and** cultivar — never just a common
-- name or genus" — and picking that candidate wrote a bare genus into the
-- Plant's scientific name. It also cost a slot: the genus row displaced a real
-- species from a capped candidate list, on exactly the searches (a bare common
-- name) where the list is most likely to be full.
--
-- Rank isn't a column in `plantlst.txt`, but it doesn't need to be: with the
-- author stripped, a name at species rank or below always has at least two
-- words ("Dahlia pinnata", "Sorghum bicolor ssp. bicolor", "Acer leucoderme ×
-- saccharum"), and a genus or family is always one ("Dahlia", "Asteraceae").
--
-- Kept in the table rather than filtered at import: the rows are real USDA
-- data, they are what makes `family` resolvable, and a later feature that
-- genuinely wants genus-rank taxa (CONTEXT.md's "browse this Plant's
-- taxonomic relatives") shouldn't have to re-import 6.7 MB to get them back.
alter table public.usda_plant_names
  add column if not exists is_species_or_below boolean
  generated always as (position(' ' in trim(scientific_name)) > 0) stored;

create index if not exists usda_plant_names_species_rank_idx
  on public.usda_plant_names (is_species_or_below)
  where is_species_or_below;

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
      -- Never a bare genus or family: see this migration's header.
      and n.is_species_or_below
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
