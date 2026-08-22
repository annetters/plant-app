# ADR-0004: Tag Scan OCR runs on-device; USDA adapter validated with real coverage gaps

## Status

Accepted — 2026-08-21. Resolves the OCR-placement question ADR-0003 left
explicitly open ("Domain logic execution" → "OCR is not settled onto either
side yet"). Validated by the throwaway prototype
`prototype/tag-scan-ocr/` (Issue #19).

**Named limitation**: the cloud-OCR side of the comparison the issue asked
for was **not executed live** — no cloud OCR API credential was available
this pass. The decision below rests on the on-device results alone plus
desk research on cloud OCR's known characteristics, not a real side-by-side.
That was judged acceptable because the on-device results were strong enough
on their own to clear the bar Tag Scan needs — see "Decision" below for why
that makes the missing comparison non-blocking rather than a gap papered
over.

## Context

`CONTEXT.md`'s Tag Scan section and ADR-0003 both left OCR execution
location undecided, pending exactly this test: **"testing on-device OCR
against real nursery tags is exactly how you'd find out whether it's even
accurate enough to skip the cloud option."** Which side it lands on decides
two downstream questions:

1. Does OCR need a Supabase Edge Function (ADR-0003's rule: anything calling
   an external adapter with a secret runs server-side), or can it live in
   the shared `@plant-app/domain` client package alongside Tag Scan's
   matching/de-dup logic?
2. Does Tag Scan need a credential to protect at all?

The same prototype pass also validates USDA PLANTS' characteristics-search
adapter — named in `CONTEXT.md` as Tag Scan's species-level trait source, but
never actually exercised against a live endpoint until now (see
`docs/research/plant-data-source-cultivar-level-evaluation.md`, which
evaluated USDA on paper only).

## Decision

### OCR runs on-device, in the shared client package

**Apple's Vision framework (`VNRecognizeTextRequest`), not a cloud OCR API.**
Tested for real against 8 real nursery tag photos the user supplied
(deliberately varied: mixed `.jpg`/`.webp`, different orientations, some
single-sided, some with multiple tag inserts photographed together — see
`prototype/tag-scan-ocr/README.md` for the full per-tag breakdown).

**Result: 8/8 photos produced usable text**, recovering common name,
scientific name, cultivar, hardiness zone, light, and height on every tag —
5/8 cleanly at full confidence, 2/8 with lower confidence on multilingual
marketing copy but with every decision-critical field still legible, and one
(tag8) that OCR read perfectly but whose *own printed content* was
internally inconsistent (a supplier template error, not an OCR failure —
see "Tag data isn't always internally consistent" below).

This clears the bar Tag Scan actually needs. Per `CONTEXT.md`'s Tag Scan
design, OCR only ever proposes candidates for the user to confirm against
the tag — it was never required to be perfect, only good enough that the
user isn't constantly rejecting garbage. On real tags, it was.

**Consequence: no credential to protect, no Edge Function needed for OCR.**
Per ADR-0003's split (server-side only when a secret needs protecting), OCR
joins the shared-client-package list (task-template cascading, Bloom
Timeline math, Tag Scan matching/de-dup) rather than the Edge Function list
(USDA, geocoder, tile server).

### Cost: this leaves Expo Go

`apps/mobile` currently runs on Expo Go (SDK 54, deliberately downgraded to
match Expo Go). Vision framework access isn't reachable from Expo Go — it
requires a native module, which means a custom EAS dev client. **This is a
real, one-time infrastructure cost this decision incurs that the cloud path
would not have**: cloud OCR is a plain `fetch`, Expo-Go-compatible as-is.
Judged worth paying, since the alternative (cloud) reintroduces a credential
that then has to be proxied through an Edge Function anyway, plus per-call
cost, plus a network dependency Tag Scan doesn't otherwise need — against a
one-time build-tooling change that every other native-module feature this
app might ever want (camera capture itself, for instance, may already force
this same move) will likely require regardless.

### Flag for ADR-0003: cross-platform "free" native access doesn't fully hold here

ADR-0003 chose React Native over Flutter partly because "nothing in the spec
— camera, notifications, maps — is behind an API cross-platform can't
reach." **OCR complicates that.** Vision is Apple-only; an Android build
(ADR-0003: "added later at low incremental cost") would need a *different*
on-device OCR (Google's ML Kit Text Recognition — also free, also on-device,
but a second native integration, not the same module reused). Flagged here
per `docs/agents/domain.md`'s ADR-conflict rule, not silently patched over —
ADR-0003's platform choice isn't reopened, but its "no native-API access
this app doesn't need" reasoning should be read as *mostly*, not entirely,
true once OCR is in the picture.

### Cloud OCR: not tested live, and not needed to make this call

Google Cloud Vision (`DOCUMENT_TEXT_DETECTION`) was the intended comparison
point — strong general OCR quality, simple API-key REST call — but no
credential was available this pass. `prototype/tag-scan-ocr/cloud-ocr.mjs`
is scaffolded with the same CLI shape as the on-device harness so running the
comparison later is one command, not a rebuild.

This is named as a real limitation, not hidden — but it isn't a blocker on
the decision above: the comparison exists to answer "is on-device good
enough to skip the cloud option," and the on-device answer on real tags was
clearly yes. A live cloud number would only have mattered if on-device had
been borderline or bad. Revisit if a much larger, messier real-world tag
sample later shows on-device Vision struggling in ways these 8 didn't.

## USDA PLANTS characteristics-search: adapter validated, with a sharper coverage gap than previously known

### The API is real, live, and needs no credential

Confirmed by direct HTTP calls, not documentation-reading — the search UI at
`plants.usda.gov/characteristics-search` is a client-rendered Angular SPA
with no published API docs, so the actual endpoints were recovered from its
runtime config at `https://plants.sc.egov.usda.gov/assets/config.json`
(`serviceUrls.plantsServicesUrl`):

- `GET https://plantsservices.sc.egov.usda.gov/api/characteristicSearchResults`
  → full species list (2186 entries: id, scientific name, common name,
  family). No auth, no key.
- `GET .../api/PlantCharacteristics/{id}` → ~80 real trait fields per
  species. Verified live end-to-end against *Digitalis purpurea* (matched
  from tag6) — see `prototype/tag-scan-ocr/usda-sample-response.json` and
  `usda-pull.mjs`.

**Hardiness zone resolved**: no direct zone field exists, but `Temperature,
Minimum (°F)` is present per species and a zone is derivable from it
client-side (standard USDA zone bands are defined by average annual minimum
temperature). This resolves the "unverified" note in
`docs/research/plant-data-source-cultivar-level-evaluation.md`, updated
alongside this ADR.

### Flag for the prior USDA research doc: species-level coverage has real gaps too, not just cultivar-level

The existing research doc already ruled out cultivar-level matching from
USDA (no cultivar field exists at all) and adopted USDA anyway as the
species-level foundation. Testing against the real tag set sharpens that:
**of the 7 distinct species named across the 8 real nursery tags, only 2
(*Digitalis purpurea*, *Hibiscus moscheutos*) had an exact match** in USDA's
2186-species characteristics dataset. The other 5 — *Phlox paniculata*,
*Monarda didyma*, *Scabiosa columbaria*, *Heuchera* (multiple cultivars),
*Agastache* (multiple cultivars) — had **no species-level entry at all**,
only more native/wild congeners in the same genus (e.g. *Monarda fistulosa*
present, *Monarda didyma* — common garden bee balm — absent).

This tracks with what USDA's characteristics-search actually is: an NRCS
*conservation*-plant dataset, not a general horticultural database — its
selection criteria favor native/naturalized species relevant to
conservation use, which is a materially different population than "popular
ornamental nursery cultivars." **Not a reason to reverse the prior
decision** — free, credible, easy-to-integrate, real bulk/API access all
still hold, and something is better than nothing for the species that do
match — but the earlier framing ("adopted as the species-level foundation")
somewhat undersold how often it'll come up empty on exactly the kind of tag
Tag Scan exists to scan. Tag Scan's existing design already anticipates this
correctly: when a scan doesn't resolve, show candidates and let the user
confirm from the tag rather than guessing — that now needs to include "USDA
has nothing at all for this genus/species," not just "USDA can't get to
cultivar level," as an expected, common outcome, not an edge case.

### Tag data isn't always internally consistent

Two real tags surfaced a wrinkle for whatever eventually consumes OCR
output: tag7 had two stapled inserts giving *different* hardiness ranges
(3-8 vs 4-9) for the same plant, and tag8's header ("Tutti Frutti Agastache")
didn't match its own body copy ("Scabiosa columbaria Harlequin Blue") — a
supplier template error, not an OCR miss (Vision read both perfectly). Tag
Scan's user-confirms-everything design already covers this in principle;
worth having a concrete real example on record for whoever builds the
confirmation UI, since "the tag disagrees with itself" is a real case, not a
hypothetical one.

## Consequences

### Gains

- OCR ships free, offline, with no per-scan cost and no credential to
  protect or rotate.
- Resolves ADR-0003's explicit open item — Tag Scan can now be built without
  guessing at architecture.
- USDA adapter is confirmed real and working, with a concrete matched
  example (`usda-sample-response.json`) to build the actual integration
  against instead of guessing at response shape.

### Costs and risks

- `apps/mobile` must move off Expo Go to a custom EAS dev client to reach
  the Vision framework — a real, one-time build-tooling change, not free.
- Android will need a second on-device OCR integration (ML Kit) when that
  platform is built — not a drop-in reuse of the iOS module.
- The cloud-OCR comparison this ADR is partly based on was never run live —
  if a much larger or messier real-world tag sample later reveals on-device
  accuracy problems these 8 tags didn't surface, revisit with an actual
  cloud run rather than assuming the desk research still holds.
- USDA will return nothing for a large share of real nursery tags (5 of 7
  species tested here) — Tag Scan's "show candidates, let the user confirm"
  design already handles this, but it needs to handle "no USDA match at all"
  as a routine outcome, not a rare one.

## Relationship to prior ADRs

Resolves ADR-0003's explicitly deferred OCR-placement question; does not
reopen anything else in it. Flags, without reopening, ADR-0003's "no
native-API access this app doesn't need" framing (OCR needs a
platform-specific native module either way) and its Expo-Go-compatibility
assumption (the shared-client-package plan for OCR now requires leaving Expo
Go). Extends, without reversing,
`docs/research/plant-data-source-cultivar-level-evaluation.md`'s USDA
adoption decision with a sharper, tested species-level coverage number.
