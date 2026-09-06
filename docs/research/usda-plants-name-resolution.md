# USDA PLANTS name resolution — can we query more of USDA instead of adding a source?

Settles GitHub issue #36. The Tag Scan adapter
(`supabase/functions/usda-plant-traits/index.ts`) currently talks to exactly
one USDA endpoint, `characteristicSearchResults`, which returns a 2,186-entry
NRCS conservation-plant subset with no *Dahlia* in it at all — so *Dahlia
pinnata* can't even be recognised as a real plant name, let alone described.
The question is whether the rest of USDA PLANTS can resolve ordinary garden
ornamentals by name (**option 4**, cheap) or whether that needs a whole new
horticultural source such as Missouri Botanical Garden's Plant Finder, NC
State's database, or Proven Winners (**option 3**, expensive).

Extends `docs/research/plant-data-source-cultivar-level-evaluation.md` and
`docs/adr/0004-tag-scan-ocr-placement-and-usda-adapter.md`. Where it confirms
or contradicts them is called out explicitly under "What this changes in the
existing docs."

**All live data below was pulled on 2026-09-05 (evening US Eastern; 2026-09-06
UTC).** Every count and response fragment is quoted from an actual HTTP
response fetched that day, not from documentation or memory.

---

## Verdict

**Option 4. Query more of USDA.** The `characteristicSearchResults` endpoint
the adapter uses today is not USDA PLANTS — it's one small conservation-traits
table inside it. The *name* index behind the rest of the site is roughly
twenty times larger and does contain garden ornamentals: *Dahlia pinnata* is
there (symbol `DAPI3`, common name "pinnate dahlia"), and so are Hosta,
Paeonia, Hydrangea, Echinacea and Rudbeckia. On a 60-taxon panel of ordinary
garden ornamentals the full checklist resolved **57/60 (95%)** against
`characteristicSearchResults`' **10/60 (17%)**.

Resolution is available three ways, all verified live: a single-call name
lookup (`GET /api/PlantSearch?searchText=…`), a per-plant record
(`GET /api/PlantProfile?symbol=…`), and a 6.7 MB bulk checklist file
(`plantlst.txt`) that is explicitly public-domain and cacheable. The
per-plant record also carries duration, growth habit, native status and
family for taxa that have *zero* conservation characteristics — so option 4
buys back a little trait data too, not just names.

