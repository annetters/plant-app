# Plant data source evaluation — Tag Scan

Investigates candidate external data sources for Tag Scan's database
cross-reference tier (see `CONTEXT.md`, Tag Scan): auto-suggesting trait
fields for a Plant record once a nursery-tag scan resolves to a species or
cultivar.

## Requirements

1. Free — no paid API/licensing cost.
2. Easy to integrate — a real API or bulk-downloadable dataset, not a
   scraping project against a page-per-species website.
3. From a dependable, credible source — a scientific or institutional
   organization, not a crowdsourced or unvetted commercial aggregator.
4. Cultivar-level data — must distinguish named cultivars (e.g. Joe Pye Weed
   as the straight species vs. the cultivar 'Gateway'), not just species.

**Bloom window is excluded from every source by design, not omission.**
Bloom timing is a function of climate and latitude, not a fixed property of
a species or cultivar — a tag printed "late summer" is a rough regional
guess, and a database entry would carry the same problem with more false
authority behind it. No source below was evaluated against this field; it
stays user-observed only, never database-suggested.

## USDA PLANTS Database — adopted as the starting foundation

- **Access**: a real bulk download exists — the "Complete PLANTS Checklist,"
  a plain comma-delimited text file (historically named `plantlst.bin`,
  despite the extension — not actually binary). Separately, a
  [Characteristics Search](https://plants.usda.gov/characteristics-search)
  tool covers 80+ NRCS Conservation Plant Characteristics, filterable by
  growth habit, duration, environmental tolerances, and native status, with
  CSV/JSON export.
- **Cost**: free — a US federal government (NRCS) resource.
- **Credibility**: high.
- **Cultivar coverage**: **no.** The core checklist's fields are Symbol,
  Scientific Name, Common Name, Family — species/variety level. This
  correctly disambiguates species that share a common name (e.g. *Liatris
  spicata* vs. *Liatris aspera*), but has no cultivar epithet field (e.g.
  'Gateway').
  - Older USDA documentation referenced a separate "FOCS Plant Data"
    download with a `Cultivar` table, bundled alongside `Crop`, `Crop
    Variant`, `MLRA`, and `Wetland` tables. Could not confirm this dataset
    exists in current, accessible form, or that it covers ornamental garden
    perennials rather than agricultural crop registration — what USDA
    currently publishes under "floriculture" is commercial sales statistics
    (growers, quantity sold, prices), not plant trait or cultivar data.
    Treated as a dead end, not pursued further.
- **Verdict**: passes free / easy / credible. Fails cultivar-level. Adopted
  anyway as the species-level foundation — see Decision below.
- Hardiness zone specifically was not confirmed as one of the 80+
  characteristics fields; likely present given the breadth of the
  characteristics set, but unverified.

## IPNI (International Plant Names Index) — ruled out

- Purely a nomenclatural index — name, author, place and date of
  publication. **No horticultural trait data of any kind**, independent of
  cultivar coverage — so it could never serve Tag Scan's trait-suggestion
  goal even in the best case.
- Does not cover cultivar names as a rule: cultivars are governed by a
  different code (ICNCP) than the one IPNI indexes (ICN). Per IPNI's own
  FAQ, coverage below species/genus level is limited, and cultivar names
  are excluded unless separately published as scientific names.
- No public API currently — in beta, with general availability targeted "in
  the next 12 months" per IPNI's own FAQ. Bulk access today is capped at
  10,000 records or requires directly requesting the full database.
- **Verdict**: fails easy-to-integrate (no API today) and cultivar-level,
  and structurally can't supply trait data regardless. Extremely credible
  (jointly run by Kew, the Harvard University Herbaria, and the Australian
  National Herbarium) but not useful for this job. Its only real fit would
  be validating that a scientific name is genuinely, validly published — a
  narrower, different task than what Tag Scan needs.

## Decision

**Start with USDA PLANTS as the sole data source**, for species-level trait
suggestions (characteristics-search fields; not bloom window, excluded
above). Cultivar-level identification is **not database-backed for now** —
Tag Scan relies on OCR of the tag plus the saved tag photo plus user
confirmation, with no automated cultivar lookup pretending to a precision no
free, credible source currently provides.

**Data sources are a pluggable layer, not a single permanent choice.** Named
candidates for later, none investigated yet:

- **Commercial breeder/marketing programs** (e.g. Proven Winners) that
  register and brand patented cultivars sold across many retail nurseries —
  exactly the gap USDA structurally can't close, since it indexes wild and
  naturalized taxonomy, not commercial cultivar branding.
- **[Missouri Botanical Garden's Plant Finder](https://plantfinder.mobot.org/plantfindersearch.aspx)**
  — a respected horticultural database, plausibly stronger than USDA on
  cultivar-level garden-perennial data; access mechanism (API vs.
  browse-only) not yet checked.
- **[NC State's plant database](https://www.lib.ncsu.edu/databases/national-gardening-association-plants-database)**
  (National Gardening Association Plants Database, via NCSU Libraries) —
  not yet checked for access terms or cultivar coverage.

Revisit when cultivar-level coverage becomes a real gap in practice, not
speculatively now.
