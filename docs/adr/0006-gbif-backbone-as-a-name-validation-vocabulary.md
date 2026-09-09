# ADR-0006: GBIF's backbone is the name-validation vocabulary, a second role distinct from USDA's

## Status

Accepted — 2026-09-09. Implements the vocabulary decision reached in #23's
triage and verified against the real 8-tag OCR transcript in
`prototype/tag-scan-ocr/vision-ocr-results.txt`.

## Context

Tag Scan's parser decided what a scientific name was from typography alone: a
whole line matching "Capitalised-word lowercase-word", optionally followed by
a quoted cultivar. That rule was chosen deliberately in ADR-0004 and is as
strict as an anchored pattern can be.

It does not work, and it cannot be made to work. Run end-to-end over the real
8-tag transcript, the shape-only parser scored **3 correct, 2 confidently
wrong, 3 empty**:

| tag | result |
| --- | --- |
| tag1 | `Phlox paniculata` + `Glamour Girl` — correct |
| tag2 | `Monarda didyma` + `PARDON MY PINK` — correct |
| tag6 | `Digitalis purpurea` + `Camelot™ Lavender` — correct |
| tag3 | **`Sum mer`** — Vision split "Summer"; it captured the real cultivar `'Wildberry'` and bound it to that nonsense species |
| tag5 | **`Follow us`** — a social-media footer |
| tag4, tag7, tag8 | empty |

ADR-0004's "8/8 usable" figure measured what Vision *recognised*, not what the
parser *extracts*; the heuristic appears never to have been run end-to-end
across the transcript. That is the finding that prompted this ADR.

The reason no regex fixes it: nursery tags always carry marketing copy, and
that copy is **typographically identical to a binomial**. "Follow us" has the
same shape as "Monarda didyma". Loosening the pattern — #23's original
proposal — multiplies false positives; tightening it drops real names, and it
was already at maximum strictness while still leaking 2 of 8. There is no
third regex. The discriminator has to be **vocabulary — is this a real
genus? — not shape**.

## Decision

**A line yields a `scientificName` only if it passes the existing shape rule
*and* its first word is a known plant genus.** The vocabulary is GBIF's
taxonomic backbone, restricted to `kingdom=Plantae`, `rank=GENUS`, and a
`taxonomicStatus` of `ACCEPTED` or `SYNONYM`, compiled ahead of time into
`packages/domain/src/data/plantGenera.ts` by the checked-in generator
`packages/domain/scripts/generate-genus-vocabulary.mjs`.

The gate **stacks on top of** the shape rule rather than replacing it, so a
false positive must now be both a real genus and followed by a lowercase word.

Consulted locally, never per scan: `parseOcrTextLines` stays synchronous and
pure, with no network access, no async, and no repository dependency.

### Why GBIF and not USDA

USDA is a conservation dataset. Of 35 common ornamental genera probed, **17
are absent** — including *Heucherella* and *Mangave*, both of which appear on
the real tags. GBIF's backbone covers all of them.

| check | result |
| --- | --- |
| Ornamental genera USDA lacks | 17/17 |
| Genera USDA already had | 9/9 |
| Real tag garbage rejected (incl. "Sum", "Follow", "Summer", "Deer", "Proven") | 19/19 |
| Marketing-word collisions (Diamond, Cascade, Prairie, Jubilee, …) | 0/35 |

### This is a second role, not a replacement for USDA's

**Name validation and trait suggestion are different jobs, and they now use
different sources.** GBIF carries no horticultural trait data, so it cannot
replace USDA; USDA's name coverage is too narrow to validate against, so it
cannot fill this role. Both stay.

`docs/research/plant-data-source-cultivar-level-evaluation.md` explicitly
dismissed name-validation as *"a narrower, different task than what Tag Scan
needs"*. **That task now exists** — it is what this ADR adopts — and the
research doc's dismissal of it should be read as superseded on that point
only. Its evaluation of trait sources stands.

Nothing here touches #36's data-source revisit, which is scoped to USDA's
*name coverage* for the species lookup. A future decision there does not
disturb this one.

### Why `SYNONYM` is kept and `DOUBTFUL` is dropped

**`SYNONYM` is kept.** *Perovskia* and *Mangave* are synonyms under current
taxonomy but are exactly what nurseries print — horticulture lags taxonomy by
decades. Dropping them would reject real tag text.

**`DOUBTFUL` is dropped**, but it is not pure noise, and this is the seam
where the decision is genuinely uncomfortable. *Angelica* — a real, widely
sold garden genus — sits in the backbone as `DOUBTFUL` under Apiaceae, and the
filter silently rejects it. Re-including `DOUBTFUL` wholesale is not the
answer either: it is what admits *Aurora*, a doubtful Combretaceae genus that
collides with ordinary marketing copy.

