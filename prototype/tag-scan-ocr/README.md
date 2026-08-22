# Tag Scan prototype: OCR placement + USDA adapter validation

**Throwaway — not production code.** Answers the OCR-placement question
ADR-0003 explicitly deferred, and validates the USDA PLANTS
characteristics-search adapter with a real pull. See
[docs/adr/0004-tag-scan-ocr-placement-and-usda-adapter.md](../../docs/adr/0004-tag-scan-ocr-placement-and-usda-adapter.md)
for the decision this prototype produced. Issue: #19.

## What's here

- `vision-ocr.swift` — on-device OCR harness (Apple's Vision framework,
  `VNRecognizeTextRequest`). **Run for real** against 8 real nursery tag
  photos supplied by the user (kept outside the repo, at
  `~/Desktop/tags` — not committed; results captured below).
- `vision-ocr-results.txt` — full transcript of that run, kept as evidence.
- `usda-pull.mjs` — **run for real**, live against USDA PLANTS'
  characteristics-search API. Fetches the full species list, matches a
  scientific name, pulls its full characteristics record, and projects it
  into the trait subset `CONTEXT.md`'s Plant record needs.
- `usda-sample-response.json` — one real saved response (*Digitalis
  purpurea*, matched from tag6 below) kept as evidence.
- `cloud-ocr.mjs` — cloud OCR harness (Google Cloud Vision,
  `DOCUMENT_TEXT_DETECTION`). **Not run live this pass** — no API key was
  available. Scaffolded with the same CLI shape as `vision-ocr.swift` so
  finishing the comparison is one command once a key exists (see below).

## How to run

```bash
# On-device OCR — real, works today, no setup:
swift vision-ocr.swift /path/to/tag1.jpg /path/to/tag2.jpg

# USDA pull — real, works today, no setup:
node usda-pull.mjs "Digitalis purpurea"

# Cloud OCR — needs a Google Cloud Vision API key (a GCP project with
# billing attached, though this stays inside the free tier for a
# prototype-sized run):
GOOGLE_CLOUD_VISION_API_KEY=... node cloud-ocr.mjs /path/to/tag1.jpg
```

## On-device OCR results (real photos, real run)

8 real nursery tag photos, deliberately varied per the user: mixed
`.jpg`/`.webp`, different orientations, some front-only, some with multiple
tag inserts photographed together. Full transcripts in
`vision-ocr-results.txt`; summary:

| Tag | Plant | Confidence | Notes |
|---|---|---|---|
| tag1 | Phlox paniculata 'Glamour Girl' | 1.00 throughout | Clean full extraction: cultivar, zone, height, light, bloom window. |
| tag2 | Monarda didyma 'Pardon My Pink' + Veronica 'Magic Show Ever After' | Mixed, 0.5–1.0 | **Mismatched pair**: front of the Monarda tag + back of the *unrelated* Veronica tag, framed together in one photo (confirmed by viewing the image — the Veronica side's own care text says "pair with... Bee Balm (Monarda)," i.e. it's describing a companion plant, not itself). English fields (cultivar, zone, height) recovered, Spanish marketing copy garbled. |
| tag3 | Heucherella 'Wildberry' / 'Capture the Flag' | Mostly 0.3–0.5 | Weakest result — heavy English/French/Spanish mixing. Decision-critical fields (cultivar, zone 4-9, height, light) still legible despite low confidence. |
| tag4 | Hibiscus (Summerific) 'All Eyes On Me' | 1.00 throughout | Clean full extraction. |
| tag5 | Mangave 'Catch a Wave' | 1.00 throughout | Clean full extraction, including an intergeneric hybrid name Vision had no trouble with. |
| tag6 | Digitalis purpurea 'Camelot Lavender' | 1.00 throughout | Clean; also the species used for the live USDA pull below. |
| tag7 | Heuchera 'Blackout' | 1.00 throughout | Two stapled inserts gave *different* hardiness ranges (3-8 vs 4-9) — a real tag data-consistency wrinkle, not an OCR error; see ADR. |
| tag8 | Labeled "Tutti Frutti Agastache", body copy describes "Scabiosa columbaria Harlequin Blue" | 1.00 throughout | Clean OCR of a tag whose *own printed content* is internally inconsistent — a supplier template error, not an OCR miss. |

**8/8 photos produced usable text.** 5/8 were clean, high-confidence, full
extractions. The 2 weakest cases (multilingual tags) still surfaced every
field Tag Scan actually needs (common name, scientific name, cultivar, zone,
light, height) — just wrapped in noisier low-confidence marketing copy
around them.

## USDA pull results (real, live)

Confirmed live, no auth required (endpoints recovered from the search app's
runtime config — see the ADR for how):

- `GET characteristicSearchResults` → 2186 species.
- `GET PlantCharacteristics/{id}` → ~80 real trait fields per species.

Real end-to-end run, `Digitalis purpurea` (from tag6):

```
Matched: purple foxglove (Digitalis purpurea), id 50875
Fetching characteristics for id 50875...
  78 characteristic fields returned.

Projected Plant-shaped trait subset:
{
  "commonName": "purple foxglove",
  "scientificName": "Digitalis purpurea",
  "matureHeightFeet": "5.0",
  "sunShade": "High",
  "growthHabit": "Single Crown",
  "minimumTemperatureF": "-13"
}
```

**Coverage gap found, beyond the cultivar gap already known**: checked all 7
distinct species named across the 8 real tags against USDA's characteristics
dataset. Only 2 had an exact species match (*Digitalis purpurea*, *Hibiscus
moscheutos*). The other 5 — *Phlox paniculata*, *Monarda didyma*, *Scabiosa
columbaria*, *Heuchera* (various), *Agastache* (various) — have **no exact
species entry**, only more native/wild congeners in the same genus. See the
ADR for what this means for the existing "USDA as sole data source" decision.

## Status against Issue #19's acceptance criteria

- [x] On-device OCR tested against a set of real nursery tags
- [ ] Cloud OCR tested against the same set — **scaffolded, not run live**;
  no API key was available this pass
- [x] Decision recorded — see the ADR; on-device's real-photo results were
  strong enough to decide without needing the cloud comparison
- [x] A real pull from USDA PLANTS' characteristics-search data validated
  end-to-end
- [x] Findings kept as a prototype artifact (this directory), not production
  code
