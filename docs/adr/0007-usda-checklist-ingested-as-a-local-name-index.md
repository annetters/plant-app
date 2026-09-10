# ADR-0007: USDA's checklist is ingested into Postgres as the name index; traits stay live

## Status

Accepted — 2026-09-09. Implements #36, which #43 (as-you-type species
suggestions on the web Add Plant form) is blocked on. Rests on
`docs/research/usda-plants-name-resolution.md` (2026-09-05, re-verified live
2026-09-09) and on the amendment ADR-0004 already carries.

## Context

The species lookup could not find *Dahlia pinnata* — a plain species
binomial, not a cultivar. #31 had just put that lookup on the ordinary "Add
Plant" form, where it reads as a general-purpose "look up this plant"
affordance, so the miss went from a Tag Scan edge case to a papercut on every
new plant.

The cause was not USDA's coverage. It was the table being queried.
`characteristicSearchResults`, which the adapter treated as the species
universe, is one small NRCS conservation-plant traits table inside PLANTS:

| | full checklist | `characteristicSearchResults` |
| --- | --- | --- |
| Accepted names | 48,994 | 2,186 |
| 60-taxon garden-ornamental panel | **57/60 (95%)** | 10/60 (17%) |
| ADR-0004's 7 real nursery-tag species | **7/7** | 2/7 |

The decisive evidence: *Dahlia pinnata* **is** in USDA as `DAPI3` "pinnate
dahlia", and `PlantCharacteristics/34210` returns `[]`. The plant exists; only
its conservation traits are missing. The adapter could not tell those two
apart, so "USDA has no trait record" and "no such plant" produced the same
answer — and the second one is what the UI said.

USDA carries roughly 5,000 non-naturalised taxa *specifically because they are
cultivated* (PLANTS Help Document, Introduction). Dahlia, Hosta, Paeonia and
Tulipa live in that 5,000. The data we needed was there the whole time.

## Decision

**Names local, traits live.** Three tiers, narrowing as they go:

1. **Name** — `public.usda_plant_names`, our own ingested copy of USDA's bulk
   checklist (48,994 accepted names + 44,163 synonyms). Always answers.
2. **Profile** — `PlantProfile?symbol=`, live. Duration and growth habit,
   which USDA reports for ten of twelve sampled ornamentals that have *zero*
   characteristics.
3. **Traits** — `PlantCharacteristics/{id}`, live, and only when the profile's
   `HasCharacteristics` says the taxon has any.

### Ingest, don't proxy

The name index goes into our Postgres rather than being fetched per lookup:

- **Licensing is explicit.** USDA's Help Document: the plant information "is
  not copyrighted and is free for any use", citation requested. (Images are a
  separate, stricter regime — untouched, and to stay that way.)
- **It takes an undocumented endpoint out of the hot path.** These APIs were
  recovered from the site's own config; the OpenAPI spec at
  `/swagger/v1/swagger.json` is unlinked, unversioned and auto-generated.
  Ingesting means touching that fragility once per refresh, in a run somebody
  is watching, rather than on every keystroke.
- **`PlantSearch` is uncapped.** `?searchText=a` returned 131 MB in 10.6 s. A
  short or garbled OCR read must never reach it.
- **A table, not a bundled file.** One copy serves web and mobile, a refresh
  needs no App Store release, and `pg_trgm` handles the substring matching
  USDA's compound common names require — "sunflower" has to find "common
  sunflower", which no prefix index can do, and which was a linear
  `.includes()` scan over an in-memory array before.
- **The bulk file is the stable part.** `plantlst.txt` sits at the same URL in
  Internet Archive snapshots from 2010 and 2019, is a named constant in USDA's
  own app bundle, and serves a real `Last-Modified`, so a refresh is a
  conditional request. Its **update cadence is unverified** — USDA publishes no
  schedule. Check the header; never assume a frequency.

### Refresh is invoked by hand

`usda-plant-names-refresh` is an Edge Function somebody calls, not a cron job.
There is no published cadence to match, and the run is worth watching. It
upserts every row stamped with the run's timestamp and then deletes what it
didn't touch, so a run that dies half way leaves a mix of old and new rows —
every one a real name — rather than a hole in the index every lookup depends
on. A checklist that parses to zero rows is refused outright.

### Deriving the name without its author

The checklist publishes only `"Dahlia pinnata Cav."`; the app needs
`"Dahlia pinnata"`, because that is what gets written into a Plant. USDA's API
publishes *both* forms for the 2,186 taxa in `characteristicSearchResults`, so
that is used as the specification: `usdaScientificNameWithoutAuthor` is tested
against all 2,186 pairs and matches every one. It is a grammar — genus,
epithet, optional second hybrid parent, then `rank + epithet` pairs — not a
heuristic, and the fixture is what keeps it one.

## What this does not decide

**Cultivar-level identification stays unsolved and stays parked.** USDA has no
cultivar field at any endpoint or in the bulk file. Option 3 from #36
(Missouri Botanical Garden's Plant Finder, NC State, Proven Winners) remains
the answer to that question, and nothing here brings it forward or strikes it
from the list. CONTEXT.md's "sources are a pluggable layer" framing is what
makes this an addition rather than a replacement.

**Trait accuracy** is #46's question, not this one. #44 dropped USDA's
`Shade Tolerance` for being close to inverted; #36 was deliberately scoped to
names and coverage and that scope held.

**Native status is not surfaced at all.** USDA answers it per coarse region
("L48: Native, CAN: Introduced"), and the user's judgement (2026-09-09) is
that native is only meaningful against the gardener's own area — region-level
is not useful and would be read as an answer it isn't. USDA *does* hold
state-level nativity, but on a different service (the ArcGIS layer behind its
distribution map, carrying `country_subdivision_name` and `plant_nativity_id`
per symbol); a symbol-filtered query returned zero rows and an unfiltered one
timed out at 90 s, so it is plausible and unsolved. Tracked as **#50**.

## Consequences

- A miss now usually means a **cultivar**, not a coverage gap, and the
  no-match copy says so. The old message explained away misses as the
  dataset's fault; that explanation is no longer true.
- **An empty characteristics list is no longer "not found."** `species` being
  empty is the not-found signal.
- **Synonyms resolve.** 44,163 of them, so a tag printing *Sedum spectabile*
  answers with the accepted *Hylotelephium spectabile*. Nursery tags print
  outdated names routinely.
- **`SpeciesNameSummary.commonName` is nullable.** USDA has no common name for
  5,218 accepted taxa, and requiring one silently discarded them — the same
  coverage gap in a second place.
- **A resolved species no longer overwrites the common name the gardener
  typed.** Against the old dataset the two strings were usually near-identical
  so this never showed; against the full checklist, picking *Monarda
  fistulosa* after typing "bee balm" replaced it with "wild bergamot".
- **USDA family names will look dated** — Cronquist-era `Aceraceae`,
  `Liliaceae`. That is the source's known quirk, which is why every profile
  fact is rendered as "USDA PLANTS records this species as…" rather than as
  the app's own assertion.
- **The parser is mirrored**, `packages/domain/src/usdaChecklist.ts` →
  `supabase/functions/_shared/usdaChecklist.ts`, same arrangement and same
  keep-in-sync obligation as `property.ts` and `create-property`. The domain
  copy is the one with the tests.

## Citation

Per USDA's stated requirement:

> USDA, NRCS. The PLANTS Database (http://plants.usda.gov, 9 September 2026).
> National Plant Data Team, Greensboro, NC USA.