**No single status filter is correct.** So the generated vocabulary carries a
small, checked-in override layer beside it —
`packages/domain/src/data/genusVocabularyOverrides.json`, additions and
exclusions with a justification recorded per entry. It is data, not code, and
is merged at load rather than baked into the generated file, so editing one
needs neither a network round trip nor a parser change. #39 is about curating
that file from real scan outcomes rather than guesswork.

### Do not use GBIF's `species/match`

The obvious endpoint is the wrong one, and **it fails in a way that looks like
success**. It returns `ACCEPTED` with `confidence: 99` for "Follow", "Deer"
and "Winners", silently backing off to a match on *Plantae* itself. It also
returns `HIGHERRANK` for genuine genera such as *Hosta* and *Helleborus*,
because homonyms in other families make it refuse to disambiguate.

Compile from the backbone `species/search` restricted to `rank=GENUS` with
exact `canonicalName` equality, or from the downloadable backbone archive.
This trap is recorded in the generator script as well, since that is where
someone would hit it.

## Consequences

**tag3 and tag5 stop producing confident wrong answers.** A blank field the
user fills in is the correct outcome for an unknown genus — a wrong candidate
pre-fills the review screen and invites the user to confirm text that is not a
species, which is the failure this removes.

**tag3 degrades to nothing, for now.** Its only real content was the cultivar
`'Wildberry'`, which the false-positive species used to carry. #38 decides
whether a cultivar-only tag yields a usable candidate; until it lands, tag3 is
empty rather than wrong.

**The residual risk is named, not solved.** Of 34 ordinary English words
probed, **17 are genuine genera** — *Iris*, *Veronica*, *Dahlia*, *Aster*,
*Hosta*, *Viola*, *Magnolia*, *Petunia*, *Begonia*, *Fuchsia* and others.
These pass both filters when followed by a lowercase word, so a marketing line
like "Veronica loves full sun" still produces a false positive. The gate
narrows the problem sharply; it does not eliminate it. Pre-emptively excluding
those genera would be worse, since they are exactly what a gardener
legitimately scans. The exclusions layer is where one gets handled if it shows
up in practice.

(For the record: *Rose*, *Sage*, *Holly*, *Lily*, *Basil*, *Rosemary*, *Ivy*
and *Willow* are **not** genera — those plants are *Rosa*, *Salvia*, *Ilex*,
*Lilium*, *Ocimum*, *Salvia*/*Rosmarinus*, *Hedera* and *Salix* — so common
names in marketing copy are not themselves a risk.)

**A bundled data file is now part of `@plant-app/domain`.** 48,873 genera,
**589KB on disk and ~175KB gzipped** — above the ~120KB the triage brief
estimated. The cost is paid by both apps; it buys a purely local check, which
is what keeps `parseOcrTextLines` synchronous and keeps a scan from depending
on the network to decide what a word is. The Set is built on first lookup
rather than at import, so the parse cost falls on the first scan of a session
instead of on every app start, including the sessions that never scan
anything.

**The vocabulary is a snapshot and will drift.** The generator is checked in
and re-runnable, and records its source and filter, so refreshing it is a
command rather than an archaeology exercise. Nothing refreshes it
automatically.

## What this does not change

- **Common names are still never extracted.** ADR-0004's finding that they are
  too varied and multilingual to guess stands and is not reopened.
- **The whole-line anchor stays.** Loosening it to match a binomial embedded
  in a longer line was #23's original proposal and is explicitly rejected
  above.
- **Nothing is auto-applied.** OCR proposes and a human decides, per
  `CONTEXT.md`. A validated genus is still only a pre-filled field the user
  confirms.

## Relationship to prior ADRs

**ADR-0004** (Tag Scan OCR runs on-device; USDA adapter) is neither amended
nor contradicted. It placed OCR on-device and chose USDA for trait
suggestions; both stand. What it did not need to name was a *name-validation*
source, because the shape rule was assumed sufficient. This ADR adds that
role. One of ADR-0004's supporting figures is worth reading alongside the
table above: its "8/8 usable" measured what Vision recognised, not what the
parser extracted.

**ADR-0003** (web desktop, native mobile, cloud backend) constrains where this
can live. A bundled vocabulary consulted locally is what lets the check run
identically on both surfaces without either app calling out — no new backend
surface, no Edge Function, nothing added to ADR-0003's cloud side.