**Option 3 is not needed to fix #36 and should stay parked.** It remains the
answer to a *different* question — cultivar-level data ('Gateway', 'Pardon My
Pink') — which USDA still structurally cannot supply, exactly as the prior
evaluation concluded. Nothing here reopens that.

---

## What the current integration actually does

`supabase/functions/usda-plant-traits/index.ts` makes at most two calls:

1. `GET https://plantsservices.sc.egov.usda.gov/api/characteristicSearchResults`
   — downloads the **entire** species list on every cold isolate (cached
   in module scope for 30 minutes) and matches in memory: exact,
   case-insensitive on `scientificNameWithoutAuthor`, or substring on
   `commonName`.
2. `GET .../api/PlantCharacteristics/{id}` — only reached when step 1 found
   an exact scientific-name match.

So **the species universe the whole feature can see is whatever step 1
returns**. Fetched 2026-09-05:

```
GET /api/characteristicSearchResults → HTTP 200, 646,297 bytes, 0.89 s
entries: 2186
keys: id, acceptedId, isSynonym, symbol, scientificName, commonName,
      familyName, scientificNameWithoutAuthor, imageCount, synonyms,
      acceptedSymbol
entries matching /dahlia/i on scientific or common name: 0
distinct genera represented: 760
```

2,186 entries, none of them synonyms, spanning 760 genera. That is the
ceiling. Anything outside it is invisible to the adapter no matter which of
the two calls you make — which is precisely the #36 symptom.

For contrast, the same day: `Dahlia pinnata` resolves in one call against a
different endpoint on the same host (below), and
`GET /api/PlantCharacteristics/34210` — Dahlia pinnata's real PLANTS id —
returns `HTTP 200` with body `[]`. **The plant exists in PLANTS; only its
conservation traits don't.** That distinction is the whole answer to #36.

---

## 1. What USDA PLANTS actually exposes

The public site is `https://plants.usda.gov`, which 301-redirects to
`https://plants.sc.egov.usda.gov`. It is a client-rendered Angular SPA; its
runtime config at
[`https://plants.sc.egov.usda.gov/assets/config.json`](https://plants.sc.egov.usda.gov/assets/config.json)
still gives `serviceUrls.plantsServicesUrl` as
`https://plantsservices.sc.egov.usda.gov/api/` (verified 2026-09-05,
HTTP 200, 990 bytes) — the same base URL ADR-0004 recovered.

### There is a machine-readable OpenAPI spec — this is new since ADR-0004

ADR-0004 states the API has "no published API docs." **That is now out of
date.** The service publishes an OpenAPI 3.0.4 document:

```
GET https://plantsservices.sc.egov.usda.gov/swagger/v1/swagger.json
→ HTTP 200, 70,956 bytes
info.title:       "Plants Services API"
info.description: "ASP.NET Core Web API for Plants Services"
info.version:     "v1"
paths:            42
```

Be careful how much weight that carries. `/swagger` and `/swagger/index.html`
both return **404**, so the Swagger UI is not deployed — the JSON is exposed
but not linked from anywhere on the site, there is no versioning policy
attached, and it is auto-generated by ASP.NET Core rather than hand-written.
Most operations document only `"200": {"description": "OK"}` with no response
schema at all. **Treat it as a reliable map of what exists, not as a contract
USDA has promised to keep.** It is a meaningful upgrade on "recovered by
reading minified JavaScript," but it is not a documented, supported public
API.

The webpack build path baked into the bundle
(`.../lants_plants_multibranch_REL_5_0/...`) suggests the current release line
is 5.0; there is no published deprecation policy I could find.

### Endpoint inventory

All 42 paths from the spec, with stability judgement. **Every one of these is
an UNDOCUMENTED INTERNAL API** in the sense that matters — no USDA page
describes them for third-party use, no terms of service governs them, no
rate limits or change notices are published, and they exist to serve one
Angular front end. The spec's existence raises confidence that shapes won't
churn casually; it does not make them supported.

| Endpoint | Verified live 2026-09-05 | Status |
| --- | --- | --- |
| `GET /api/PlantSearch?searchText=` | ✅ yes | **Undocumented internal.** The single most useful one for #36 — see below. |
| `GET /api/PlantProfile?symbol=&searchName=` | ✅ yes | **Undocumented internal.** Full per-plant record. |
| `GET /api/PlantProfile/{id}` | not called | Undocumented internal. |
| `POST /api/plants-search-results` | ✅ yes | **Undocumented internal, and demonstrably fragile** — see the timeout finding. |
| `POST /api/plants-search-results/download` | not called | Undocumented internal. |
| `GET /api/characteristicSearchResults` | ✅ yes | **Undocumented internal.** What we use today. |
| `GET /api/characteristicSearchResultsDownload` | ✅ yes (307,002 bytes JSON, not CSV) | Undocumented internal. Despite the name it returns JSON of accepted/synonym symbol + name + common name. |
| `GET /api/characteristicSearchFilterResults` | not called | Undocumented internal. |
| `GET /api/PlantCharacteristics/{id}` | ✅ yes | **Undocumented internal.** What we use today. |
| `GET /api/PlantSynonyms/{id}` | ✅ yes | Undocumented internal. Returns synonym taxa. |
| `GET /api/PlantClassification`→`/api/Classification/{id}` | not called | Undocumented internal. |
| `GET /api/PlantDocumentation/{id}` | not called | Undocumented internal. |
| `GET /api/PlantEthnobotany/{id}` | not called | Undocumented internal. |
| `GET /api/PlantInvasiveStatus/{id}` | not called | Undocumented internal. |
| `GET /api/PlantLegalStatus/{plantId}` | not called | Undocumented internal. |
| `GET /api/PlantNoxiousStatus/{id}` | not called | Undocumented internal. |
| `GET /api/PlantPollinator/{plantId}` | not called | Undocumented internal. |
| `GET /api/PlantRelatedLinks/{plantId}` | not called | Undocumented internal. |
| `GET /api/PlantSubordinateTaxa/{id}` | not called | Undocumented internal. |
| `GET /api/PlantWetland/{id}`, `/api/PlantWildlife/{id}` | not called | Undocumented internal. |
| `GET /api/DurationSearch`, `/GroupSearch`, `/GrowthHabitSearch`, `/RaritySearch`, `/StateSearch`, `/StateSearch/GetCounties/{stateId}`, `/WetlandSearch`, `/NoxiousInvasiveSearch` (+2 POST variants) | not called | Undocumented internal. |
| `POST /api/ImageSearch/Criteria`, `GET /api/plantImages` | not called | Undocumented internal. Note images are **not** public domain — see §4. |
| `GET /api/PlantSpotlight`, `/api/common/getCoverCropPlants`, `/api/common/getCulturallySignificantplants` | not called | Undocumented internal. |
| `GET /api/plantsDownload/GetGSATStateList` | ✅ yes (18 states, 384 bytes) | Undocumented internal. |
| `GET /api/plantsDownload/GetGSATByState?state=` | not called | Undocumented internal. |
| `GET /api/plantsDownload/GetUnkownSymbolCSV` | ✅ yes (8,885 bytes, JSON despite the name) | Undocumented internal. |
| `GET /api/feature-flags` | ✅ yes | Undocumented internal. |
| `GET /healthcheck` | ✅ yes (`Health Check Succeeded`) | Undocumented internal. |

And the two static bulk files, which are a different category:

| Download | Verified live 2026-09-05 | Status |
| --- | --- | --- |
| [`https://plants.sc.egov.usda.gov/DocumentLibrary/Txt/plantlst.txt`](https://plants.sc.egov.usda.gov/DocumentLibrary/Txt/plantlst.txt) | ✅ HTTP 200, `text/plain`, 7,038,655 bytes, `Last-Modified: Thu, 29 May 2025 20:49:35 GMT` | **The most stable thing USDA offers here.** Same URL path and same filename in Wayback snapshots from 2010 and 2019; declared as a first-class constant (`PLANTS_LIST_URL`) in the app's own `src/app/shared/resources/paths.constants.ts`. Still not a *documented* contract, but it is a plain static file at a URL that has survived two full site rewrites. |
| [`https://plants.sc.egov.usda.gov/DocumentLibrary/Txt/Non_LichenFungi.txt`](https://plants.sc.egov.usda.gov/DocumentLibrary/Txt/Non_LichenFungi.txt) | ✅ HTTP 200, 63,430 bytes, 380 lines, `Last-Modified: Thu, 29 May 2025 20:49:08 GMT` | Reserved fungal symbols. Irrelevant to us. |

### `PlantSearch` is the one that matters

`GET /api/PlantSearch?searchText=…` is the site's typeahead. It matches
**scientific name, common name and symbol** as a substring, case-insensitively,
and returns full plant DTOs. Verified 2026-09-05:

```
?searchText=Dahlia%20pinnata → n=1  Dahlia pinnata Cav.   (DAPI3, "pinnate dahlia", Rank=Species)
?searchText=pinnate%20dahlia → n=1  Dahlia pinnata Cav.
?searchText=DAPI3            → n=1  Dahlia pinnata Cav.
?searchText=Asteraceae       → n=0  (family names are NOT matched)
```

Two operational cautions, both measured:

- **It is uncapped.** `?searchText=a` returned **90,798 rows / 131,561,787
  bytes in 10.6 s** — the DTOs are fat, mostly-null objects. A one-character
  query from a bad OCR read would pull 131 MB through an Edge Function. Any
  integration must impose a minimum query length and its own cap.
- Typical scoped queries are cheap: three sequential `Dahlia pinnata` lookups
  measured 0.77 s / 0.74 s / 0.79 s at 1,432 bytes each. `Carex` → 1,290 rows,
  `Rosa` → 641, `Clematis` → 108.

### `plants-search-results` is real but flaky — do not build on it

The POST endpoint supports field-scoped search (`Field`: `"Scientific Name"`,
`"Common Name"`, …), the `%` wildcard, paging, and returns a `TotalRowCount`.
It works, and it is nicer-shaped than `PlantSearch`. But on 2026-09-05 it
returned, twice each, for two ordinary genus queries:

```
POST /api/plants-search-results  {"Text":"Carex","Field":"Scientific Name",...}
→ HTTP 500  "Execution Timeout Expired.  The timeout period elapsed prior to
   completion of the operation or the server is not responding."
POST /api/plants-search-results  {"Text":"Rosa", ...}   → same HTTP 500
POST /api/plants-search-results  {"Text":"Hosta", ...}  → HTTP 200, 12 rows
```

`PlantSearch` served `Carex` and `Rosa` without complaint the same minute. An
empty/`null` `Text` also 500s, so it cannot be used to dump the index. Treat
this endpoint as best-effort only.

---

## 2. Does the full checklist include cultivated ornamental exotics? **Yes.**

This is the crux, and USDA answers it in its own words. From the official
[PLANTS Help Document](https://plants.sc.egov.usda.gov/DocumentLibrary/Pdf/PLANTS_Help_Document.pdf)
(PDF, 968,699 bytes, `Last-Modified: Wed, 28 May 2025 20:17:41 GMT`;
text extracted locally), Introduction, verbatim:

> "The PLANTS database contains native and naturalized plants of the PLANTS
> Floristic Area (PFA), which consists of North America and all additional
> U.S. territories and protectorates. … The total number of PFA accepted taxa
> at the rank of species and below is about 38,000. … **PLANTS also has about
> 5000 vascular plants that do not occur spontaneously (i.e., are not
> naturalized) in the PFA; most of these are of economic importance, and many
> of them are cultivated within the PFA.**"

That last sentence is the deliberate design decision that makes option 4
work. USDA carries roughly 5,000 non-naturalised taxa specifically *because*
they're cultivated. Dahlia, Hosta, Paeonia and Tulipa live in that 5,000.

### The bulk checklist, measured

Parsed the 2026-09-05 copy of `plantlst.txt`:

```
header: "Symbol","Synonym Symbol","Scientific Name with Author","Common Name","Family"
total data rows:                        93,157
  accepted rows (blank Synonym Symbol): 48,994
  synonym rows:                         44,163
accepted rows at species rank or below: 43,912
accepted rows above species (genus/family/higher): 5,082
accepted rows carrying a common name:   43,776
distinct families:                        548
distinct genera (accepted):             5,083
rows flagged "[excluded]":                717
```

Sample rows, verbatim from the file:

```
"DAPI3","","Dahlia pinnata Cav.","pinnate dahlia","Asteraceae"
"DAPI3","DARO","Dahlia rosea Cav.","",""
"DACO4","","Dahlia coccinea Cav. [excluded]","red dahlia","Asteraceae"
"DAHLI","","Dahlia Cav.","dahlia","Asteraceae"
```

Note the shape: synonym rows repeat the accepted taxon's symbol in column 1
and carry blank common name and family. Any importer must key on
`Synonym Symbol == ""` to get accepted names, and can use the rest as a free
synonym→accepted mapping (44,163 of them) — genuinely useful for OCR'd tags
that print outdated names.

### Per-taxon results, 60 ordinary garden ornamentals

Tested each name against both the bulk checklist and the
`characteristicSearchResults` list the adapter uses today. `Y` = present.

| Taxon | checklist | characteristics | Accepted symbol / USDA common name |
| --- | :---: | :---: | --- |
| *Dahlia pinnata* | **Y** | · | DAPI3 "pinnate dahlia" |
| *Hosta plantaginea* | **Y** | · | HOPL2 "fragrant plantain lily" |
| *Hosta sieboldiana* | · | · | **absent** (only 5 Hosta taxa in PLANTS) |
| *Paeonia lactiflora* | **Y** | · | PALA27 "Chinese peony" |
| *Paeonia officinalis* | **Y** | · | PAOF2 "common peony" |
| *Hydrangea macrophylla* | **Y** | **Y** | HYMA7 "French hydrangea" |
| *Hydrangea paniculata* | **Y** | · | HYPA "panicled hydrangea" |
| *Hydrangea arborescens* | **Y** | · | HYAR "wild hydrangea" |
| *Echinacea purpurea* | **Y** | **Y** | ECPU "eastern purple coneflower" |
| *Rudbeckia fulgida* | **Y** | · | RUFU2 "orange coneflower" |
| *Rudbeckia hirta* | **Y** | **Y** | RUHI2 "blackeyed Susan" |
| *Phlox paniculata* | **Y** | · | PHPA9 "fall phlox" |
| *Phlox subulata* | **Y** | **Y** | PHSU3 "moss phlox" |
| *Monarda didyma* | **Y** | · | MODI "scarlet beebalm" |
| *Scabiosa columbaria* | **Y** | · | SCCO6 "dove pincushions" |
| *Heuchera sanguinea* | **Y** | **Y** | HESA3 "coralbells" |
| *Heuchera americana* | **Y** | · | HEAM6 "American alumroot" |
| *Agastache foeniculum* | **Y** | · | AGFO "blue giant hyssop" |
| *Digitalis purpurea* | **Y** | **Y** | DIPU "purple foxglove" |
| *Tulipa gesneriana* | **Y** | · | TUGE "Didier's tulip" |
| *Narcissus pseudonarcissus* | **Y** | · | NAPS "daffodil" |
| *Rosa rugosa* | **Y** | **Y** | RORU "rugosa rose" |
| *Lavandula angustifolia* | **Y** | · | LAAN81 "English lavender" |
| *Salvia nemorosa* | **Y** (as synonym of SASY) | · | resolves via synonym row |
| *Salvia officinalis* | **Y** | · | SAOF2 "kitchen sage" |
| *Astilbe chinensis* | · | · | **absent** (4 Astilbe taxa present, incl. *A. japonica*) |
| *Astilbe japonica* | **Y** | · | ASJA2 "florist's spiraea" |
| *Buddleja davidii* | **Y** | · | BUDA2 "orange eye butterflybush" |
| *Clematis ×jackmanii* | **Y** | · | CLJA2 "leather flower" |
| *Coreopsis verticillata* | **Y** | · | COVE5 "whorled tickseed" |
| *Hemerocallis fulva* | **Y** | · | HEFU "orange daylily" |
| *Iris germanica* | **Y** | · | IRGE "German iris" |
| *Iris sibirica* | **Y** | · | IRSI "Siberian iris" |
| *Helleborus orientalis* | **Y** | · | HEOR3 "lenten-rose" |
| *Nepeta ×faassenii* | · | · | **absent** (7 Nepeta taxa incl. *N. racemosa*, one parent) |
| *Nepeta racemosa* | **Y** | · | NERA2 "raceme catnip" |
| *Sedum spectabile* | **Y** (synonym of HYSP9) | · | resolves via synonym row |
| *Geranium sanguineum* | **Y** | · | GESA2 "bloody geranium" |
| *Delphinium elatum* | **Y** | · | DEEL2 "candle larkspur" |
| *Aquilegia vulgaris* | **Y** | · | AQVU "European columbine" |
| *Gaillardia ×grandiflora* | **Y** | · | GAGR11 "blanketflower" |
| *Petunia ×atkinsiana* | **Y** | · | PEAT7 "petunia" |
| *Impatiens walleriana* | **Y** | · | IMWA "buzzy lizzy" |
| *Begonia semperflorens* | **Y** (synonym of BECU) | · | resolves via synonym row |
| *Pelargonium ×hortorum* | **Y** | · | PEHO2 "zonal geranium" |
| *Viola ×wittrockiana* | **Y** | · | VIWI "hybrid violet" |
| *Lantana camara* | **Y** | · | LACA2 "lantana" |
| *Zinnia elegans* | **Y** (synonym of ZIVI2) | · | resolves via synonym row |
| *Tagetes patula* | **Y** | · | TAPA "French marigold" |
| *Antirrhinum majus* | **Y** | · | ANMA3 "garden snapdragon" |
| *Lilium lancifolium* | **Y** | · | LILA8 "tiger lily" |
| *Weigela florida* | **Y** | · | WEFL2 "oldfashioned weigela" |
| *Spiraea japonica* | **Y** | **Y** | SPJA "Japanese meadowsweet" |
| *Syringa vulgaris* | **Y** | **Y** | SYVU "common lilac" |
| *Cornus florida* | **Y** | **Y** | COFL2 "flowering dogwood" |
| *Acer palmatum* | **Y** | · | ACPA2 "Japanese maple" |
| *Wisteria sinensis* | **Y** | · | WISI "Chinese wisteria" |
| *Camellia japonica* | **Y** | · | CAJA9 "camellia" |
| *Rhododendron catawbiense* | **Y** | · | RHCA8 "Catawba rosebay" |
| *Buxus sempervirens* | **Y** | · | BUSE2 "common box" |

**57 / 60 (95%) in the full checklist. 10 / 60 (17%) in the characteristics
subset.** The three misses — *Hosta sieboldiana*, *Astilbe chinensis*,
*Nepeta ×faassenii* — all still resolve at genus level, which is enough to
show the user a sensible candidate list rather than nothing.

### Re-running ADR-0004's real-tag species

ADR-0004 reported 2/7 species from real nursery tags matching. Against the
full checklist, 2026-09-05:

| ADR-0004 taxon | characteristics (per ADR-0004) | full checklist (this pass) |
| --- | :---: | --- |
| *Digitalis purpurea* | match | DIPU |
| *Hibiscus moscheutos* | match | HIMO "crimsoneyed rosemallow" |
| *Phlox paniculata* | **no match** | **PHPA9** "fall phlox" |
| *Monarda didyma* | **no match** | **MODI** "scarlet beebalm" |
| *Scabiosa columbaria* | **no match** | **SCCO6** "dove pincushions" |
| *Heuchera* (genus) | **no match** | **76 accepted Heuchera taxa** |
| *Agastache* (genus) | **no match** | **27 accepted Agastache taxa** |

**All five of ADR-0004's failures resolve.** 7/7, up from 2/7 — using the
same free source, no new vendor.

### Common-name resolution works, with one sharp caveat

The adapter's existing comment about USDA's compound common names is correct
and gets *worse* at full-index scale. Verified via
`POST /api/plants-search-results` with `Field: "Common Name"`:

```
"dahlia"            → TotalRowCount 5   (incl. DAPI3 "pinnate dahlia", DAHLI "dahlia")
"beebalm"           → TotalRowCount 29
"bee balm"          → TotalRowCount 0    ← the way a human writes it
"bee%balm"          → TotalRowCount 29   ← wildcard rescues it
"coneflower"        → TotalRowCount 56
"purple coneflower" → TotalRowCount 14
"daylily"           → TotalRowCount 7
"hydrangea"         → TotalRowCount 7
"black%eyed"        → TotalRowCount 7    (RUHI2 "blackeyed Susan")
```

`grep -c "bee balm" plantlst.txt` → **0**; `grep -c "beebalm"` → **29**.
USDA collapses the space in most compound common names. The `%` wildcard is
supported and documented in the Help Document ("To search for two strings of
text separated by an unknown number of characters, use the wildcard '%'").
**Any common-name lookup we build should try the literal string, then a
space-stripped variant, then a `%`-joined variant.** Substring matching is
also noisy in the other direction — `PlantSearch?searchText=hosta` returns 13
rows including *Helminthostachys* and *Ornithostaphylos*, because "hosta" is
a substring of both.

### The bonus: profile records carry traits the characteristics table doesn't

`GET /api/PlantProfile?symbol=…` returns a per-plant record with duration,
growth habit, native status per region, and the full taxonomic ancestor
chain. Sampled 2026-09-05, with a `PlantCharacteristics/{id}` call alongside
each:

| Symbol | Taxon | USDA common name | Duration | Growth habit | Native status | Family | chars |
| --- | --- | --- | --- | --- | --- | --- | ---: |
| DAPI3 | *Dahlia pinnata* | pinnate dahlia | Perennial | Forb/herb | L48: Introduced | Asteraceae | **0** |
| HOPL2 | *Hosta plantaginea* | fragrant plantain lily | Perennial | Forb/herb | CAN/L48: Introduced | Liliaceae | **0** |
| PALA27 | *Paeonia lactiflora* | Chinese peony | Perennial | Forb/herb | CAN/L48: Introduced | Paeoniaceae | **0** |
| PHPA9 | *Phlox paniculata* | fall phlox | Perennial | Forb/herb | CAN: Introduced, L48: Native | Polemoniaceae | **0** |
| MODI | *Monarda didyma* | scarlet beebalm | Perennial | Forb/herb | CAN/L48: Native | Lamiaceae | **0** |
| HEFU | *Hemerocallis fulva* | orange daylily | Perennial | Forb/herb | CAN/L48: Introduced | Liliaceae | **0** |
| IRGE | *Iris germanica* | German iris | Perennial | Forb/herb | CAN/L48: Introduced | Iridaceae | **0** |
| ACPA2 | *Acer palmatum* | Japanese maple | Perennial | Shrub/Tree | CAN/L48: Introduced | Aceraceae | **0** |
| LAAN81 | *Lavandula angustifolia* | English lavender | Perennial | Shrub | L48: Introduced | Lamiaceae | **0** |
| TAPA | *Tagetes patula* | French marigold | **Annual** | Forb/herb | L48/PR: Introduced | Asteraceae | **0** |
| ECPU | *Echinacea purpurea* | eastern purple coneflower | Perennial | Forb/herb | CAN: Introduced, L48: Native | Asteraceae | 79 |
| HYMA7 | *Hydrangea macrophylla* | French hydrangea | *(blank)* | *(blank)* | *(blank)* | Hydrangeaceae | 75 |

Ten of these twelve have **zero** conservation characteristics yet still
report duration, growth habit and family — enough to prefill CONTEXT.md's
annual-vs-perennial and growth-habit fields, which is more than #36 asked
for. The last row is the reverse case: *Hydrangea macrophylla* has 75
characteristics but blank profile duration/habit, so the two sources
complement rather than supersede each other. `PlantSynonyms/34210` returns
*Dahlia rosea* Cav. as a synonym of DAPI3.

Note that `Aceraceae` and `Liliaceae` above reflect the Cronquist-era
taxonomy PLANTS still uses. That's a known quirk of the source, not an
error — but it means **USDA family names will look dated to a botanically
literate user**, and the user is a gardening expert. Worth surfacing as
"USDA says…" rather than as our own assertion.

---

## 3. Bulk download

**Yes, and it is the strongest option here.**

- **URL**:
  [`https://plants.sc.egov.usda.gov/DocumentLibrary/Txt/plantlst.txt`](https://plants.sc.egov.usda.gov/DocumentLibrary/Txt/plantlst.txt)
- **Size**: 7,038,655 bytes (6.7 MiB) as of 2026-09-05.
- **Format**: comma-delimited text, every field double-quoted, one header
  line, 93,157 data rows. Columns: `Symbol`, `Synonym Symbol`,
  `Scientific Name with Author`, `Common Name`, `Family`.
- **Last modified**: `Thu, 29 May 2025 20:49:35 GMT` — served with a real
  `Last-Modified` header, so a conditional `If-Modified-Since` refresh is
  trivial.
- **Update cadence**: **could not verify.** USDA publishes no schedule I could
  find. The single `Last-Modified` observation (May 2025, ~15 months before
  this pull) is one data point, and the companion `Non_LichenFungi.txt` shares
  a timestamp 27 seconds earlier, which suggests both are regenerated together
  by a batch job on an irregular cadence. Do not assume a frequency; check the
  header.
- **Stability of the URL**: the same filename at the same
  `DocumentLibrary/Txt/` style path appears in Internet Archive snapshots of
  the legacy site from **2010-01-06** and **2019-03-20** (both fetched
  2026-09-05 via `web.archive.org/web/…id_/…`), and it is a named constant in
  the current app bundle. That is about as much continuity as an
  undocumented-but-public file can demonstrate.

**On the "`plantlst.bin`" claim in the prior research doc: I could not
confirm it, and the evidence points the other way.** The archived 2010 and
2019 download pages both link `…downloadData?fileName=plantlst.txt&static=true`
— `.txt`, not `.bin`. I found no snapshot using `.bin`. The prior doc's
*description* of the format is otherwise exactly right, and matches USDA's own
words on the archived page:

> "The Complete PLANTS Checklist is nearly 7 MB and includes Symbol, Synonym
> Symbol, Scientific Name with Authors, National Common Name, and Family.
> Fields in this text file are delimited by commas and enclosed in double
> quotes."
> — [Wayback snapshot, 2019-03-20, `plants.usda.gov/dl_all.html`](https://web.archive.org/web/20190320201717/https://plants.usda.gov/dl_all.html)
> (archive of the primary source; the live equivalent page is now inside the
> Angular SPA and I could not fetch its rendered text directly)

The current SPA no longer surfaces a plain HTML download menu I could fetch,
so the *label* "Complete PLANTS Checklist" is verified against the archived
primary site rather than today's live one. The file itself is verified live.

**What I'd ship**: the accepted-name rows (48,994) plus the synonym mapping
(44,163), reduced to symbol + scientific name + common name + family. That's
well under a megabyte gzipped and removes the network from the hot path for
name resolution entirely; live API calls then only handle the trait lookups
for the ~2,186 taxa that have them.

---

## 4. Licensing and redistribution — **clear, and permissive**

USDA states this directly. From the
[PLANTS Help Document](https://plants.sc.egov.usda.gov/DocumentLibrary/Pdf/PLANTS_Help_Document.pdf),
section "Conditions of Image and Data Use" → "Plant Data Use", verbatim:

> "Our plant information, including the distribution maps, lists, and text, is
> not copyrighted and is free for any use. Please cite the PLANTS Database as:
> http://plants.usda.gov, [DAY MONTH YEAR]. National Plant Data Team,
> Greensboro, NC USA."

So: **we may bundle `plantlst.txt`-derived name data into the app**, with a
citation. Two boundaries to respect, both from the same section:

- **Images are a separate regime and are NOT blanket-free.** "The use of most
  images in PLANTS requires permission; conditions of use vary, but
  acknowledgement is required under all circumstances" — non-copyrighted
  images are free for any use *with full acknowledgement*; copyrighted images
  need the rights-holder's permission. We should not touch `plantImages` or
  `ImageSearch` without revisiting this.
- **Linking is explicitly welcomed**: "Linking to plant profile pages, or any
  page on PLANTS, requires no permission and we welcome it."

The generic US-federal-works public-domain assumption also holds here, but I'm
citing USDA's own explicit statement rather than resting on it.

**What I could not verify on terms**: there is no separate terms-of-service or
acceptable-use page governing `plantsservices.sc.egov.usda.gov` that I could
find, and **no published rate limit**. `https://plantsservices.sc.egov.usda.gov/robots.txt`
returns **404**; `https://plants.sc.egov.usda.gov/robots.txt` returns the SPA's
`index.html` (the Angular catch-all), which means there is no robots.txt file
there either — but I want to be plain that "the SPA served its shell" is weaker
evidence than a real 404. Absence of a stated limit is not permission to
hammer it. Keep the descriptive `User-Agent` the adapter already sends, keep
caching, and prefer the bulk file over per-request live calls.

I also could not locate a data.gov catalog entry for the PLANTS Database —
`catalog.data.gov`'s CKAN API returned `HTTP 404 {"message":"Not Found"}` for
`/api/3/action/package_search` on 2026-09-05, so I could not query it
programmatically and did not confirm one exists either way.

---

## What this changes in the existing docs

**CONFIRMED, re-verified this pass:**

- `characteristicSearchResults` still returns exactly **2,186** entries, as
  ADR-0004 recorded. That number has not moved.
- The base URL `https://plantsservices.sc.egov.usda.gov/api/` and its recovery
  route via `assets/config.json` are both still live and correct.
- `PlantCharacteristics/{id}` still returns ~75–80 trait rows for taxa that
  have them (79 for ECPU, 75 for HYMA7).
- USDA has **no cultivar field**, at any endpoint or in the bulk file. The
  prior evaluation's cultivar-level rejection stands untouched. `plantlst.txt`
  has exactly the five columns the doc described.
- No credential, no key, no auth on any endpoint tested.
- ADR-0004's characterisation of the *characteristics* dataset as an NRCS
  conservation subset is right, and USDA's Help Document backs it: those data
  "were used in the former VegSpec application, a web-based decision support
  system that helped land managers plan and design natural resource
  conservation plantings."

**CONTRADICTED or materially updated:**

1. **ADR-0004: "no published API docs."** Superseded — an OpenAPI 3.0.4 spec
   is served at `/swagger/v1/swagger.json` listing all 42 operations. It is
   unlinked and un-versioned, so the endpoints remain unsupported, but they
   are no longer undiscoverable.
2. **ADR-0004: "USDA will return nothing for a large share of real nursery
   tags (5 of 7 species tested here)."** True of the characteristics endpoint,
   **false of USDA PLANTS as a whole.** All 7 resolve by name in the full
   checklist. The consequence ADR-0004 drew — that Tag Scan must treat "no
   USDA match at all" as routine — should be narrowed to "no USDA *trait* match
   is routine; no USDA *name* match is now the exception."
3. **Prior research doc: `plantlst.bin`.** The file is and appears always to
   have been `plantlst.txt`. The format description in that doc is accurate;
   only the extension is wrong.
4. **Prior research doc's framing of USDA as "species-level foundation" that
   "comes up empty often."** Half right. It comes up empty often *for traits*
   and essentially never *for names* on garden ornamentals. Those are different
   claims and the docs currently conflate them.

**NOT changed:** the option-3 candidates (Missouri Botanical Garden Plant
Finder, NC State, Proven Winners) remain uninvestigated and remain the right
answer for cultivar-level data. This pass gives no reason to bring any of them
forward now, and none to strike them from the list either.

---

## Honest list of what I could not verify

- **Update cadence of `plantlst.txt`** — no published schedule; one
  `Last-Modified` observation only.
- **Whether `plantlst.txt` was ever named `plantlst.bin`** — found no
  snapshot with that name; 2010 and 2019 archives both say `.txt`. Recorded as
  "no evidence found," not "definitively never."
- **The live download page's current label** for the checklist — the SPA's
  download route is in a lazy-loaded chunk I could not enumerate, so
  "Complete PLANTS Checklist" is cited from a 2019 Internet Archive snapshot
  of the primary site, not from today's rendered page.
- **Any rate limit or acceptable-use policy** on `plantsservices.sc.egov.usda.gov`
  — none found, and none should be inferred to exist or not exist.
- **A data.gov catalog entry** — the CKAN API endpoint 404'd; not confirmed
  either way.
- **Whether the `plants-search-results` timeouts are chronic or transient** —
  observed twice each for `Carex` and `Rosa` within one session on
  2026-09-05. Not retested across days. Enough to avoid depending on it;
  not enough to call it permanently broken.
- **Whether `PlantSearch`'s response shape is stable** — the OpenAPI spec
  names a `TypeaheadSearchResultDto` but supplies no schema for most
  operations' responses, so the field names we'd depend on
  (`Plant.Symbol`, `Plant.ScientificName`, `Plant.CommonName`) are verified by
  observation only.
- **Coverage beyond the 60-taxon panel.** 95% is a measurement on a list I
  chose. It is not a guarantee, and tropical houseplants, recent breeding
  introductions, and anything genuinely never grown in North America are all
  plausible gaps I did not probe.

---

## Suggested next step (not a decision — that's the user's)

If option 4 is taken, the smallest change that closes #36 is to stop treating
`characteristicSearchResults` as the species universe:

1. Resolve names against the checklist (bundled `plantlst.txt` extract,
   or `PlantSearch` live with a minimum query length and a result cap).
2. Enrich with `PlantProfile?symbol=…` for duration / growth habit / native
   status / family — available even when traits aren't.
3. Keep `PlantCharacteristics/{id}` exactly as it is, as an *optional* extra
   tier that fires only when the taxon has characteristics, and stop treating
   its absence as "plant not found."

That is a change to one Edge Function and its client-side projection, with no
new vendor, no credential, and no licensing question.

## Citation

Per USDA's stated requirement, anything we ship from this should carry:

> USDA, NRCS. The PLANTS Database (http://plants.usda.gov, 5 September 2026).
> National Plant Data Team, Greensboro, NC USA.
