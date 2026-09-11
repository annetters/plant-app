# Handoff: Personal Garden Plant Registry — plant-app

**Date:** 2026-09-09

## PICK UP HERE: #28's QA has not been run

**#28 is built, reviewed and committed (`0e83cc6`) but has had no QA at all.**
Everything below about it comes from reading the code, never from using it.
It is **open**, and closing it is the user's call.

The pass to run is in "#28: the map scale, stated and drawn" below. Part A,
steps 1–5, on a desktop browser — the one step that is the whole ticket is
setting the grid to a distance the user has genuinely measured and counting
squares along it. If the app disagrees with their tape measure, the ticket
has failed at its only job.

**There is uncommitted work in the tree**, deliberately: a `gridTemplateRows`
fix in `BaseMapBackground.tsx` plus a new `BaseMapBackground.test.tsx`. Held
back because the user's standing preference is that QA findings land as one
reviewable commit, and the pass hasn't started. Confirm it's still there
(`git status`) before doing anything else — this worktree is shared with
other sessions. If it's gone, it's the fix described under "The tile grid
never sized its rows" below, and it's five lines.

---

**Most recent session.** **#36 implemented** — the species lookup now
resolves against USDA's full checklist held in our own Postgres, not the
2,186-row conservation-traits table it mistook for the species universe.
"dahlia" finds *Dahlia pinnata*. **Verified against the live project**, not
only in tests. **Not QA'd by the user, not closed.** See "#36: names local,
traits live" below. **#50 filed** — native status needs a state-level range;
split out at the user's direction.

**The session before.** **#28 implemented** (`0e83cc6`) — a Property's map
scale is now stated on the page, drawn as an optional measurement grid on
both surfaces, and a wrong one can be redone. Built with `/implement`,
two-axis reviewed, all three suites green (278 domain / 254 mobile / 222
web). **Not QA'd, not closed.** See its section below.

**#47 fixed, QA'd and CLOSED** (2026-09-10, `29886df`) — the delete flows:
the suppressible confirmation, the delete that reported success without
deleting, and orphaned planting photo files. **#56 filed** from it: deleting a
*Plant* orphans photo files the same way, which no ticket covered. See "#47:
the delete flows".

Two decisions the user made this session, both worth not relitigating:

- **A phone browser is still not a surface they intend to support.** Asked
  directly, they said no. So `crypto.randomUUID()` throwing over a LAN-IP
  http origin — which breaks `BaseMapSetup` and every photo upload there —
  is **deliberately unfiled**. Matches ADR-0003 and CONTEXT.md.
- **Every account is throwaway during MVP.** "All accounts are intended to be
  throwaway while we build MVP." QA no longer needs to protect one; delete and
  recreate Properties freely. The cascade still costs the *map* (Beds, Pins,
  photo logs) and keeps the Registry, since Plants hang off `user_id`.

**Before that.** **#44 fixed** (`6abcf9d`) — USDA's `Shade Tolerance`
no longer suggests a `sunRequirement` at all; remapping the apparent inversion
was rejected as shipping a guess about an undocumented field. **#23 fixed**
(`d3bcf6c`) — Tag Scan validates a candidate genus against a bundled GBIF
vocabulary instead of trusting line shape, going from 3 correct / 2
confidently wrong / 3 empty to 3 correct / 0 wrong / 5 empty. ADR-0006 records
it. Both closed; **#45** and **#46** filed from the conversation around them.
See their sections below.

**And before that.** **#42 fixed and closed** (`7331099`) — the flaky `BedEditor`
test, whose cause was not the one the ticket guessed: the test waited on the
Bed name reaching the DOM then asserted on `onBedsChange`, one passive-effect
flush apart. `BedEditor` was never wrong. The dev-client QA sitting ran and
passed (2026-09-08). **#40 fixed** (`e44325d`) and closed at the user's
explicit instruction. **ADR-0003 amended: a mobile browser is not a supported
surface** — the decision this session leaned on twice.

> Earlier entries used to be summarised here as a "previously…" chain. It
> was removed 2026-09-07: every item in it named a section that still has
> its own heading below, so it only duplicated the table of contents at the
> top of a doc that is read in full at every session start. Don't re-add it
> — same reasoning as the 2026-09-06 trim.

**Repo:** `annetters/plant-app` · branch `main`

---

## #36: names local, traits live — built and live-verified, NOT user-QA'd, OPEN

The species lookup missed most garden plants. The cause was never USDA's
coverage — it was the table being asked. `characteristicSearchResults`, which
the adapter treated as the species universe, is a 2,186-row NRCS
conservation-*traits* table. *Dahlia pinnata* is a plain binomial, not a
cultivar, and it simply isn't in it — so "USDA has no trait record" and "no
such plant" came out of the app as the same answer, and the second one is what
the user saw.

**ADR-0007 records the decision.** CONTEXT.md's Tag Scan section was rewritten
around it, and the now-fired "revisit when cultivar coverage is a real gap"
condition retired — the species-level revisit happened and was answered inside
USDA; the *cultivar* question is what stays parked.

### What shipped

**Names local, traits live.** Three tiers, narrowing as they go:

1. **Name** — `public.usda_plant_names`, our own copy of USDA's bulk checklist
   (48,994 accepted + 44,163 synonyms, 93,157 rows). Always answers.
2. **Profile** — `PlantProfile?symbol=`, live. Duration and growth habit.
3. **Traits** — `PlantCharacteristics/{id}`, live, and **only** when the
   profile's `HasCharacteristics` says the taxon has any.

Migrations `0025` (table, `pg_trgm` indexes, the `search_usda_plant_names`
RPC), `0026` (the service-role grant), `0027` (species-rank-only). Two Edge
Functions: the rewritten `usda-plant-traits`, and a new
`usda-plant-names-refresh` that is **invoked by hand** — USDA publishes no
update cadence, so there is none to match.

The client reads names **straight from Postgres** via the RPC; only traits go
through the Edge Function. That is the seam **#43** needs, so #43 doesn't have
to build it.

### Verified against the live project, not just in tests

Migrations pushed, both functions deployed, the refresh run for real:
**93,157 rows in 12.8 s**. A second run correctly came back `unchanged` off
the conditional request. Then, live:

| query | answer |
| --- | --- |
| `dahlia` | *Dahlia pinnata*, *Dahlia coccinea* — the ticket's headline symptom |
| `bee balm` | *Monarda didyma* etc., matched through USDA's spelling "beebalm" |
| `Sedum spectabile` | accepted *Hylotelephium spectabile*, flagged as a synonym |
| `Dahlia pinnata` | found, profile present, **0 characteristics** — no longer "not found" |
| `Echinacea purpurea` | found, 79 characteristics |
| `Rosa rug` | nothing — no partial-match false positive |
| `g`, `%` | nothing — the guards hold |

A type-ahead-shaped query returned in **251 ms**.

A throwaway account was created to get a session for this and **deleted
afterwards**.

### Two bugs the live run caught that tests could not

- **`service_role` had no GRANT.** The first refresh died on `permission
  denied for table usda_plant_names`. 0025 granted `authenticated` and stopped,
  reasoning that the refresh bypasses RLS — but bypassing RLS is not having a
  grant. Exactly the trap `0002_grant_plants_table.sql` documents. Fixed in
  `0026`.
- **A bare genus was offered as a species.** `dahlia` ranked the genus row
  *Dahlia* first, and picking it would have written a genus into
  `scientific_name` — which CONTEXT.md forbids outright ("never just a common
  name or genus"). Fixed in `0027`; above-species rows stay in the table but
  are excluded from search.

### Behaviour changes worth knowing before QA

- **A miss now usually means a cultivar**, and the copy says so. The old
  message blamed the dataset; that explanation is no longer true.
- **`SpeciesNameSummary.commonName` is nullable.** USDA has no common name for
  5,218 accepted taxa and requiring one silently discarded them.
- **Picking a species no longer overwrites the common name the gardener
  typed.** Against the old dataset the two strings were near-identical so this
  never showed; against the full checklist, picking *Monarda fistulosa* after
  typing "bee balm" replaced it with "wild bergamot".
- **Duration / growth habit / family** show as attributed reference text
  ("USDA PLANTS records this species as: perennial · forb/herb · family
  Asteraceae"). Never saved. USDA's families are Cronquist-era — *Acer
  palmatum* reads as Aceraceae — which is why they are attributed.

### Native status: deliberately absent, now #50

The user's call, and worth not relitigating: USDA answers native status per
coarse region ("L48"), and **native is only meaningful against the gardener's
own area**. Region-level would be read as an answer it isn't, so none is
shown.

USDA *does* hold state-level nativity, on a different service — the ArcGIS
layer behind its distribution map
(`apps.geo.fpac.usda.gov/.../plants/MapServer`, layer 4 "States and
Provinces", fields `country_subdivision_name` + `plant_nativity_id` + `Symbol`;
layer 6 is Counties). A `Symbol`-filtered query returned **0 features** and an
unfiltered one **timed out at 90 s**, so it is plausible and unsolved.
**#50** carries that, with these findings written down so nobody re-derives
them.

### The QA that has not been run

None. Everything above is live-verified at the API and database level; **no
one has used the app**. The pass wants a device or dev client, since the
lookup lives on native mobile only (the web form gets it in #43):

1. Add Plant → type "dahlia" → Look up species. Should offer *Dahlia
   pinnata*, not a shrug.
2. Pick a candidate whose USDA common name differs from what you typed —
   your text should survive.
3. A species with no traits (*Dahlia pinnata*) should still save fine and
   show the grey USDA line.
4. A species with traits (*Echinacea purpurea*) should still offer mature
   height for accept/reject.
5. Tag Scan's review screen — same lookup, same behaviour.

**Ask the user whether they want to run this themselves or have it driven,
per `CLAUDE.md`.**

---

## #28: the map scale, stated and drawn — built, NOT QA'd, OPEN

Committed `0e83cc6`. A Property's scale was used purely as a gate: three call
sites asked `pixelsPerFootForProperty` whether one existed and nothing ever
showed what it was, so a wrong calibration was indistinguishable from a right
one. That is how #6 shipped a base map calibrated against a 512px canvas while
the stack rendered at 768px, putting every Bed and Pin ~1.5x off — caught by
code review, because nothing on screen would have.

### What's there

**`baseMapCalibration()`** (`packages/domain/src/baseMapCalibration.ts`) — the
new seam. Answers what the scale *is*, not merely whether it exists:
px-per-ft, where it came from (`aerial-imagery` / `scale-reference`), the
ground width the map covers, and whether it can be redone. `mapWidthFeet` is
the half that matters: "2.75 px per ft" reads as plausible whatever it is,
where "about 420 ft across" is obviously wrong on a 180 ft lot.

**`measurementGrid()`** (`packages/domain/src/measurementGrid.ts`) — grid line
geometry plus `defaultGridSpacingFeet`, which picks from
`[1, 2, 5, 10, 25, 50, 100]` ft so squares stay countable at any scale. Both
surfaces render the same computed lines, so they cannot disagree about where a
line goes.

**Web** — `MeasurementGrid.tsx` is one absolutely-positioned SVG overlay that
drops into all three map surfaces unchanged (preview, `BedEditor`,
`PlantingMap`), because all three are a `position: relative` box at
`STAGE_SIZE_PX` with `BaseMapBackground` inside. It sits over the imagery and
under the Konva stage, so Konva never had to learn about it. Spacing is a free
number with the round values as datalist suggestions — a known run is a 37 ft
driveway as often as a tidy 25.

**Recalibration** — `BaseMapSetup` gained a third `'recalibrate'` mode which
reuses the stored photo/drawing and lands straight on the two-point step.
Deliberately not `'update'` with a flag: the gardener is fixing a *scale*, not
replacing the map it was measured against, and demanding a re-upload to move
two dots is what kept anyone from doing it. Photo/drawn only — an aerial scale
is derived from latitude and zoom and has no input to correct.

**Mobile** — `MapScreen` shows the same scale line, a grid toggle, and a row
of tappable square sizes. Read-only; native calibration is still #15.

### Why redoing a scale is safe

Beds and Plantings are stored in **real-world feet**, not pixels
(`pixelsToFeet` rounds to a thousandth of a foot, ~300x finer than a pixel at
any scale this app reaches). They keep their positions and simply redraw
against the new scale. The user asked this directly and agreed no change was
needed. Storing pixels would make Recalibrate a trap rather than a repair.

### What the two-axis review caught, all fixed before the commit

- **Standards:** `CONTEXT.md` said a Scale Reference is "used once per
  Property" — true until this ticket. Already fixed by the time the review
  landed. Also an untrue why-comment, four near-identical `lines.map` blocks,
  a triplicated calibration guard, and an unused `stageSizePx` parameter.
- **Spec:** the old scale **vanished** while picking the new one, removing the
  before/after comparison the ticket exists for. And a photo that failed to
  load still offered a clickable surface, so two clicks saved a scale measured
  against nothing — the exact silent-wrong-scale failure #28 is about.
- From its own test: the spacing box snapped back mid-edit, so typing "37"
  over a "5" gave "537". Now held as text, like `BaseMapSetup`'s distance
  field.

### CONTEXT.md changes

Scale Reference no longer says "used once"; it records that a scale can be
redone, why that is safe, and that aerial has nothing to redo. New
**Measurement grid** glossary entry: a reference, never a drawing surface —
nothing snaps to it and turning it on stores nothing.

### The tile grid never sized its rows — fix UNCOMMITTED

`BaseMapBackground` set `gridTemplateColumns` for the 3x3 aerial tiles and
left the rows implicit. Auto rows can't resolve a tile's `height: 100%`, so
each fell back to its intrinsic 256px and the three rows stacked to 768px
however short the container was. Only bites the `PropertyPage` preview
(`maxWidth: 768` + `aspectRatio: 1`); the editor and Plantings map are pinned
at `STAGE_SIZE_PX` so 1fr already equalled 256px.

Cosmetic until #28 laid a `viewBox`'d SVG over the same imagery — that scales
correctly, so a mis-sized tile grid means the squares no longer align with the
ground they measure. Fixed with `gridTemplateRows`, plus a new
`BaseMapBackground.test.tsx`. **Uncommitted**, awaiting the QA pass.

Caveat worth carrying: jsdom does no grid layout, so that test asserts the CSS
declaration, not a measured result. The diagnosis is reasoning from the
cascade. It needs a human to look at it, on a Property with **zero Beds** —
the preview is the only surface that shows it.

### Deliberately not built

- **Replacing a wrong photo or drawing.** That is re-sourcing a base map,
  which CONTEXT.md calls a recreate, not an edit. Different operation.
- **Native calibration** — still #15.
- A custom spacing on the phone; it offers the round values only.

### The QA pass, unrun

Not yet exercised at all. `npm run dev`, log in, `/map`.

**Part A — desktop, non-destructive.** (1) The scale line reads plausibly and
"covers about N ft across" matches the imagery's extent. (2) No Recalibrate on
an aerial Property. (3) **The ticket in one step:** tick Show measurement
grid, type a distance actually measured in the real garden, count squares
along it — it must come out to the number they know. (4) The grid follows onto
the Bed editor and Plantings map at the same spacing, under the outlines.
(5) Toggling off takes the spacing box with it.

**Part B — a fresh Property.** Photograph a tape measure, upload it, calibrate
against a known span, set squares to 1 ft: the lines should land on the
ruler's own markings. Then Recalibrate with a deliberately doubled distance
and confirm the grid goes visibly wrong, that "Current map scale" stays
visible throughout, and that "Keep the current scale" changes nothing.

No throwaway account needed — every account is throwaway now.

---

## #47: the delete flows — fixed, QA'd, CLOSED

Built with `/implement`, two-axis reviewed, committed as `29886df`, Edge
Function deployed, and a full manual pass run 2026-09-10 with **no findings**.
Suites: 308 domain / 270 mobile / 249 web / **17 edge-function** — that last
runner is new (`vitest.functions.config.ts`); Edge Functions had no test
coverage at all before this.

The issue and the commit message carry the detail. What matters going forward:

**`delete-map-object` must be deployed or Property *and Bed* deletes fail** on
both surfaces. Bed removal has no confirmation in front of it (#48), so it
fails silently from the gardener's point of view. Check the deploy first if a
delete ever looks dead again — `npx supabase functions list`.

**`deleteBedWithPhotos` exists only because `plantings.bed_id` still cascades.**
ADR-0009 reverses that. When #54 lands there are no photos beneath a Bed to
clean up, and that function should be deleted along with the cascade it
compensates for. It's commented as such, but it's the kind of thing that
survives a refactor by accident.

**Confirmation wording is shared, and must stay that way.**
`packages/domain/src/deleteConfirmations.ts` is the single source for both
surfaces; #48 should extend it rather than growing a second set of strings.
Web renders it through `ConfirmDialog`, native through `Alert` — only the
mechanism differs.

**Web confirms with a plain `role="dialog"`, not `<dialog>`.** jsdom 25 ships
`HTMLDialogElement` but implements neither `showModal()` nor `close()`, so
testing one means polyfilling the behaviour under test. Don't "upgrade" it to
`<dialog>` without solving that first.

**A stale `vite` process cost real time during the pass.** The first QA report
was "I still get a browser dialog" — the code was correct and both dev servers
were serving it; the browser tab held pre-change JS, and a server left running
from an earlier session held :5173, pushing the new one to :5174. Check
`ps aux | grep vite` and hard-reload before believing a web fix didn't land.

---

## #42: the flaky BedEditor test — fixed, CLOSED

**Commit `7331099` on `main`; closed 2026-09-09 at the user's explicit
instruction.** Test-only change, two hunks, no product behaviour touched.

**The cause was not this ticket's hypothesis.** The ticket guessed
`findByText` resolved on the render while the callback was still pending.
Instrumented render/notify logging showed something more specific: the Bed
name enters the DOM when React *commits*, and `onBedsChange` fires from a
`useEffect` scheduled *after* that commit. `findByText` observes the commit,
so under load the assertion ran in the gap. The
`.then(setBeds)`/`.finally(setBedsLoaded)` split was ruled out — React
batches them, and failing runs show a render sequence identical to passing
ones.

**`BedEditor` was never wrong.** It stayed silent until the fetch settled on
every run, the failing ones included. The test asserted a property the
component does not guarantee and passed ~93% of the time on luck, so this
replaced a false assertion with a true one. `useLayoutEffect` would have
made the original assertion hold and was rejected on design grounds — a
parent notification is not layout work. Untested; an option not taken.

The sibling test at `BedEditor.test.tsx:257` had the identical mechanism and
was fixed in the same commit.

**Don't restate the detail here** — the issue comment carries the
instrumentation trace and the verification table (8 failures in 110 stressed
runs before, 0 in 60 after).

**Left alone deliberately:** `BaseMapSetup.test.tsx:70` and `:135` wait on a
button already in the DOM before asserting on `onUpdated`/`onCreated`. It
was stress-run 30x under load with 0 failures, so it is a smell rather than
a demonstrated flake. The user's call was to leave it and not file it.

---

## #37: the duplicate check on every creation path — built, reviewed, CLOSED

**Commit `cc80ec0` on `main`; closed on GitHub at the user's explicit
instruction** (per `CLAUDE.md`, that instruction is the only thing that ever
closes an issue here — a finished ticket isn't authorization). `CONTEXT.md`
promised one Plant record per plant type/cultivar. `checkForDuplicatePlant`
had **exactly one caller** — Tag Scan's review screen — so the two paths a
gardener actually *types* a plant into (web `/registry/new`, the phone's Add
Plant form) could each write a second record for a plant already in the
Registry. The path that did check is the one needing it least: a scan starts
from a physical label the gardener is holding.

**The shape of the fix.** All three paths run the same check at the same
seam — validated input, before the write — load the existing Plants the same
way, and degrade to "no known duplicates" on a load failure rather than
blocking the form, which is what Tag Scan already did. Both forms now gate
their submit button until that list arrives, as Tag Scan gated Continue.
`checkForDuplicatePlant` itself was not touched; the ticket was explicit
that it needed no changes, and it didn't.

**Decisions the ticket left open, and how they went:**

- **Inline on all three**, the shape #31 used for ambiguous species. Neither
  surface needed a new route.
- **`TagScanDuplicateOfferScreen` retired**, with its route (−306 lines).
  Its "create anyway" was a second copy of the review screen's own create;
  inlining the offer collapses that back to one, tag-photo linking included.
- **The wording lives in `@plant-app/domain`** (`DUPLICATE_PLANT_OFFER`), so
  the three surfaces present the same decisions in the same order. This is
  the anti-drift device the ticket asked for by name: `plantLabel` diverged
  between web and native in #18, and the suggested-traits panel existed as
  two copies until #31. Native additionally shares one `DuplicatePlantOffer`
  component across its two paths; **web has its own markup** — different
  framework, nothing to share below the wording.
- **Creating anyway survives on every path**, per CONTEXT.md's
  offer-an-alternative model.

**The ⚠️ check in the ticket paid off, but not as written.** It warned that
`TagScanDuplicateOfferScreen`'s "Planting CRUD is #8's work" docstring might
be stale. It was worse than stale: **there was no "add a Planting" action at
all**, only prose explaining its absence. With #8 shipped it is now real —
the offer opens the map's add-Planting form with the matched Plant already
chosen (`?addPlantingForPlantId=` on web, a `Map` route param on native).
Both surfaces treat that parameter as a **one-shot instruction and clear it
once honoured**; left in place, a reload or a refocus reopened a form the
gardener had cancelled. That was a real bug in the first cut, caught by the
Spec axis of `/code-review`.

**CONTEXT.md changed.** The one-source-of-truth rule moved out from under
Tag Scan into **Plant**, reworded to hold however a record is created and to
say plainly that it offers an alternative rather than prohibiting a second
record. The rule was always indifferent to how the record got made; only its
placement suggested otherwise.

**Deliberately not done:** linking a scan's tag photos onto the matched
Plant when "add a Planting instead" is taken. It was in the first cut and
came back out — it writes to a record the gardener came here specifically
*not* to duplicate, irreversibly from the UI, before they have committed to
the Planting at all (including when they back out of it). The retired screen
never did it either, and #37 didn't ask for it.

**Also not done, and flagged rather than fixed:** if the Property has no
Beds, the offer's primary action lands on a map that can only say "Draw a
Bed first." The map's own empty state explains the situation, but nothing
connects it back to what the gardener asked for. Small follow-up if it
irritates in practice.

**Duplication accepted, with reasons.** Both review axes flagged the
near-identical preselect effect and registry-loader effect across
`PlantingMap`/`MapScreen` and `PlantFormPage`/`PlantDetailScreen`. Left as
is: there is no shared React package in this repo — `packages/domain` is
deliberately dependency-free — and creating one for three small effects is a
larger architectural move than this ticket should make. What had to be
shared to stop drift is shared.

**Not run: any manual QA.** Automated only — 717 tests across the three
workspaces (domain 237, mobile 265, web 215), typecheck clean, lint back to
its pre-existing 11 warnings. Nothing here has been exercised by hand on a
device or in a browser; the duplicate offer's appearance, the map handoff,
and the native navigation reset out of a scan are all worth a look.

---

## Backlog triage: the board now has a verdict on every issue

**2026-09-04, docs only — no code touched, nothing closed.** The user asked
whether every open ticket has to be addressed before the app can ship. It
doesn't. `needs-triage` had built up to **11 of 17 open issues**, so the
backlog looked like 17 obligations when it was really four.

**`needs-triage` is now empty.** The MVP board is:

| # | Labels | |
|---|---|---|
| 14 | `ready-for-agent` | Native: Map view — the last unbuilt MVP feature |
| 34 | `ready-for-human` | Outstanding manual QA from #3, #7, #8, #17 |
| ~~37~~ | *closed 2026-09-06* | Duplicate-Plant check on every creation path — see the #37 section above |

Plus **#1**, the spec epic, which closes when its children do.

**Deferred `post-mvp` (9):** #23, #24, #26, #27, #28, #30, #35, #38, #39 —
the Tag Scan OCR polish, the one-canvas map redesign, and five
nice-to-haves. The Tag Scan cluster went here on the strength of **story 15
in #1**: *"OCR failing, being unavailable, or misreading something never
blocks me from adding a plant — OCR is a convenience layer, never a
requirement."* Manual entry is the contract; OCR quality is allowed to be
imperfect at ship.

**`wontfix` (1):** **#36** (revisit the USDA data source), on the strength of
`CONTEXT.md`'s own line — *"Revisit when cultivar-level coverage is a real
gap in practice, not speculatively."* #36 is that speculative revisit. If
cultivar coverage later becomes a real, felt gap, reopen it; the label
records a decision already made, not a permanent ban.

**Judgement calls worth knowing:**

- **#33 was first labeled `needs-info`, then corrected to `ready-for-agent`
  on 2026-09-05** — see "#33 re-triaged" immediately below. Trusting the
  ticket's own "options to consider, not prescribing one" framing over the
  reported symptom was the mistake.
- **#21 lost its stale `needs-triage`**, which it had been carrying
  alongside `post-mvp`.

**Knock-on:** #29 is now fixed (see "#29 fixed" below) without pulling #28
forward. #28 (no indicator that a Property's base map has a calibrated scale)
is still `post-mvp` and still touches the same branch — the precedent from
#29 is that this branch now recognises the source, so #28's indicator work
has a clean seam to sit against when it lands.

`docs/agents/triage-labels.md` gained a **Scope labels** section documenting
`post-mvp` and when to reach for it over `wontfix`. It is held apart from the
five-role mapping table on purpose — see the note under "Scope change".

**Nothing was closed.** Per `CLAUDE.md`, a ticket looking finished is not
authorization to close it, and re-labelling is not closure by proxy: #36 is
`wontfix` and still open, awaiting the user.

> **Superseded 2026-09-08.** #36 no longer carries `wontfix` — it went to
> `needs-info` after the 2026-09-05 research, and to `ready-for-agent` on
> 2026-09-08. Both label claims about #36 in this section are history. See the
> board summary under "What to do next".

---

### #29 fixed (2026-09-06): wording branches on `baseMapSource`

**Commit `65f408c` on `main`; closed on GitHub by the user.** `PropertyPage`
rendered one no-scale message — "No aerial imagery is available … add a base
map another way" — whenever `pixelsPerFootForProperty` came back `null`. That
branch fires for two different failures: an aerial Property whose address had
no imagery, and a photo/drawn Property that just hasn't been calibrated yet.
Only the aerial case matched the wording. A photo/drawn gardener was pointed
at re-checking their address or switching base-map source, when the real fix
is to set the Scale Reference.

The wording predates #6, when photo/drawn only existed as an aerial fallback
and "no aerial imagery" was fair for everyone reaching that branch. #6 made
base-map source an up-front choice, and mobile's `MapScreen.tsx:499` already
worded this correctly.

**The shape of the fix:** branch on `property.baseMapSource`. Aerial keeps
the original copy. Photo/drawn now reads *"This Property has no Scale
Reference calibrated yet, so its Beds and Pins can't be drawn to scale.
Finish setting up its base map below."* Uses CONTEXT.md's proper term. Two
tests via `it.each` so photo and drawn stay symmetric, plus a negative
assertion tightened on the aerial test so the two branches can't blur again.

**Not done, and why:** the ticket's proposed direction was to *"point at the
calibration step rather than at choosing a base map."* Left as-is. The below
UI is `BaseMapSetup mode="update"`, which starts at the 'choose' step and
walks the user through re-upload/redraw before calibrating; there is no
calibration-only entry point today. Rewriting the copy to point at "just
calibration" would mislead about the flow it invokes. A calibration-only
entry point would be its own change, out of scope. The ticket body itself
labeled its wording proposal "for triage, not yet agreed."

**Not run:** browser QA. The change is invisible outside the photo/drawn +
no-scale state, which is not on any golden path — a photo/drawn Property is
normally created with its Scale Reference in the same session by
`BaseMapSetup mode="create"`. The state is reachable in principle (row-level
schema doesn't require `scale_reference`) but exercised only by tests.

**Two-axis review ran clean.** Standards flagged the two new tests as
copy-paste; the fix collapses them into `it.each`. Spec's partial finding on
"point at calibration" is what "Not done, and why" above records.

---

### #33 fixed (2026-09-06): a dot per placed point in the drawing surface

**Commit `a9ee262` on `main`; closed on GitHub by the user.** The re-triage
below correctly identified the defect: an SVG `<polyline>` with a single
point has zero length and paints nothing, so the first click on
`BaseMapSetup`'s drawing surface produced no visible feedback — the surface
read as broken to a user who had used it correctly. The only signal that
anything registered was "Finish this line" losing `disabled`, two points in.

**The shape of the fix:** render a `<circle>` per point of `currentStroke`,
reusing the treatment `calibrate` already applies to its `ScalePoint`s on
the same screen. Smaller (`r=4` vs `r=6`) and in the in-progress stroke's
own green — the line is the content here, and these are its vertices; there
the two points *are* the content. Committed strokes get no dots on purpose:
"Finish this line" is disabled below two points, so a committed stroke
always has a length to paint.

**Tests:** three new tests, TDD'd red-first. The one-point state is now
exercised directly — the re-triage's "why this survived" note called out
that every existing drawing test placed at least two points. The regression
test asserts a *drawable radius*, not just presence in the DOM, because
presence was never the problem; the fix was verified to bite by temporarily
setting `r={0}`. Two-axis code review's three findings applied in the same
diff — the test id avoids "marker" (CONTEXT.md reserves that for Pin), the
drawable-radius assertion above, and an inline note on why committed
strokes are excluded.

**Not done, and why:** moving placement from `onClick` to `onMouseDown`
stays out of scope — `handleCanvasClick` is shared with the calibrate step,
so that would change Scale Reference placement too and wants its own tests.
Freehand dragging stays rejected: these are structural lines the Scale
Reference calibrates against, so hand-wobble would propagate into every
distance measured in the garden.

**Not covered by automated tests:** whether the dot reads clearly against a
real photographed plot plan at the sizes a person actually draws at. Worth
an eye during the next browser sitting.

---

### #33 re-triaged (2026-09-05): a missing mark, not a model choice

The user, recalling the session where they hit this: **the problem was that
when they started drawing, no dot or mark appeared to show it had worked.**
The code agrees, and it dissolves the decision the ticket was blocked on.

`apps/web/src/property/BaseMapSetup.tsx:234` renders the in-progress stroke as
an SVG `<polyline>` once `currentStroke.length > 0` — but **a polyline with a
single point has zero length and paints nothing.** The first placed point is
invisible whether the user clicked cleanly or dragged. The only feedback that
a click registered is "Finish this line" losing `disabled` at two points.

So the body's framing — freehand drag vs. click-to-place, "not prescribing
one" — was a red herring: a correct single click fails identically. There is
no interaction-model call for the user to make, which is why `needs-info` was
wrong.

**The fix, and the proof it's right:** the `calibrate` step *on the same
screen* already renders a `<circle r={6}>` per placed point
(`BaseMapSetup.tsx:291`), so a single point is visible there. The two steps
simply disagree about whether a placed point is visible. Reuse the circle.

**Nearly free alongside, but not required:** moving placement from `onClick`
to `onMouseDown` makes the mark appear on press rather than release, and lands
the point where the user pressed. Note `handleCanvasClick` is **shared with
the calibrate step**, so this changes Scale Reference placement too — it needs
its own tests.

**Freehand dragging is recommended against.** These are structural lines
(boundary, driveway, house outline) and this drawing is the base map the Scale
Reference calibrates against, so hand-wobble would propagate into every
distance measured in the garden.

**Why it survived:** `BaseMapSetup.test.tsx` always places two or more points
(`clickAt` twice, e.g. lines 150-151). The one-point state is never
exercised. A regression test should assert a marker is visible after a
*single* click.

---

## #31: manual Plant creation on native mobile — built, device-QA'd, CLOSED

**Build commit `9b74fb3`; QA fixes in `7487048`.** A Plant can now
be created on the phone without a tag to scan. Before this, Tag Scan was the
only path to a new Plant on mobile and it demands a front tag photo before
the flow will start — so a division from a friend, a seed-grown plant, an
inherited shrub or anything whose tag is long gone **could not be added from
the phone at all**. ADR-0003 names freehand drawing as its one exception to
native parity; creating a Plant record is not drawing.

**Device QA run to completion by the user and it passes** — three findings,
all fixed and regression-tested; see below. **Closed on GitHub by the user on
2026-09-04.** Note the sequence, as with #15: the user closed it themselves
before asking for it to be closed, so the `gh issue close` was a no-op — and
it silently dropped the summary comment attached to the same command, which
had to be posted separately. Worth knowing: `gh issue close --comment` posts
nothing on an already-closed issue.

### What's there

`PlantDetailScreen` now serves create as well as view/edit, the same way web
mounts one `PlantFormPage` at both `/registry/new` and `/registry/:plantId`.
Arriving with no `plantId` (`MainStackParamList.PlantDetail` is now
`{ plantId: string } | undefined`) starts from an empty form and creates on
save; that first save flips the screen to an ordinary detail view **in place,
on the same route**, at which point Delete and Reference photos appear — both
need a Plant row to act on. One rendering of the form, not a second copy: the
`plantLabel` web/mobile divergence #18's QA turned up is exactly the drift
this avoids.

Also new: `PlantsRepository.create` on mobile (mirrors web's), and an
"Add Plant" button on the Registry placed **outside** the has-plants branch,
so the empty state — the case that most needs it — can reach it.

### The species lookup moved out of Tag Scan

`lookupUsdaByCommonName`/`lookupUsdaByScientificName` were on
`TagScanRepository`. They are now `SpeciesLookupRepository`
(`apps/mobile/src/species/`), with `speciesLookup.ts` pairing each call to the
domain function that reads its result, and `SuggestedTraitsConfirmation`
holding the "USDA suggests these traits" step both creation paths show. The
value of a lookup is in the traits it returns, not in having photographed a
tag, so both paths share one mechanism rather than two copies.

**This changed Tag Scan's review screen**, which was nominally out of #31's
scope. Two deliberate changes, both flagged to the user at the time:

- Its suggested-traits panel now renders the sun/shade enum through
  `formatOption` ("full shade", not "full-shade") — the Registry's treatment.
  Cosmetic; the stored value is unchanged.
- It picked up the same 3-character minimum on the lookup (below).

### What `/code-review` caught, fixed before the build commit

- **Accepting suggested traits silently overwrote what the user had typed.**
  The merge was copied from Tag Scan, where it is safe because that review
  screen collects names only — but the full Plant form has its own Sun/shade
  and Mature height inputs. `traitsNotAlreadySetBy` now strips any suggestion
  the user has already answered, and if nothing applicable is left the save
  runs straight through instead of showing a panel that would change nothing.
- **The suggested-traits panel was a verbatim second copy** across the two
  screens. Extracted, along with `applySuggestedTraits`.

### What device QA found — run to completion, and it passes

Run by the user on a device. **Three findings, all fixed and verified; each
regression test was confirmed to fail with its fix reverted.**

1. **Stale species candidates survived an edit to the name they answered.**
   Looking up "rose", then typing "asdf" without saving, left the old
   candidates on screen — and the prompt interpolated the *live* field, so it
   read `"asdf" matches more than one species`. Results for one name were
   presented as matches for another. Candidates now clear when the common name
   changes, and carry the term they were looked up for so the copy cannot
   misattribute them.
2. **No minimum length on the lookup.** "g" returned "candidates", because
   `resolveCommonName` matches by substring — deliberately, since USDA's own
   common names are compounds ("common sunflower") — so one letter hits a large
   slice of the dataset and the result reads as ambiguity when it is noise.
   Minimum is now 3 trimmed characters (`canLookUpCommonName`), applied to
   **both** screens so they cannot disagree about what counts as a lookup.
3. **A no-match looked like nothing happened.** "dahlia" flickered the button
   and reverted. The message *was* being set — it rendered ~200 lines further
   down beside Save, off-screen on a phone. The lookup now reports beside its
   own button, and a failed lookup is worded distinctly from a genuine
   no-match (previously near-identical, which was actively misleading).

**Every other checklist item passed**, confirmed by the user on 2026-09-05:
the Registry entry point from an empty registry, the create form's blank state
and validation, the suggested-traits accept/skip panel, the
overwrite-protection case (a user-entered Sun/shade and Mature height are not
offered for overwrite), the post-save transition to edit mode, photos on a
newly created Plant, and the regression check that editing an existing Plant
is unchanged.

**The last item — the `formatOption` display change** ("full shade", not
"full-shade") — **ran and passed 2026-09-08, and #31 now has no QA
outstanding.** Two claims made about it here were wrong: it needed no rebuild,
and it was not reachable only through a real tag scan. #31's own move of
`SuggestedTraitsConfirmation` into shared code means the manual Add Plant form
reaches the same panel. See "The dev-client QA sitting".

### Filed during the pass

- **#36** — the USDA lookup misses most garden plants. "dahlia" returns
  nothing, and so does *Dahlia pinnata*, a plain species binomial. The cause
  is not cultivar coverage: `usda-plant-traits` queries USDA's
  `characteristicSearchResults` endpoint, which is the **characteristics**
  subset — pulled live on 2026-09-04 it holds **2,186 entries and no Dahlia
  record at all**. ADR-0004 already flagged this under a heading that says
  species-level coverage has real gaps too, not just cultivar-level (2 of 7
  species from real nursery tags resolved). CONTEXT.md's revisit condition has
  therefore fired, but in a different shape than it was written in. Labelled
  `needs-triage`, not `ready-for-agent` — it is a data-source decision.

### Deliberately not built

**No duplicate-Plant check.** Tag Scan runs `checkForDuplicatePlant` before
creating, per CONTEXT.md's "one source of truth per plant type/cultivar" rule.
Manual creation does not: #31's acceptance criteria don't ask for it, and
`TagScanDuplicateOffer` requires a `scanId`/`photoIds` a manual create has no
way to supply. **Manual creation can therefore produce a duplicate Plant that
a scan would have caught.** Both review axes raised this independently; it
needs its own ticket if it matters.

---

## #15: native Scale Reference calibration — built, QA'd on a device, CLOSED

**Commits `5d103f4` (build) and `ceb07b9` (QA findings).** A gardener can
photograph a plot plan or survey and calibrate its scale entirely from the
phone. This was the **last unbuilt ticket under the spec (#1)** — every
#2–#20 ticket now has code.

**Device QA run to completion by the user on a real iPhone, and it passes.**
No rebuild was needed (nothing native changed), so this was a plain Metro
session. Two findings came out of it, both fixed and committed — see "What
device QA found" below.

**Every item passed except one, which was skipped deliberately**: the
aerial-with-no-imagery fallback (item 7) needs an address with no Esri
coverage, which is hard to arrange on purpose and wasn't worth chasing.
That path is built and unit-tested but has **never run on a device** — the
same standing caveat #14's item 10 and 15b carry. Everything else, including
the first real upload to `property-base-map-photos` from a phone, passed.

**Closed on GitHub by the user, 2026-09-04**, with a summary comment on the
issue. Note the sequence, since it matters for the standing rule: the user
closed it themselves and *then* asked for it to be closed, so the `gh issue
close` was a no-op. The rule in `CLAUDE.md` held throughout — a passing QA
was not treated as authorization, and closure waited for the explicit ask.

**#15's closure unblocks nothing** — confirmed directly against the API: every
remaining open issue already shows `blocked_by: 0`. The dependency graph the
original 19 tickets carried is now fully drained.

### What's there

New `apps/mobile/src/property/BaseMapSetupScreen.tsx`, reached from the Map
screen's two former dead-end empty states. Two entry paths, told apart by
whether a Property already exists rather than by a route param, since an
account has at most one:

- **No Property yet** — name, photo, calibrate. Needs no address, no
  geocoder and no Edge Function, because a photo Property skips geocoding
  entirely by design; that's why the phone can create one without either
  Edge Function being ported.
- **An aerial Property whose address had no imagery** — photo, calibrate,
  updating the existing row.

Also: `tappedStagePoint` in `mapSurface.ts` (the tap counterpart to
`draggedStagePoint`, keeping every screen-pixel conversion in one place), and
`uploadBaseMapPhoto`/`createWithBaseMap`/`updateBaseMap` on mobile's
`PropertiesRepository`, ported from web but taking a `PickedPhoto` rather
than a `File` — React Native has none, so it uses the fetch-to-`ArrayBuffer`
path the other mobile repositories already use.

**No new dependency and no native module — so no dev client rebuild.** Given
how much time rebuilds have cost in this repo (see #14's entry), that's worth
knowing: a plain Metro reload picks this up.

### Deliberately not built

- **The drawn base-map source.** Desktop-only per ADR-0003. There is no
  `'choose'` step on the phone, only photo.
- **Creating a Property from an address.** That's #5's native parity, not
  #15's; it would need `search-addresses`/`create-property` ported.
- **OCR-extracted candidate measurements** for known-measurement mode.
  `CONTEXT.md` floats them, but web doesn't implement them either, so
  building them here would have exceeded parity.
- **Recalibrating a Property that already has a scale** — that's #28.

### What `/code-review` caught, all fixed before the commit

1. **The distance field was `number-pad`, which has no decimal key on iOS**
   — a tape-measured 42.5 ft simply couldn't be typed, making the phone's
   calibration silently coarser than web's (`step="any"`). Now `decimal-pad`.
   Every *other* numeric field in the app is a true integer, which is why the
   existing convention was the wrong one to copy here.
2. **A drawn-plan Property could have had its drawing destroyed.** Saving
   rewrites all four base-map columns as one set, and the entry point was
   gated only on "has no scale". Guarded now in both screens. It was
   unreachable in production — migration 0017's
   `properties_base_map_source_consistent` forbids an uncalibrated
   photo/drawn row — but **the MapScreen test covering that state was
   asserting against a row the constraint makes impossible**, so it gave
   false confidence. It now uses the aerial-without-imagery case, which is
   the only way a Property can really lack a scale. Third time in this repo a
   test has quietly pinned the wrong thing (see #25's and #14's entries).
3. **A failed Property load fell through into create mode** — a gardener
   could have photographed and calibrated a whole plan before hitting the
   one-Property-per-account index at the final save.
4. **No chance to review an uploaded photo before calibrating**, unlike web.
   A plan photographed at arm's length is easily blurry or cropped, and the
   two calibration points are about to be tapped against it.

One review finding was **not** taken: that "Name your map" drifts from the
glossary's *Property*. It's verbatim web's existing copy
(`PropertyPage.tsx:141`), so changing it on the phone alone would make the
two surfaces disagree. Worth fixing on both together, or not at all.

### What device QA found — both fixed in `ceb07b9`

1. **The Scale Reference step asked its question before there was anything
   to ask about.** "How do you know this distance?", the distance field and
   Save all sat below an untouched plan, so the screen posed the question
   before the two points it refers to existed. The block now appears only
   once both points are placed, with a prompt naming the next tap in
   between, and withdraws again when a third tap restarts the pair.
   **Web was deliberately left alone**: its wider layout doesn't read as one
   vertical sequence, and this changes disclosure, not behaviour or data, so
   ADR-0003's parity is untouched. Worth deciding separately whether web
   wants the same treatment.
2. **A Property created on the phone could only be deleted on the desktop.**
   The user hit this trying to re-run the create path: an account holds one
   Property, and there was no way to free the slot from the phone. Added
   `PropertiesRepository.remove` (ported from web) and a confirmed **Delete
   Property** control on the Map screen, using the same `Alert` shape
   removing a Planting already uses. It renders for **any** loaded Property,
   not just a calibrated one — an aerial Property with no imagery has nothing
   else to do on that screen, so it needs the exit more, not less.

   **This is beyond #15's acceptance criteria**, added at the user's explicit
   direction during the pass rather than because the ticket asked for it.
   ADR-0003 puts everything except drawing at full parity, so the gap was
   real; #15 is simply what made it bite, by making the phone able to create
   a Property in the first place. Same shape as #6, where live QA grew the
   ticket substantially. Web only has its own delete control because #5's QA
   hit the identical dead end.

### The checklist that was run

Needs a real device — camera, a real photo library, and touch accuracy
against a real plan. **No rebuild needed.** Reached from the Dashboard's Map
tile. Re-running it is now much easier: Delete Property resets the account in
place, instead of needing a fresh throwaway signup per round.

1. **The whole create path**: no Property → "Photograph a plot plan" → name →
   camera *and* library → the review step → calibrate → save. Does the Map
   then draw the plan with a sensible scale?
2. **Tap accuracy** — the two points are the entire calibration. Do they land
   where your finger went, at phone width? This is the one thing the unit
   tests genuinely can't prove.
3. **Is the plan legible enough to calibrate against at phone width?** The
   surface is the same fixed square web uses, shrunk to fit (~0.45x). A plan
   that's readable on a laptop may not be here — and if it isn't, that's a
   real finding, not a nitpick.
4. **Both modes**, and a **fractional distance** (e.g. 42.5) — the decimal
   keyboard is a fix made from code review, never seen on a device.
5. **Replace a photo** at the review step; confirm the *second* one is what
   gets calibrated and saved.
6. **Cross-check against web**: the same Property's Beds and Pins should sit
   in the same real-world places on both surfaces. A wrong scale shows up
   here and nowhere else.
7. **The aerial-fallback path**, if you can reach an address with no imagery
   coverage. **SKIPPED — still unverified on a device.** Reaching it means
   finding a real address Esri has no coverage for at zoom 18–21. If it ever
   needs proving, #5's QA created a Property at open-ocean coordinates
   (30°S, 140°W) through the `create-property` Edge Function directly, which
   would set up exactly this state.
8. **Storage RLS from the phone** — uploading to `property-base-map-photos`
   had never been exercised from a device before, only reading had. **It
   works**; every photo in the passing create runs went through it.

### Known gaps, deliberate — not QA findings

- **Abandoning setup after picking a photo orphans that object in storage.**
  Web does the same thing. Replacing a photo also leaves the previous one
  behind. Nothing references them and nothing breaks; worth a ticket if
  storage tidiness ever matters.
- **A screen reader can't place the two points** — same gap as Pin dragging
  on both surfaces, and for the same reason.

**Full monorepo green**: 235 domain + 223 mobile + 199 web, typecheck clean
across all three workspaces.

**Git state**: pushed. `origin/main` and `main` were level at `f691eb2` when
this was written, covering `5d103f4` (build), `ceb07b9` (QA findings) and this
doc's own updates. Verify with `git log origin/main..HEAD` run fresh rather
than trusting this line; this doc's push claims have drifted before.

### Where that leaves the project

**No build work is left on the frontier.** #2–#20 all have code, and the
frontier query (`blocked_by == 0`, unassigned) no longer discriminates —
every open issue passes it. What remains:

- **#34** (`ready-for-human`) — the 14 orphaned manual-QA items from #3, #7,
  #8 and #17, grouped by what a sitting needs.
- **#31** (`needs-triage`) — mobile still can't create a Plant without a tag
  to scan. The user rated this the most significant parity gap, and it is
  cheap: `PlantDetailScreen`'s form plus the shared `plantFormFields`.
- **#14** — QA'd and complete, held open by the user's own choice.
- Ten `needs-triage` issues (#21, #23, #24, #26–#30, #33, #35), none blocking.
  **Updated 2026-09-04:** #32 is now **CLOSED** — its fix had already landed
  in `28a093c` during #25's QA, and the user asked for it to be closed once
  that was verified. #31 has been relabelled `enhancement` + `ready-for-agent`,
  so it is out of the triage pile too (the bullet above still calls it
  `needs-triage`).

One small carried-over item: `apps/mobile/AGENTS.md` points at the Expo
**v57** docs while the app is pinned to **54.0.37** (the SDK 54 docs are the
right ones — see #13's entry for why the downgrade happened). The other one,
the `[POST-MVP]` tag convention, resolved itself — see the task-system entry
below.

---

## #25's last gap closed — QA run by the user, everything fixed

**This entry supersedes the whole of "Not yet resolved — blocks closing
#25".** That gap is gone. (It also superseded the old "What to do next",
which was rewritten on 2026-09-07 and no longer discusses #25 at all.)

**The freshly-created-Property gap is fixed and verified.** The user ran the
pass in a browser (their choice, not Playwright) on a **throwaway account** —
which matters: MVP allows one Property per account (`properties_one_per_user`),
and `properties -> beds -> plantings -> planting_photos` all cascade on delete,
so testing a *freshly created* Property on the real account would have destroyed
every Bed, Pin and dated photo in the real garden. Use a throwaway account for
anything that needs a new Property; it also makes the delete/recreate loop
repeatable.

**Root cause was a two-commit interaction, not #25 alone.** #5 gave
`PropertyPage` a standalone aerial thumbnail. #6's QA removed it as a
"duplicate" of `BedEditor`'s copy (`ffbc807`) — true only because
`PlantingMap`'s canvas still rendered unconditionally underneath at the time.
#25 then hid that canvas until a Bed exists, and the two together left a new
Property with no imagery at all. The user confirmed the gap on **all three**
base-map sources.

### What was built

- **`PropertyPage.tsx`** renders the base map itself when a Property has no
  Beds and the Bed editor is closed — the two conditions under which nothing
  else draws it. Uses the existing `BaseMapBackground`, so all three sources
  work. Capped with `maxWidth`/`aspectRatio` rather than fixed at
  `STAGE_SIZE_PX`.
- **`BedEditor.tsx`** gained `onOpenChange`, reporting `isDesktop && open`
  rather than raw `open`; `onBedsChange` is held until the Beds fetch settles
  so a caller can tell "no Beds yet" from "not known yet".
- A stale comment in `BedEditor` describing "the always-visible thumbnail
  above (in PropertyPage), CSS-capped to 512px" was fixed — that thumbnail had
  been deleted a session later.

### `/code-review` caught three real problems in the first cut

All fixed, each with a regression test confirmed failing without its fix: a
768px preview forcing horizontal scroll on a phone; a viewport flip stranding
`PropertyPage` believing the canvas was still up, **reproducing the exact bug
being fixed**; and a preview flash (nine ArcGIS tiles, then teardown) on every
Property that already had Beds.

### Three more findings from the user's pass, all fixed

1. **Two stacked maps while drawing.** With a Bed saved, `BedEditor`'s canvas
   and `PlantingMap`'s both rendered — one drawable, one not.
   **Pre-existing since #7/#8**, not a regression. `PlantingMap` now takes
   `hiddenWhileDrawing` and hides the whole section while the editor is open
   (hidden, never unmounted — #8's null-ref bug; hiding the section rather
   than just the canvas also preserves an in-progress "Add Planting").
2. **#32 fixed** (blank Bed name gave no visible error). Rather than only
   relocating the alert, this matches what `PlantingMap` already does for its
   own Save button (added during #14's device QA): a hint next to Save naming
   the requirement, Save disabled until a name exists, and save failures given
   their own `saveError` state rendered by the button. The top-of-section
   alert stays for load/remove failures, which must be visible with the panel
   closed — the reason it was up there originally.
3. **Phone-width page overflow.** `PlantingMap`'s canvas is a fixed 768px and
   dragged the whole page sideways. Contained with `overflow-x: auto` on a
   wrapper. **This is containment, not a responsive fix** — the stage is still
   768px. Tracked in #35.

### Filed: #35

**#35** (`needs-triage`) — **`/map` should be one canvas with a mode control**,
replacing the two stacked surfaces. Three separate visibility rules now decide
which of three components draws the base map; #35 collapses them and makes the
base map unconditional, which would delete the preview added above entirely.
Matches native's single-surface `MapScreen`. Also carries the responsive-stage
work from finding 3. **Splitting Beds and Plantings onto separate pages was
considered and rejected** — they share one base map and one coordinate space,
and it would diverge web from native.

### Status

- **#25 stays OPEN. #32 is CLOSED as of 2026-09-04** — the user asked for it
  once its fix was verified in `28a093c`; a summary comment naming the commit,
  the approach and its two regression tests is on the issue. Nothing is
  outstanding against #25 either, but closing it remains the user's call, per
  `CLAUDE.md`.
- **Test counts: domain 235, mobile 194, web 199.** Typecheck clean, no new
  lint warnings. Every new test was confirmed to fail without its fix.
- **One unexplained flake**: a single web-suite run failed one test that could
  not be reproduced across eight subsequent runs and could not be identified
  from the output. Recorded rather than dismissed — if a flaky test surfaces
  later, this is the first sighting.

---

## The task system is gone (2026-09-08), superseding the 2026-09-03 scope change

**Care task templates, task triggers, task completion logging and one-off
todos were removed from the app entirely** — application code and database
tables. Decided with the user through a `/grill-with-docs` session. **Read
`docs/adr/0005-remove-the-task-system.md` before acting on any of this**; it
carries the reasoning and this entry does not repeat it.

**This supersedes the 2026-09-03 scope change**, which took tasks out of the
MVP commitment while deliberately keeping the implementation live, and told
future sessions in three places not to delete it. **That retention rule is no
longer in force anywhere.** What changed: out-of-MVP was a scope judgement,
but the user is no longer interested in the feature and does not want to
spend time supporting it — and retention was not free (3,369 lines, 67 tests
and three `@plant-app/domain` modules in every run).

What landed, all in one commit so a single `git revert` restores the app:

- **32 files deleted** — `apps/web/src/tasks/`, `TasksPage`,
  `PlantingTaskHistoryPage`, `apps/mobile/src/tasks/`, `TasksScreen`,
  `PlantingTaskHistoryScreen`, their fixtures and fakes, and
  `packages/domain/src/{careTaskTemplate,taskCompletion,oneOffTodo}.ts`.
- **17 files stripped** — both dashboards' entry links, web's routes and
  providers (including `apps/mobile/App.tsx`, which sits outside
  `apps/mobile/src` and is easy to miss), mobile's navigator and route
  params, `PlantFormPage`'s Care task templates section, both
  `plantsRepository` implementations, and the domain export list.
- **`0024_drop_task_system.sql`** drops `task_completions`,
  `care_task_templates`, `one_off_todos` in FK order. **The rows were not
  exported** — offered and declined. Reverting the commit does not bring them
  back.
- **`CONTEXT.md`** — the four glossary entries collapse into one
  `Task system — removed` entry that keeps the vocabulary (particularly that
  a One-off todo sat *outside* the template system) without describing it as
  something the app does.
- **#1 (the spec)** — the `[POST-MVP]` convention is retired and replaced by
  a bare, reusable `[REMOVED]` tag on 12 items, with the date in the legend
  rather than in the tag. The **`post-mvp` GitHub label is untouched** and
  still correct: 12 non-task issues carry it, and it stays documented in
  `docs/agents/triage-labels.md`.
- **#21 closed as `wontfix`** at the user's explicit instruction — it asked
  for an affordance on a form that no longer exists. **#4, #12, #18 and #22
  stay closed and accurate** as history of work genuinely done.

Do not treat migrations `0003`/`0019`/`0021` creating tables that `0024`
drops as damage to repair, and do not restore this feature because it looks
half-removed. It isn't — it's fully removed, deliberately.

---

## What to do next

**The MVP has no unbuilt features, and the manual-QA backlog is empty.**
#34 tracked it and was closed 2026-09-07; #8's Bed-delete cascade, the last
item on it, passed. There is no open issue for QA — the checklists under
"Deferred QA by ticket" are the record. (One user-run sitting is agreed for
next session, on #40 and #31, and it is post-MVP: see "Next session starts
here" below.)

**One half-check is genuinely outstanding, and nothing tracks it.** #7's
item 4 asked for the aerial imagery *and* drawn Bed alignment at an address
the user cares about, rather than the Cambridge, MA test address. On
2026-09-07 the **imagery half passed** — a Property created at the real
address on a throwaway account, imagery good at that latitude and zoom.

The **alignment half passed too** (2026-09-07): Beds drawn on that imagery
land where the real beds are. Item 4 is fully settled, and #7 has no QA
left.

**But it surfaced a real usability gap, which is the thing worth carrying
forward.** Aerial tiles are Web Mercator, so the base map is always
north-up, while a house and its property lines usually sit at an angle to
north. Nothing in the app can rotate: not the base map, and not a drawn
shape — `rectangleToPoints`/`ovalToPoints` in `dragShapeGeometry.ts` are
axis-aligned by construction, and there is no rotation anywhere in the
codebase. So tracing a rectangular bed that's square to an angled house
means abandoning the rectangle tool for freehand or pen. The geometry is
correct; drawing it is awkward.

**Filed as #41** (`post-mvp`, user's call 2026-09-07) — rotate the view (one
angle on the Property, applied at render) rather than rotating shapes, so
stored outlines stay north-up and nothing migrates. Two traps are written into that ticket: don't widen the
tile grid via `GRID_RADIUS`, because `STAGE_SIZE_PX` derives from it and
every Scale Reference was calibrated against it; and un-rotate at capture
so the angle stays changeable afterwards.

The Larger Text pass (#17's item, plus #14's own item 16 — same phone, same
settings, one sitting) was run and **passed** 2026-09-07. The alignment risk
worth having worried about — `BloomTimelineScreen`'s fixed `AXIS_HEIGHT`
spacer drifting against the axis row and putting bars beside the wrong
plant's name — did not materialise.

Every open issue is labelled `post-mvp` except **#1**, the spec itself.
(**#42** was the one exception; it was fixed and closed 2026-09-09.)
**#43** was filed 2026-09-08 and
triaged the same day to `post-mvp` + `ready-for-agent` (the user's call):
as-you-type species
suggestions on the web Add Plant form, which offers no lookup at all today
while native has had one since #31.

**#36 is built** (2026-09-09) and live-verified — see its own section above.
It is **open and unQA'd**; closing it is the user's call. Its scope stayed
names and coverage only, as agreed: #44 proposed folding trait *accuracy* into
the same revisit and that was **not** taken — the trait-accuracy question
lives in **#46** (cross-check a second source), which is its own ticket rather
than a widening of #36.

**#43 is now unblocked** on the data side. The GitHub dependency (#43
`blocked_by` #36) still holds while #36 is open, but the thing it was waiting
for exists: `search_usda_plant_names` is callable directly by `authenticated`,
returns ranked matches in ~250 ms, and already caps and guards short queries.
#43 is a web-UI ticket now, not a data one.

**#50 was filed out of #36** — native status needs a state-level range rather
than USDA's coarse regions. The user's judgement, and the reason #36 shows no
native status at all.

**#41**'s deferral is a scope
decision, not a judgement that it's minor — for a property that isn't square
to north, the rectangle tool is effectively unusable until it lands. #40 no
longer carries its caveat: it was a live defect wearing a deferral label,
and it is now fixed.

## The dev-client QA sitting — RUN 2026-09-08, both checks passed

**Decided 2026-09-07 by the user:** they run a dev-client pass covering
**#31's** last item and **#40** together, in one sitting. **Approach settled
2026-09-08** (option 1 below, the user's call): two scientific names typed
into the manual Add Plant form.

**Run by the user on 2026-09-08. Both checks passed, no findings.**

- ***Psydrax odorata*** → panel offered `Mature height: 240"` and **nothing
  else**. No hardiness-zone sentence. #40's no-regression half confirmed
  against a live USDA response.
- ***Tsuga canadensis*** → `part sun` (unhyphenated — **#31's `formatOption`
  item passes**, and that was #31's last outstanding QA item), `Mature
  height: 1260"`, and the zone-3 sentence present. The zone line rendering
  here is what makes its absence on *Psydrax* meaningful rather than a panel
  that never shows zones.

**#31 now has no QA outstanding at all.** **#40's blank half remains
unrunnable** from live data and rides on its four unit tests, as decided
below. **#40 was closed on GitHub 2026-09-08 at the user's explicit
instruction** — per `CLAUDE.md` that instruction is the only thing that ever
closes an issue here; the finished QA was not itself authorization. The
close and its summary comment were issued as two separate commands, since
`gh issue close --comment` silently posts nothing on an already-closed
issue.

Two corrections to the walkthrough, worth keeping for whoever writes the
next one: the submit button on a new Plant reads **"Add Plant"**, not
"Save"; and the **"Look up species" button is not part of this flow** — it
resolves a *common name* to a scientific name, while the traits panel fires
from `handleSave` on the *scientific* name. Both cost the user a round trip.

**Two corrections to how this was previously written up**, both established
2026-09-08:

- **No Xcode rebuild is needed** *for code reasons*. The last
  native-affecting commit is `c6f9497` (2026-09-01, #14's Map screen), whose
  rebuild was already done and device-QA'd; nothing native has changed since.
  `formatOption` lives in `packages/domain` and Metro serves it. `npx expo
  start --dev-client` is the whole setup. **But see the signing-expiry note
  below — the build itself expires on a timer regardless of whether the code
  changed.**
- **No tag scan is needed either.** #31 moved
  `SuggestedTraitsConfirmation` into shared code, so the manual Add Plant
  form reaches the same panel: `PlantDetailScreen.handleSave` →
  `offerTraitsThenCreate` → `suggestSpeciesTraits`. The panel also has a
  **"Back to the form"** escape, so the whole pass writes **nothing** to the
  Registry.

### The agreed two-species pass

Expected values below were produced by running the real
`projectUsdaSpeciesTraits` over live USDA responses, not derived by hand.
Leave **Sun/shade and Mature height blank** on the form — `traitsNotAlreadySetBy`
strips any suggestion for a field the user has filled in.

1. ***Psydrax odorata*** (#40's no-regression half) → `{matureHeightInches: 240}`.
   Panel must show **only** `Mature height: 240"`. Any "survives to about
   zone N" line is a failure; zone 7 is #40's exact signature.
2. ***Tsuga canadensis*** (#31's item, plus a positive control) →
   `{sunRequirement: "part-sun", matureHeightInches: 1260, minimumHardinessZone: 3}`.
   `Sun/shade: part sun` unhyphenated is #31's check. The zone-3 line is the
   control: it proves the zone paragraph *does* render when USDA has data,
   so its absence on *Psydrax* is a real result rather than a dead panel.

### #40's check is probably not reproducible from live USDA data

Checked directly against the API on 2026-09-07, before proposing the pass.
**250 species sampled** (two disjoint strides across the full 2,186-entry
`characteristicSearchResults` catalog, ~11%):

- `Temperature, Minimum (°F)` present with a real value: **249**
- present but blank or null: **0**
- absent entirely: **1** (*Psydrax odorata*)
- blank/null values on **any** characteristic, across every row of all 250:
  **0**

So USDA appears to **omit** a characteristic it has no reading for rather
than return it blank — which is the case the code already handled correctly
via `Number(undefined) -> NaN`. No live species has been found that triggers
#40's defect.

**What that means, and doesn't.** The fix is still right: the blank branch is
a real, reachable code path (`Number("") === 0`), the ticket called it, and
the guard costs nothing. But it is **defensive hardening against a shape not
observed in this dataset**, not a fix for something a user is hitting today.
The four unit tests in `packages/domain` are its real coverage, and they are
the only place the blank case can be exercised at all.

Two options were put to the user, and **option 1 was chosen** on 2026-09-08:

1. **Cover the absent case instead**, which is live and free: look up
   *Psydrax odorata* (the one species in the sample with no temperature row)
   and confirm no hardiness zone is offered. This proves the no-regression
   half of #40's acceptance against real data, not the blank half. ← chosen.
2. **Stub the response** to drive the blank case honestly — temporarily have
   `usda-plant-traits` return a `Temperature, Minimum (°F)` row with `""`.
   That is testing the stub as much as the app, which is why it wasn't done
   unasked. Note this could not be done locally regardless: with no local
   Supabase stack it would mean deploying a stub to the real project and
   reverting.

So the blank half rides on its four unit tests in `packages/domain`, which
is a reasonable call given the sampling, not a gap.

### What preparing this sitting turned up: #44 — since fixed, see below

Hunting for a species that would render "full shade" for check 2 surfaced
**#44** — USDA's `Shade Tolerance` is unreliable and close to inverted
(prickly pear and coconut palm come back `"High"` → `full shade`; hemlock,
beech and sugar maple come back `"Low"` → `part sun`). Unlike the
reference-only hardiness zone, a suggested `sunRequirement` **is persisted**
via `applySuggestedTraits`, so it is the more damaging of the two defects.
The user confirmed the botanical read before it was filed. Labelled
`post-mvp` only, at their instruction — no `bug`, no triage label.

This is also why check 2 uses *Tsuga canadensis* (`"Low"` → `part sun`)
rather than a "full shade" species: any unhyphenated value proves
`formatOption`, and every `"High"` candidate was botanically absurd.

### The dev build expires every 7 days — budget for it

Hit on 2026-09-09, mid-QA. The app wouldn't launch at all: tapping the icon
gave *"Mobile is no longer available"*. Nothing to do with any code change —
this is a **local Xcode build signed with a free Apple account, and those
expire 7 days after install**. It had been installed 2026-09-01, eight days
earlier.

**Assume any device QA more than a week after the last install starts with a
reinstall**, and say so when proposing a sitting rather than discovering it
with the user sitting there. The fix is a rebuild from Xcode: open
`apps/mobile/ios/mobile.xcworkspace` (**not** the `.xcodeproj` — CocoaPods),
pick the phone in the device dropdown, press Run, then trust the developer
under Settings → General → VPN & Device Management if prompted.

Expo Go is not an escape hatch: `apps/mobile/modules/tag-ocr` is a custom
native module, so the dev client is the only surface that runs this app.

A paid Apple Developer account would stretch the 7 days to a year. Not
proposed — worth it only if device sittings become frequent.

## After both QA passes — later the same session

Written after both entries above. Each item here invalidates something stated
elsewhere in this doc — check it before trusting an older claim.

**Everything is pushed.** `origin/main` and `main` are level as of `ce789cd`.
Every "push has not been requested" / "remains unpushed" line further down is
historical — they were true when written and are not any more. 17 commits went
up in one go, covering #18's fixes, #14's Map screen and QA fixes, and #25's
gating and QA fixes.

**#18 is CLOSED — by the user, on 2026-09-02.** This matters because two
places further down still carry the old standing instruction ("#18 stays open
on GitHub — do not close it without the user asking again"). **That instruction
is spent; do not act on it, and do not reopen #18.** The likeliest reason it
was being held has also been resolved: the HEIC photo fix, recorded for weeks
as never independently verified, was confirmed working on web by the user.

**The QA orphaned by earlier closures is now tracked in #34.** #3, #7, #8 and
#17 were each closed while manual QA against them was still unrun — 14 items in
total, confirmed by the user as genuinely still outstanding rather than
abandoned. Those four tickets **stay closed** by the user's choice; #34
(`ready-for-human`) collects the remaining work and groups it by what a sitting
actually needs — a WebKit pass, a real mouse, a phone with Larger Text on, and
a few quick browser checks. #3's cross-account URL check is excluded: it passed
on 2026-09-02, and was the only item across those lists with an access-control
failure mode.

**Never close an issue in this repo without the user explicitly asking.** Now
recorded in `CLAUDE.md` under "Closing issues". It supersedes the earlier
practice visible throughout this doc, where tickets closed as a matter of
course once QA passed (#6, #9, #10, #11, #12, #16, #17, #20) — those entries
are history, not precedent. #14 is open under this rule with its QA complete
and nothing outstanding against it. #25 is open for a stronger reason as well
— the unresolved freshly-created-Property gap named at the top of this doc.

**Open and waiting**: #14, #25 (both QA'd, held open deliberately), #34
(`ready-for-human`), and #28–#33 (`needs-triage`, filed across the two passes).
**Frontier build work**: #15 is the last unbuilt ticket under the spec; #31
(no manual Plant creation on mobile) is the parity gap the user rated most
significant.

---

**Previous entry, superseded above** — **#14's device QA run to completion by the user — 15 of 16 items pass, eight findings fixed and committed.**

**#14's device QA is DONE.** The user ran the full 16-item checklist on a real
iPhone. 15 items pass, three are recorded untested with reasons, and the eight
findings it produced are fixed, tested and committed (`a8fc23e`, `d7d558f`,
`25340f3`). Full write-up immediately below.

**#14 STAYS OPEN on GitHub — the user asked for this explicitly, on 2026-09-01,
after its QA passed.** They built up to it, took a break, and always intended
to come back to it themselves; a passing QA does not settle that. Do not close
it, do not relabel it as done, and do not treat "everything on the checklist
passed" as authorization.

**New standing rule, set the same day and now recorded in `CLAUDE.md`: never
close *any* issue in this repo without the user explicitly asking.** This
replaces the earlier practice visible further down this doc, where tickets were
closed as a matter of course once their QA passed (#6, #9, #10, #11, #12, #16,
#17, #20). Those entries are history, not precedent — don't cite them. If
something looks finished and closable, say so and ask.

**#25's browser QA remains unrun** — its checklist is further down and is
**not** superseded. It also picked up a real finding during #14's pass without
being formally started: see "#25 already has a finding" below.

**Four issues were filed during the pass**: #28, #29, #30, #31 — all
`needs-triage`, none blocking. #31 (no manual Plant creation on mobile) is the
one the user judged most significant.

---

## #14: device QA complete, eight findings fixed

**Run by the user on a real iPhone**, not Playwright — this is a native screen,
no browser involved.

### Getting it to run at all cost real time — read this before the next rebuild

The previous entry's rebuild recipe (`npx expo prebuild --platform ios`, then
Xcode) was **not sufficient, and failed silently**. `prebuild` found an
existing `ios/` directory, printed `reusing /ios`, **skipped CocoaPods
entirely**, and exited cleanly having changed nothing that mattered.
`ios/Podfile.lock` stayed three days stale and contained neither
`react-native-svg` nor `expo-image-manipulator`, so Xcode built a fresh binary
of the wrong thing and the app died on launch with "Cannot find native module
'ExpoImageManipulator'".

**The reliable check is whether `ios/Podfile.lock` actually names the module you
just added** — not whether `prebuild` exited cleanly. Fixed with an explicit
`pod install`. `npx expo run:ios` does prebuild + pods + build + install as one
step and is what CocoaPods itself now recommends; the tradeoff is a terminal
build rather than Xcode's GUI.

Also worth knowing: Metro had been running for **3.5 days across 22 commits**,
including all three changes to `apps/mobile/package.json`. It didn't turn out
to be the cause of anything, but `npx expo start --dev-client --clear` is the
first thing to try on any inexplicable staleness.

### The eight findings, all fixed and committed

1. **"Add Planting" rendered over 100px tall.** `styles.button` carried
   `flex: 1` — correct inside the form's row, but stretching *vertically* as a
   direct child of the screen's own column. Moved to a `formActionButton`
   style. It would also have shrunk below its own padding once the Plantings
   list overflowed.
2. **The page scrolled during a Pin drag.**
   `onShouldBlockNativeResponder` is **Android-only** — RN's own source says so
   at `PanResponder.js:107` — so the protection the code's comment claimed was
   a no-op on iOS, where `UIScrollView` runs its own pan recogniser in
   parallel. Fixed by suspending the ScrollView (`scrollEnabled={!dragging}`)
   for the duration of a drag.
3. **A near-miss on the marker scrolled the page** rather than merely failing
   to grab it — a much worse outcome than a missed tap. Grab radius 44pt → 64pt.
4. **A fingertip covers the marker it is dragging.** A crosshair now marks the
   Pin's real position, visible only mid-drag.
5. **Save was disabled with no reason given** when no Plant had been chosen —
   the only status line on screen talked about the Pin, so a placed Pin plus no
   Plant showed an encouraging "Pin is in X." above a dead grey button. **Web
   had the identical gap and was worse** (its message goes null once the Pin
   lands, so there was no message at all); fixed on both surfaces.
6. **Overlapping Pins resolved by draw order** — arbitrary and invisible. A tap
   landing on more than one now opens a bottom sheet chooser, with a ring drawn
   on the map around the Pins it means.
7. **Rows in that chooser read identically** for Plantings of the same Plant.
   They now carry year, nursery, and **always the added time to the minute** —
   a group planted in one sitting shares everything else, and the date alone
   still left three identical rows. Note **position cannot help here**: those
   Pins are in the chooser precisely because they overlap, so an earlier
   suggestion to move the ring per row was wrong and was withdrawn.
8. **The chooser's backdrop flew up as a hard-edged box**, because `Modal`'s
   own `animationType="slide"` moves the entire modal, backdrop included. It
   fades now; only the sheet travels.

**Beyond #14's scope, fixed in the same pass** (`a8fc23e`): only the two auth
screens had keyboard avoidance, so the same bug behind finding 5's neighbour
was waiting on `PlantDetailScreen`, `PlantingDetailScreen`, `TasksScreen`,
`PlantingTaskHistoryScreen` and `TagScanReviewScreen`. Extracted into
`components/KeyboardAwareScrollView.tsx`. **Its ref must forward to the inner
ScrollView** — `PlantDetailScreen` scrolls itself to the top on a failed Save
(an #18 QA finding), and swallowing the ref undoes that with every test still
green. This is likely the un-root-caused "keyboard closes with difficulty"
item from #18's QA.

### Recorded untested — deliberate, with reasons

- **Item 10, the drawn base map.** Needs a Property that uses one; base-map
  source can't be changed once a Property has a scale, so it needs its own
  throwaway account. It's a line-thickness aesthetic check — judged not worth
  a second account.
- **Item 15b, the "no scale" empty state.** **Effectively unreachable by
  design**: `BaseMapSetup` keeps everything in local state until "Save Scale
  Reference" persists it in one call, specifically so a Property never sits
  half-configured. Only an aerial address with no coverage at zoom 18–21 could
  produce it, which ArcGIS makes rare.
- **Item 16, larger text sizes.** Deferred by the user to a dedicated pass
  across multiple screens, which also covers #17's outstanding item.

### Filed during the pass

- **#28** — nothing anywhere indicates whether a Property's base map has a
  calibrated scale, and there's no way to recalibrate one that already has a
  (possibly wrong) scale.
- **#29** — PropertyPage claims "No aerial imagery is available" for *any*
  uncalibrated Property, whatever its base-map source. Stale copy from before
  #6 made base-map source an up-front choice.
- **#30** — no way to see the aerial imagery *before* creating a Property from
  an address. Buildable entirely client-side; the write-up has the details.
- **#31** — **mobile cannot create a Plant manually at all.** Tag Scan is the
  only path and it requires a tag photo, so an untagged plant can't be added
  from the phone. ADR-0003 puts everything except drawing at full parity, so
  this is a gap rather than a scoping call — it fell between #16 (Registry as
  a view) and #18 (detail as view/edit). Cheap to build: `PlantDetailScreen`'s
  form plus the already-shared `plantFormFields` helpers.

**Declined by the user, deliberately not filed**: that a Pin can't be
repositioned after saving. Worth knowing the cost if it resurfaces —
`planting_photos.planting_id` is `on delete cascade`, so remove-and-recreate
destroys a Planting's entire dated photo history to fix a Pin that's a foot
off.

### #25 already has a finding, before its own QA has started

The user hit it twice, from two different base-map sources: **a freshly created
Property shows no imagery at all until "Draw a Bed" is clicked.** `PlantingMap`
hides its canvas while `beds.length === 0` (#25's change), and `BedEditor` only
renders its base map once its drawing panel is open — so nothing shows the
imagery in between. Before #25, `PlantingMap`'s unconditional canvas was what
confirmed your address had resolved correctly.

This is every gardener's first experience of the app. **Suggested fix, raised
and not yet agreed**: render the base map in `BedEditor`'s closed state. Small,
and it undoes nothing #25 set out to do. Left for whoever runs #25's pass.

**Full monorepo green**: 235 domain + 194 mobile + 186 web, typecheck clean
across both app workspaces.

**Git state**: `a8fc23e`, `d7d558f`, `25340f3` on `main`. `origin/main` is now
**12 commits behind** `HEAD` — nothing has been pushed for several sessions;
push has still not been requested.

---

## #25: hide the Plantings map canvas until a Bed exists

**Implemented, code-reviewed, committed (`a96caee`), NOT closed on GitHub, NOT yet QA'd in a browser.** Same posture as every prior ticket here: real, tested code held open pending the user's own manual pass. The issue also still carries its original `needs-triage` label — implementing it settled the direction in conversation, not on GitHub, so relabel or close only when the user asks.

### What changed, in one paragraph

On `/map`, `PlantingMap` used to render its full 768x768 canvas and its own copy of the base map unconditionally, so a gardener with no Beds saw a big, fully-rendered, non-functional map sitting above "Draw a Bed first before adding Plantings." Now the map area is hidden with `display: none` while `beds.length === 0`, and `<BaseMapBackground>` is skipped outright in that state. The two are treated differently on purpose: the ref'd container **must** stay mounted (#8's bug — the Konva stage-mount effect only depends on `pixelsPerFootValue`, so it runs once, and a null `containerRef.current` on that single run means no Pin ever resolves into a Bed again), whereas nothing holds a ref into `BaseMapBackground`, so skipping it is safe and avoids fetching nine ArcGIS tiles — a `display: none` ancestor does **not** stop an `<img>` loading — or round-tripping Supabase for a photographed plot plan's signed URL. The "Plantings" heading and the prompt both stay.

### What to QA (nothing below has been run)

Run against the dev server (`npm run dev`, web workspace) and the real linked Supabase project. Items 2 and 4 are the ones that actually matter; the rest are confirmation.

**The empty state — the thing the ticket is about:**
1. On a Property with **no Beds drawn**, open `/map`. Expect the "Beds" section, then the "Plantings" heading and "Draw a Bed first before adding Plantings." — and **no map canvas at all**. Specifically check there's no leftover blank/grey box, no 768px gap, and no scroll space where the canvas used to be. (The div is still in the DOM, hidden — `display: none` should collapse it completely, but that's the thing to eyeball.)

2. **⚠️ Draw your first Bed without reloading the page — the highest-risk item.** With no Beds, click "Draw a Bed", draw one, save it. Then, *without reloading*:
   - Does the Plantings map appear immediately, with the base map behind it?
   - Does the new Bed's outline draw on it, in the right place?
   - Click "Add Planting", drag the red pin into that Bed. **Does it resolve** — "Drop the pin inside a Bed." goes away and Save enables?
   - Save it. Does its Pin appear on the map?

   This exact path is what #8's null-ref bug broke, and it's the one thing the hidden-not-unmounted design exists to protect. If the pin never resolves no matter where you drop it, that's the bug back, and it's a real regression, not a cosmetic one.

3. **All three base-map sources.** The gating is source-agnostic in code, but they fail differently: aerial is 9 network tiles, a photographed plot plan needs a signed URL from Supabase, a drawn plan is inline SVG with no network at all. For each source you have a Property for: nothing renders with no Beds; the right backdrop appears once a Bed exists.

4. **⚠️ The load-order flash — new, a genuine trade this fix makes, and the thing most worth your eyes.** On a Property that **does** have Beds, reload `/map` and watch the first second. The base map now waits for the Beds list to arrive before it starts loading, so it appears roughly one round-trip later than it used to, and "Draw a Bed first before adding Plantings." may flash briefly before the canvas replaces it. Code review raised this; it's inherent to "skip the base map while `beds.length === 0`" as the issue scoped it, since on first paint an empty list and a not-yet-loaded list look identical. **If it looks bad, it's fixable** — distinguishing "no Beds" from "Beds not loaded yet" needs one more piece of state, which is a small, clean change but genuinely more than #25 asked for. Worth a decision either way.

**Regression checks on the normal path (a Property that already has Beds):**
5. Reload `/map`: map renders as before, existing Pins in the right places, tapping a Pin opens that Planting's details.
6. The Registry's "View on the map" link (`/map?plantingId=…`) still lands on the right Planting.

**Environment coverage:**
7. **Phone width / a narrow window.** Bed drawing is desktop-only, so a phone gardener with no Beds now sees no imagery anywhere on `/map`. Check that reads as deliberate rather than broken — it's arguably more correct than the old behaviour (a map they could do nothing with), but it's a real change in what a phone shows.
8. **Safari/WebKit.** `display: none` isn't exotic, so this is low-risk, but this repo has real history of WebKit-only bugs slipping past desktop Chromium (#5's dropdown). One pass.

**Optional, if you want the proof rather than the appearance:**
9. DevTools → Network, filter to `arcgisonline`. On a no-Beds Property: **zero** tile requests while just viewing `/map`. Click "Draw a Bed" and the Bed editor requests its own 9 — that's correct, it needs something to draw on. Before this change you'd have seen 9 fired on load with nothing to use them for.

### Already covered by automated tests — no need to re-check by hand

The surface staying mounted-but-hidden with no Beds, no `<img>` rendering in that state, the surface plus its 9 tiles appearing once a Bed exists, and the heading and prompt surviving. `apps/web/src/plantings/PlantingMap.test.tsx`, describe block "PlantingMap — the map surface before any Bed exists (#25)". What tests can't cover is everything above involving real Konva dragging, real network timing, or how it actually looks — jsdom stubs Konva entirely.

### Decisions taken this session, so they don't get relitigated

- **Web only, deliberately.** `apps/mobile/src/property/MapScreen.tsx` has the identical shape — it renders its map surface and `NativeBaseMap` unconditionally, then shows "No Beds drawn yet — Beds are drawn on the desktop app." underneath. It was left alone: #25 names `PlantingMap.tsx` specifically, native's surface is declarative SVG with no Konva ref lifecycle (so it's a simpler, different fix), and #14's own device QA hasn't run yet, so that screen's empty state is still unverified ground. **This has not been filed as its own issue yet** — worth doing, and it wasn't done here because filing it wasn't asked for.
- **The heading stays.** With no Beds the section shows "Plantings" + the prompt, not a bare floating sentence. The issue's text listed the heading among what renders unconditionally, so the other reading was defensible; this was the user's call.

### What `/code-review` caught, fixed before the commit

One real thing, in the **existing** suite rather than the new code: `PropertyPage.test.tsx`'s "renders the base map imagery behind the Bed editor for an available property" was **passing for the wrong reason**. It asserted on `document.querySelectorAll('img')` immediately after render, but `BedEditor` only renders its base map once its drawing panel is open (`open` state, after clicking "Draw a Bed") — so the tiles it found were `PlantingMap`'s unconditional copy, i.e. the very thing #25 removes. The test named for the Bed editor was never testing the Bed editor. Now it asserts zero imagery before opening the panel, clicks "Draw a Bed", and *then* checks the tiles — so it genuinely tests its own name. This is the second time in this repo a test has locked in behaviour its name disclaimed (see #14's ADR mis-citation test); worth a glance whenever a test starts failing for a change that "shouldn't" affect it.

Three smaller review notes also applied: the tile count now derives from `GRID_RADIUS` rather than a hardcoded `9`, the new tests use `document.querySelectorAll` matching the repo's existing idiom instead of introducing a second one, and the duplicated explanation of #8's stage-mount bug in the test was cut to a pointer at the component's own comment, so the two can't drift.

**Full monorepo green**: 235 domain + 183 mobile + 186 web (web +3 from this ticket), typecheck clean across all three workspaces, web lint unchanged at 11 warnings — all pre-existing, verified against a stashed baseline rather than assumed.

**Git state**: committed to `main` as `a96caee`. `origin/main` is now **9 commits behind** `HEAD` — nothing has been pushed for several sessions; push has not been requested.

---

**Previous entry, superseded — #14's device QA has since been run to completion; see the top of this doc. Kept for what it records about how the screen was built.** The rebuild instructions immediately below are the ones that turned out to be insufficient — see "Getting it to run at all" at the top before following them.

**#14 (Native: Map view — view Beds, place/view Pins) is implemented, code-reviewed and committed (`c6f9497`), but NOT closed on GitHub and NOT yet QA'd on a device.** The user went on a break at exactly this point and asked for the QA list below. Same posture as every prior ticket here: real, tested code held open pending their own manual pass.

### ⚠️ A rebuild is required before the Map screen will run at all

`react-native-svg` (15.12.1, the Expo SDK 54-pinned version, added via `npx expo install`) is a **native** module. The custom Tag Scan dev client will not have it until it is rebuilt — a plain Metro reload is not enough, and the Map screen will crash or render nothing without it. Same dance as the `expo-image-manipulator` fix from the previous session:

```
cd apps/mobile
npx expo prebuild --platform ios
open ios/mobile.xcworkspace
```

Then in Xcode: choose the iPhone in the device dropdown along the top, press the ▶ Play button, and let it reinstall the dev client. (The user is an Xcode novice — walk through the GUI steps explicitly, don't assume.)

### What to QA (nothing below has been run on a device)

Everything here has only been exercised through Jest/RNTL, which mocks every Supabase-shaped repository client and renders `react-native-svg` as inert host components — no real rendering, no real touch, no real network. Reach the screen via the Dashboard's **Map** tile.

**The drag interaction — the highest-risk item, and the reason a real device matters.** The pin marker is a plain RN `PanResponder`, and the map sits inside a `ScrollView`:
1. Does dragging the new-Planting pin actually track your fingertip, or does it lag/jump? The drag converts screen pixels back through the map's shrink-to-fit scale (`mapSurface.ts`) — if that conversion is wrong it will feel subtly slow or fast, not obviously broken.
2. **Does a downward drag move the pin, or does the ScrollView steal it and scroll the page instead?** `onPanResponderTerminationRequest: () => false` is supposed to prevent exactly this. Untested against a real scroll gesture.
3. Is the marker grabbable? Its touch target is 44px (deliberately larger than the 22px dot drawn inside it — a `/code-review` finding), but that's an untested guess at fingertip size.
4. Fling the pin hard past the edge of the map: it should park on the border, not vanish (`draggedStagePoint` clamps to the surface — a deliberate divergence from web, where Konva lets the marker drag off-stage freely).

**Pin placement correctness:**
5. Drop a pin inside a Bed — does the form say "Pin is in <Bed name>."? Drop it on bare map — does it say "Drag the pin onto a Bed to place this Planting." and keep Save disabled?
6. Save a Planting and check on **web** that its Pin lands in the same real-world spot. This is the cross-surface claim the whole ticket rests on, and it's the one thing no test can prove.
7. Near a Bed's edge, especially a **smoothed freehand** Bed: the pin should resolve against the rounded outline you can see, not the raw trace. Test right at a rounded corner.

**Rendering, per base-map source.** The user's own Property is the only realistic test of these — the tests use synthetic 2px/ft scales:
8. **Aerial**: do all 9 tiles load over the network and line up as one continuous image, with no seams or gaps? Tile size is `size / 3`, which can land on a fractional pixel.
9. **Photo** (photographed plot plan): does it appear at all? It needs a signed URL from the new mobile `getBaseMapPhotoUrl` against the `property-base-map-photos` bucket — **the RLS path for that bucket has never been exercised from the phone before**, so a permissions failure is plausible and would show as a silently blank backdrop.
10. **Drawn**: are the traced lines thick enough to see? Their width is divided back out of the shrink-to-fit scale so they stay ~2 device px, but that was reasoned about, not looked at.
11. Do Bed outlines sit correctly over the base map, at the right size and place?

**The rest:**
12. Tap a Pin → does the right Planting open? Pins close together are the interesting case (36px hit circles can overlap).
13. Tap a row in the Plantings list below the map → same destination.
14. Remove a Planting from its detail screen, come back: is its Pin gone from the map? (`useFocusEffect` is what makes this work — the same staleness bug #18's QA found in Registry.)
15. Empty states, if reachable: no Beds drawn yet; a Property with no scale.
16. Larger text sizes — same accessibility check that is still outstanding for #17.

### Known gaps, deliberate — not QA findings

- **A screen reader cannot place a Pin.** Dragging is the only way to move the marker, and VoiceOver can't drive a drag. Web's Konva marker has the identical gap, so this is parity, not a regression — but it is a real accessibility hole in both surfaces, worth its own ticket if it matters.
- **The Registry's Planting links still go to the Planting detail screen, not the Map**, unlike web's `?plantingId=` deep link. The mobile Map has no equivalent "jump to this Pin" parameter. Not in #14's acceptance criteria; left as a deliberate call, since on a phone the detail screen is where everything about that Planting already is.
- **Pan/zoom is absent**, as on web. The whole map is scaled to fit the phone's width instead (~0.45x on a typical phone), so fine detail is genuinely smaller than on desktop. If that turns out to be unusable in the garden, it's a new ticket, not a bug in this one.

### What was built (commit `c6f9497`)

New on mobile, under `apps/mobile/src/property/`: `MapScreen.tsx` (the map surface, the drag-to-place flow, and a plain Plantings list — a dot is a poor tap target, and SVG shapes take no `accessibilityRole`, so the list doubles as the only screen-reader route to a Planting), `NativeBaseMap.tsx` (backdrop for all three base-map sources), and `mapSurface.ts` (fitting the fixed base-map square onto a phone, and converting a finger's drag back through that scale — the pure seam, unit-tested). Plus `PlantingsRepository.create` and `PropertiesRepository.getBaseMapPhotoUrl` on mobile, a `Map` route, and the Dashboard's Map tile wired up (its tile cascade collapsed to a `TILE_ROUTES` lookup).

**Promoted into `packages/domain`**, now that both surfaces render the same map: `STAGE_SIZE_PX`/`GRID_RADIUS`/`TILE_SIZE_PX`/`baseMapTiles`/`svgPointsAttribute` (from web's now-deleted `baseMapTiles.ts` and `baseMapDrawing.ts`), `renderedOutlinePoints` and a new `renderedBedOutlines` (both in `bed.ts`), and `resolvePinDrop` (`planting.ts`). Two copies of the stage size would be a silent correctness bug, not mere duplication — a Scale Reference calibrated against one stage size and rendered against another is off by exactly the ratio between them. **Web's `PlantingMap` now resolves a dropped Pin through that shared rule instead of its own copy**; web behaviour is unchanged and its full suite confirms it.

**`/code-review` caught three real things before this landed**, all fixed in the commit:
1. **An ADR was cited wrongly, and the UI copy followed it.** The empty states said base map and Scale Reference were "desktop-only by design (ADR-0001)". ADR-0003 says the opposite — *"Scale Reference calibration is **not** bundled with 'drawing' … It ships at full parity"* — and ADR-0001 is about Konva bed outlines, not base-map setup. Only **drawing** is desktop-only. Copy now says these aren't in the phone app *yet* (they're #15), and a test that had locked the mistake in (asserting the strings "base map"/"scale reference" never render) was narrowed to actual drawing tools.
2. **A Beds-fetch failure was reported as "you have no Property"** — both loads shared one `.catch`. Now independent: the map still draws and only the Beds error shows. Regression test added.
3. **The drag marker had a smaller touch target (22px) than the Pins you merely tap (36px)** — backwards, since grabbing it is the entire interaction. Now 44px with the dot still drawn at 22px.

**Full monorepo green**: 235 domain + 183 mobile + 183 web, typecheck clean across all three workspaces, web lint unchanged (warnings only, all pre-existing).

**Git state**: committed to `main` as `c6f9497`. `origin/main` is now **6 commits behind** `HEAD` — nothing has been pushed this session or the last; push has not been requested.

**#14's closure won't unblock anything new** — #15 (Native: Scale Reference calibration) is already frontier and independent of it.

**Still true from the previous entry: #18 also stays open on GitHub — do not close it without the user asking again**, even though every known finding against it is fixed and committed.

---

**Previous entry, superseded above** — **The HEIC photo fix described below is now committed (`0b5d141`) — the user asked to commit it but explicitly asked NOT to close #18.** Everything else from #18's QA (see "Previous entry, superseded above") was already committed (`e0ca214`, `f1b0664`). **#18 stays open on GitHub — do not close it without the user asking again**, even though every known finding against it is now fixed and committed.

**The bug**: a reference photo uploaded from the phone showed as a broken image on web — no intrinsic height, stayed broken even with a height hardcoded in the inspector. The signed URL the user pasted in ended in `...IMG_4538.heic`. Root cause: iOS's camera captures in HEIC by default (unless the device's Camera Format setting is "Most Compatible"), `expo-image-picker` hands that format straight back, and the app's `pickPhoto()` helper uploaded it as-is. Chrome/Firefox/Edge cannot decode HEIC in an `<img>` tag at all (only Safari has partial support), so any photo captured this way was silently broken on web from the moment it was uploaded — this affects **both** Plant reference photos and a Planting's dated photo log, since both go through the same shared `pickPhoto()` helper.

**Fix (commit `0b5d141`)**: added `expo-image-manipulator` (`apps/mobile/package.json`/`package-lock.json`) and updated `apps/mobile/src/lib/pickPhoto.ts` so every picked photo — camera or library, whatever format the OS hands back — is re-encoded to JPEG via `ImageManipulator.manipulate(uri).renderAsync().saveAsync({format: SaveFormat.JPEG})` before the caller ever sees its `uri`. Verified against Expo SDK 54's actual current docs (fetched live, not assumed) that this non-hook `manipulate()` API — not the newer `useImageManipulator` React hook, which only works inside component render — is the right one for a plain utility function. Updated `pickPhoto.test.ts` (now asserts a HEIC-named asset comes back as `.jpg`) and added a pass-through `expo-image-manipulator` mock to `PlantDetailScreen.test.tsx`/`PlantingDetailScreen.test.tsx`, since `jest-expo` has no built-in mock for this module's new context-based API. Full suite green: mobile typecheck clean, 154/154 mobile tests passing.

**CONFIRMED WORKING by the user on 2026-09-01** — photos taken on the phone now render correctly on web. This supersedes the caveat that stood here until then (the commit had gone in on the user's direct instruction, "Commit them all", rather than after an explicit confirmation, so it was recorded as unverified). **Don't re-raise it.** It was also the most plausible reason #18 was being held open; #18 has since been closed by the user (2026-09-02).

Two things still worth keeping in mind if this comes up again:
1. **This does NOT retroactively fix any already-broken photo** — a HEIC file already sitting in storage from before this fix stays broken forever; that's expected, not a new bug, and not a failure of the fix. Removing and re-adding it is the only way to repair an existing one. A broken image on an older Plant is a pre-existing file, not a regression.
2. **A rebuild may have been needed** to pick this up — a new native module was added, so the custom Tag Scan dev client specifically would need `npx expo prebuild` + a Xcode reinstall, not just a reload. Expo Go picks it up on a plain reload.

**Git state**: `origin/main` is 5 commits behind `HEAD` (`0f2c1ad`, `e0ca214`, `f1b0664`, `01045da`, `0b5d141`) — none pushed yet this session; push wasn't requested.

---

**Previous entry, superseded above** — **#18 (Native: Plant/Planting detail, tasks & todos) has now been manually QA'd by the user directly on a real device, every finding from that pass is fixed, and the full monorepo suite is green — not yet closed on GitHub, that's the next action.** See "Previous entry, superseded above" below for what was originally built; this entry covers the QA round on top of it.

**Real QA findings, all fixed (commit `e0ca214`)**:
- **Registry's Plant/Beds/Plantings lists went stale after editing a Plant and tapping "Back to Registry"** — the change only showed up after a full app reload. Root cause: React Navigation's native stack keeps `RegistryScreen` mounted in the background while `PlantDetailScreen`/`PlantingDetailScreen` are pushed on top of it, so Registry's mount-only `useEffect` fetches never re-ran on the way back. Fixed by switching those fetches to `useFocusEffect`, which re-runs every time the screen regains focus — this also fixes the identical latent staleness a removed/edited Planting would have caused in Registry's location links, not just the Plant-edit case actually reported.
- **A failed Save on `PlantDetailScreen` gave no visible feedback when the invalid field was scrolled out of view** — tapping Save silently did nothing from the user's vantage point. Fixed with a summary error message near the Save button plus scrolling back to the top so the actual inline field error becomes visible.
- **No loading indicator while a reference photo uploads** — the "Take photo"/"Choose from library"/"Remove" controls now show "Uploading…"/"Removing…" while busy, tracking which specific action is in flight rather than a single shared busy flag.
- **Reference photos section read oddly appearing below the Save changes button** — moved above it. (Photos still save immediately on add/remove, independent of Save — only the display order changed.)
- **Bloom window month/day fields accepted more than 2 digits**, though a month (1–12) or day (1–31) never needs a 3rd. Capped at `maxLength={2}`.
- **The one-off todo list used a `Switch` (on/off toggle) to mark a todo done** — semantically wrong for "check this off a list" and inconsistent with web's `<input type="checkbox">`. Replaced with a small checkbox-style `Pressable` (RN has no built-in checkbox; not worth a new dependency for one).
- **`PlantingTaskHistoryScreen`'s Mark done/Mark missed buttons looked identical regardless of which was active** — only a plain text status line above them changed. The matching button now gets a filled/active look, so the buttons themselves confirm the current state, not just the text.
- **Registry showed a Plant's raw `commonName — scientificName` as its headline, while every other screen (Tasks, task history) used the shared `plantLabel()` helper (`commonName (cultivar)`)** — inconsistent, and actively confusing when `scientificName` happens to duplicate `commonName` (the user's real example: Registry showed "Agastache — Agastache" while Tasks showed "Agastache (Blue Fortune)" for the same Plant, with no visible way to tell they were the same record). Fixed on **both mobile and web** — `PlantsPage.tsx`'s Registry had the identical bug, found and fixed in the same pass even though this ticket is mobile-only, since it was the same one-line root cause fully verified by web's own existing suite.

**Two items raised during QA, discussed, not turned into fixes — worth revisiting if they come up again**:
1. **Keyboard dismiss on numeric fields (bloom month/day, mature height/spread, the task-history Year field) reportedly closes "with some difficulty."** Investigated: these use iOS's `number-pad` keyboard, which has no built-in "Done" button, so tapping outside the field is the only dismiss path, relying on `ScrollView`'s default `keyboardShouldPersistTaps: 'never'` behavior (not overridden anywhere in these screens). Root cause wasn't pinned down further — the user said "it's ok" and moved on without a concrete fix being made. If this resurfaces, likely candidates are: tap targets between fields being too small/close together, or adding an `inputAccessoryView` "Done" bar to the numeric fields.
2. **`PlantingDetailScreen`'s "Photo date" label may not clearly read as "the date for the photo you're about to add"** rather than a property of existing photos. Offered to rename it to something like "Date for next photo"; the user never confirmed or declined before QA moved to other topics. Left as "Photo date" — revisit if it comes up again.

**Also fixed reactively during this QA pass, not itself a QA finding**: `apps/web/src/routes/PlantsPage.tsx` had the identical `plantLabel()` inconsistency described above — the user asked for it to be fixed too once flagged, so it's included in the same commit, verified by web's full automated suite (not by the user's own manual web QA, since this QA pass was mobile-only).

Full monorepo suite green throughout this round: 215 domain + 154 mobile + 183 web.

**Still needed before #18 can close**: nothing code-wise — QA is complete and passed. The only remaining step is actually closing the issue on GitHub with a summary comment, which wasn't done as part of this update (the user asked specifically for the handoff doc, not the GitHub close).

---

**Previous entry, superseded above** — **#18 (Native: Plant/Planting detail, tasks & todos) is implemented, code-reviewed, and fully tested, but NOT yet closed on GitHub** — same posture as several prior tickets: real, tested code, held open pending the user's own manual device QA, not run this session.

Built: four new mobile screens under `apps/mobile/src/` — `registry/PlantDetailScreen.tsx` (view/edit a Plant's fields, add/remove reference photos via camera or library, delete), `plantings/PlantingDetailScreen.tsx` (view a Planting's quantity/year/source plus its dated photo log, add/remove photos, remove the Planting), `tasks/TasksScreen.tsx` (one-off todo add/toggle/remove, plus a list of Plantings linking to their own task history — reachable from the Dashboard via a plain link, not a tile, per CONTEXT.md's Dashboard entry), and `tasks/PlantingTaskHistoryScreen.tsx` (mark a Care task template done/missed per year). `RegistryScreen.tsx` now links each Plant to its detail screen and each Planting location to its own detail screen, replacing the plain-text Bed name it showed before #14 existed.

**Two scoping calls, not gaps** — both matching what the equivalent web page actually supports rather than adding new capability under a phone-parity ticket: Planting quantity/year-acquired/source-nursery are view-only on this screen, because web's own `PlantingMap.tsx` has never supported editing those fields after creation either (only the photo log and the Planting's removal are ever mutated post-creation — see that file's details panel). And Care task template management (add/remove templates on a Plant) stays web-only; #18's acceptance criteria separates "view/edit a Plant record" from "log task completion," and templates are created against a Plant, not consumed by completion-logging, so extending mobile's Plant edit screen to manage them was out of this ticket's actual scope.

New mobile repository work: `PlantsRepository`/`PlantingsRepository` (mobile) gained `get`/`update`/`remove` and full photo CRUD — reading a picked photo's local `uri` into an `ArrayBuffer` via `fetch(uri).then(res => res.arrayBuffer())` before upload, the same pattern `TagScanRepository.uploadTagPhoto` already used, since React Native has no browser `File`/`Blob` for a picked image. New `OneOffTodosRepository`/`TaskCompletionsRepository` (mobile), directly ported from web's — no RN-specific differences, since neither touches file storage. A shared `pickPhoto()` helper (`apps/mobile/src/lib/pickPhoto.ts`) factors out the request-permission-then-launch-camera-or-library dance once a second and third screen needed it, rather than copy-pasting `TagScanCaptureScreen`'s inline version a second time.

**Zero domain changes needed** for the repository/screen logic itself, but `apps/web/src/plants/plantFormFields.ts` (pure `PlantFormFields`/`plantInputFromFormFields`/`plantFormFieldsFromPlant`) moved into `packages/domain` so mobile's new `PlantDetailScreen` could reuse it verbatim instead of re-deriving the same string-form-field mapping — the same "promote a previously web-only pure helper once mobile needs it too" move #16 made for `MONTH_NAMES`/`formatOption`/`plantLabel`. Web's `PlantFormPage.tsx` now imports it from `@plant-app/domain` instead of a local file; behavior unchanged, confirmed by the full web suite staying green.

A `/code-review` pass caught one real bug before this landed: `PlantingDetailScreen`'s photo-preview effect used `Promise.all` while its own copied comment claimed the same one-failure-shouldn't-blank-every-thumbnail resilience `PlantingMap.tsx` gets from `Promise.allSettled` — fixed to match. Two other findings turned out not to be bugs: `PlantDetailScreen`'s equivalent effect and the photo-log's prepend-on-add ordering both exactly mirror pre-existing web behavior (`PlantFormPage.tsx`/`PlantingMap.tsx`), so "fixing" them here would have been an unrequested behavior change beyond phone parity, not a fix.

**Deferred, not run**: no manual device QA yet — the four new screens, their photo-picker flows (camera and library), and the Registry's new navigation links have only been exercised through the Jest/RNTL suite (which mocks `expo-image-picker`, `fetch`, and every Supabase-shaped repository client), not against a real device or the real linked Supabase project.

Full monorepo typecheck/test suite green throughout (215 domain + 147 mobile + 182 web at this update — web's count dropped by 6 from `plantFormFields.test.ts` moving into `packages/domain`, whose own count rose by the same 6).

**#18's closure won't unblock anything new** — confirmed directly against the API: no open issue lists #18 as a blocker. **#14** (Native: Map view) and **#15** (Native: Scale Reference calibration) are both already frontier (`blocked_by: 0`, unassigned) independent of #18 and remain open under #1 — #18 isn't the last native ticket. **#21, #23, #24, #25, #26, #27** are all `needs-triage`, not blocking anything.

**Pushed to `origin/main`**: not yet — see the commit for this update; push wasn't requested this session.


---

## #44: the inverted Shade Tolerance — fixed, verified, CLOSED

`6abcf9d`. **Device-verified by the user 2026-09-09** — the Suggested traits
panel renders no Sun/shade line, and accepting saves the Plant with no sun
requirement. **Closed 2026-09-09 at the user's explicit instruction**, which
per `CLAUDE.md` is the only thing that ever closes an issue here.

USDA's `Shade Tolerance` reading doesn't track shade tolerance
and appears close to inverted, so the mapping onto `SunRequirement` was
deleted rather than corrected. The evidence is on the ticket; the short
version is that `"High"` (which became `full-shade`) is what USDA reports
for Utah agave, plains prickly pear and coconut palm, and `"Low"` (which
became `part-sun`) is what it reports for eastern hemlock, sugar maple,
Canada yew and northern maidenhair fern.

**Why not remap.** The inversion is clean enough to be tempting, and that is
the trap. Inverting it ships a guess about an undocumented external field on
a 58-species sample. The field is absent until a source can supply it
honestly, and which source that is stays undecided — **#36's revisit is
scoped to names and coverage**, so this is not quietly folded into it.
Direction 3 on the ticket proposed that; it was not taken, and #36 was not
re-scoped.

**Shape of the fix.** `sunRequirement` is gone from
`UsdaSpeciesSuggestedTraits` itself, not just from `projectUsdaSpeciesTraits`
— the same move #40 made with `UsdaCharacteristic.value`. The compiler then
found all seven call sites: `traitsNotAlreadySetBy`, `hasApplicableTraits`,
`applySuggestedTraits` and the shared `SuggestedTraitsConfirmation` panel.
Both creation paths follow from that shared code (#31), so neither screen
needed its own change. Mature height and the reference-only hardiness zone
are untouched, and `CONTEXT.md`'s trait sentence no longer claims sun/shade
comes from USDA.

**Both open questions were answered by the user on 2026-09-09:**

1. **No backfill, and none wanted.** Everything in the database is the user's
   own test data — *not real users' records*. That fact retires this whole
   class of worry; don't propose migrations for existing rows. What the
   episode did expose is that a USDA-written value is indistinguishable from
   a user-typed one, which is now **#45** (record where a suggested value came
   from, per field).
2. **Sun/shade has a route back, via #46** (cross-check a second source;
   blocked by #45). The user's position: dropping a source over inaccuracy is
   the wrong trade unless the error rate is high. Two things were put on that
   ticket so they don't get re-argued — the error rate *is* the high case
   (half of a 58-species sample reads `"High"`; all 16 species re-fetched
   individually were backwards), and **USDA was never made useless**: #44
   dropped one field, while mature height, minimum hardiness zone and the
   entire species-name lookup still come from USDA. That misreading is easy
   to fall into; the fix removed a field, not a source.
3. **The copy question rides along with #46.** If sun/shade returns through a
   cross-check, there is nothing to explain on the confirmation screen.

Reviewed on both axes before committing. The one real finding was mine: the
rationale docblock was orphaned between two functions after the constant it
documented was deleted — it now sits on the type it describes.

## #23: the genus vocabulary — fixed, CLOSED

`d3bcf6c`. **Closed 2026-09-09 at the user's explicit instruction.** No UI
changed, so there was nothing to verify on a device beyond a confidence scan
of a physical tag; the 8-tag transcript covers the regression.

The parser decided what a scientific name was from typography
alone, and nursery tags always carry marketing copy of exactly that shape:
"Follow us" and a Vision-split "Sum mer" were proposed as species with the
same confidence as "Monarda didyma". Run end-to-end over the real 8-tag
transcript, the old parser scored **3 correct, 2 confidently wrong, 3
empty** — ADR-0004's "8/8 usable" had measured what Vision *recognised*, not
what the parser *extracted*, and the heuristic appears never to have been run
across the transcript at all. It now scores **3 correct, 0 wrong, 5 empty**.

**There is no third regex**, which is the part worth not re-litigating.
Loosening the pattern was this ticket's original proposal and makes precision
worse; tightening it drops real names and it was already whole-line anchored
while still leaking 2 of 8. The discriminator has to be vocabulary.

**Shape of the fix.** A bundled genus list from GBIF's backbone
(`kingdom=Plantae`, `rank=GENUS`, status `ACCEPTED` or `SYNONYM`), compiled by
a checked-in generator, consulted locally. `parseOcrTextLines` stays
synchronous and pure — a scan never calls the network to decide what a word
is. The gate stacks *on top of* the shape rule, so a false positive must now
be both a real genus and followed by a lowercase word. ADR-0006 holds the
whole decision, including why GBIF's `species/match` endpoint is unusable (it
returns `ACCEPTED, confidence 99` for "Follow", "Deer" and "Winners").

**Three things to know before touching it:**

1. **The Set is built on first lookup, not at import.** An eager version
   splits a 589KB string and builds a 48,873-entry Set on the JS thread at
   every app start, on both surfaces, for every gardener including the many
   who never open Tag Scan. Found in review. Don't make it eager again.
2. **Overrides are merged at load, not baked in by the generator** — a
   deliberate deviation from #23's literal acceptance criteria, flagged on
   the ticket. It serves the criterion beneath it (editable without touching
   the parser) and keeps the generated file a faithful GBIF mirror. The cost
   is that no single file answers "is X in the vocabulary". Reversible.
3. **Regenerating costs ~7 minutes** of GBIF pagination
   (`npm run generate:genera` in `packages/domain`) — deep offsets on their
   search endpoint are slow. The generator now refuses to write a truncated
   vocabulary rather than silently shipping a short one.

**Bundle: 48,873 genera, 589KB on disk, ~175KB gzipped**, against the
ticket's ~120KB estimate. **Settled 2026-09-09 — the user is fine with it**
("that file size is not a problem to me"), so keep the full vocabulary,
`SYNONYM` included. Don't reopen this to save space: halving the file means
dropping the retired names nurseries still print, which is the job itself.

**The residual risk is named, not solved.** Of 34 ordinary English words
probed at triage, 17 are genuine genera — *Iris*, *Veronica*, *Dahlia*,
*Viola*, *Hosta* and more. "Veronica loves full sun" still gets through. They
are not pre-emptively excluded because they are exactly what a gardener
legitimately scans; the exclusions layer is where one gets handled if it
shows up, and #39 is about gathering that evidence.

**Knock-on for #38:** tag3's false-positive species used to carry the real
cultivar `'Wildberry'`. With the species rejected there is nothing to attach
it to, so tag3 degrades to `[]`. Whether it should yield a cultivar-only
candidate is #38's call, unchanged by this.

Reviewed on both axes. The findings that mattered were the eager-Set startup
cost above, and a verbatim-transcript violation inherited from an existing
test: the real OCR line is `Heucheralla Capture the Fag'`, and the test had
silently corrected the misspelling to `Heucherella` — testing a line no tag
ever produced.

## Known unfixed defects

**One outstanding: #56.** Deleting a Plant orphans its Plantings' photo files
in the `planting-photos` bucket, via `plantings.plant_id`'s cascade — the same
defect #47 fixed for Property and Bed, reached by a third route neither #47's
criteria nor #49's covered. Filed 2026-09-10, not fixed: #47's machinery
extends to it (`delete-map-object` already takes a `kind`), but widening an
approved brief mid-implementation was the wrong call.

One *data* residue is also known and deliberate:
Plants created before `6abcf9d` may carry a USDA-sourced `sunRequirement`
from the inverted Shade Tolerance mapping (#44), and nothing distinguishes
them from user-typed values. Not a code defect, not backfilled, awaiting the
user's call — see "#44: the inverted Shade Tolerance".

#40 — the fabricated hardiness zone from an empty
USDA minimum-temperature value — was **fixed 2026-09-07** in `e44325d`,
is covered by unit tests in `packages/domain`, and was **closed 2026-09-08**.
#42, the `BedEditor` test flake, was **fixed and closed 2026-09-09** in
`7331099`; it was never product behaviour.

Anything in this class belongs on the tracker, not in this section.
Trimming this doc on 2026-09-06 removed a large archive whose only unique
content was defects like this one — file them when found.

## Deferred QA by ticket

This was tracked as **#34**, closed 2026-09-07 once every item below had
been run or ruled out of scope. These checklists are now the record; there
is no open issue behind them.

**Outstanding, both from 2026-09-09:** **#28**'s pass (top of this doc) and
**#36**'s (in its own section above — five steps, needs a device or dev
client, since the lookup is native-mobile-only until #43). Neither has been
started. Ask the user who runs them before scripting anything.

### Ticket #10 — automated, passing

No longer a manual checklist. #10's items are covered by the Playwright
suite added 2026-09-07 (`npm run e2e` in `apps/web`), which runs on
Chromium *and* WebKit: every filter axis alone, combinations asserted as an
intersection rather than a union, clear-and-restore, the empty state,
alphabetical ordering, the Registry -> map links including the
reopen-after-close case that exercises the ref-guard, the degraded
no-Property state, a stale `plantingId`, and phone-width overflow.

Read `apps/web/e2e/seed.ts` before changing the seed data: the Plant list is
shaped so that each filter axis is load-bearing in the three-axis
intersection test. An earlier seed left two of the three axes decorative,
and a mutation run (disabling the native-status filter) is what caught it.

The suite runs against the real linked Supabase project under a dedicated
throwaway account, wiped and re-seeded per run. It refuses to run against an
account whose email doesn't look like a QA one, because it deletes every
Plant and Property on the account it runs as.

### Ticket #5 — all done, #5 closed

Ticket #5's Edge Function and migrations were verified via `npx supabase
migration list` (all migrations through `0008` live) and direct `curl`
smoke tests of both deployed functions' guard paths (CORS preflight,
missing/invalid auth, blank address, malformed body).

1. ~~Full create-Property flow in the browser~~ — **done**, address
   autocomplete → pick a candidate → base map renders. Verified twice:
   directly by the user, and via automated headless-browser driving.
2. ~~**Degraded-mode path**~~ — **done.** Rather than hunting for a real
   land address with no Esri coverage, created a Property directly via the
   deployed `create-property` Edge Function at open-ocean coordinates
   (30°S, 140°W) using a fresh throwaway test account (signup returns a
   session immediately — email confirmation is off). Backend correctly
   returned `imagery_zoom: null`, `imagery_available: false`; a
   Playwright-driven browser then confirmed `/map` renders "No aerial
   imagery is available for this property's location..." instead of a
   silent gap or broken images.
3. ~~**One-Property-per-account**~~ — **done.** Called `create-property`
   again for the same test account: got a clean
   `{"error":"You already have a Property."}`, not a raw Postgres
   constraint error. The current UI only ever shows the create form when
   no Property exists, so this path isn't reachable through normal
   navigation — verified at the API layer, which is what the form's
   generic error-display code renders verbatim if it's ever hit.
4. ~~**Reload persistence**~~ — **done.** Hard-refreshed `/map` with the
   degraded-mode Property already created: it loaded the existing Property
   (`PropertiesRepository.get()`) rather than re-showing the address form.

All four verified via a fresh throwaway test account against the real
linked Supabase project — no other account's data touched. The test
Property row was deleted afterward; the throwaway auth user itself remains
in the project (no service-role access from this session to remove it) —
see the closing comment on #5 for full detail.

### Tickets #8 and #7 — run 2026-09-07, passed

The real-mouse and WebKit sittings were both run by hand and passed:
freehand tracing and the smoothing toggle on a hand-drawn shape, bezier-pen
curve handles, real Pin dragging (out of every Bed and back in), tapping the
rendered on-canvas Pin, the break-it cases (tiny rect/oval near the discard
threshold, overlapping Beds, "Clear" mid-draw on all four tools,
overlapping-Bed Pin resolution, real image files in the photo log), and all
of it again in Safari. No WebKit-only defect found.

**#8's Bed-delete cascade also passed** (user-run, 2026-09-07): removing a
Bed that has Plantings on it doesn't leave the UI stale — `PlantingMap`'s
plantings effect keys off `beds`, so it refetches on its own. No QA items
remain from either ticket.

**#7's real-address check passed in full, 2026-09-07.** Item 4 wanted the
aerial imagery and drawn Bed alignment confirmed at an address the user
cares about: imagery is good at that latitude and zoom, and drawn Beds land
where the real beds are. #7 has no QA left.

It did surface a usability gap — no rotation of the base map or of a drawn
shape, against north-up Web Mercator tiles and an angled house. See "What
to do next".

**#8's touch/mobile item is out of scope, not outstanding.** It asked about
finger-dragging a Pin in a *phone browser*. ADR-0003 was amended 2026-09-07
to say a mobile browser is not a supported surface at all — see "The full
decision set". The item predates the native Map screen (#14), which is the
surface that commitment actually refers to, and whose device QA passed.

### Ticket #3 — all done

Item 1 (another account's plant ID -> "Plant not found." via RLS) was
confirmed by the user 2026-09-02. The remaining three — a nonexistent plant
ID, reference-photo persistence across a reload, and alphabetical ordering —
are covered by the #10 Playwright suite as of 2026-09-07. The photo check
uploads a real PNG, not the 4-byte placeholder an earlier automated pass
used.

### Ticket #4 — all done, #4 closed

All three items below were run this update via a real signed-in browser
(two accounts) and passed — see the closing comment on #4 for the same
detail:

1. ~~**RLS via the `plants` join**~~ — **done.** Logged in as account A,
   added a care task template to one of A's plants; logged in as account
   B, pasted A's `/registry/<plantId>` URL directly. Correctly blocked —
   "Plant not found." (the alert renders low in the form, just above the
   Save button, easy to miss without scrolling; page title falls back to
   "Plant" in this state). New ownership-check pattern (a join to
   `plants`, not a direct `user_id` column like #3's) now proven against
   real Postgres.
2. ~~**Reload persistence**~~ — **done.** Hard-refreshed the Plant edit
   page after adding a template; it still loaded (`listCareTaskTemplates`
   on a fresh mount).
3. ~~**Validation errors in the browser**~~ — **done.** Blank name → "Name
   is required."; missing date-range parts and blank seasonal-marker text
   both showed their inline alerts as expected.

---

## What this project is

A personal garden registry for a gardener with 50–100 plantings who loses
track of what's planted, especially in winter. Desktop is a browser app,
phone is native React Native, with full feature parity except drawing — Bed
outlines and drawn base maps stay desktop-only.

The entities and their exact meanings (Plant vs Planting, Property, Bed,
Pin, Scale Reference, Tag Scan, Bloom window, Registry, Bloom Timeline,
Dashboard) are defined in **`CONTEXT.md`**. Use its terminology; this doc
deliberately doesn't restate it.

Full spec, and the source of truth: **GitHub issue #1**.

---

## Current state

Deliberately not recorded here. Every state snapshot this doc has carried
went stale within days and then actively misled the next session — the
version removed on 2026-09-06 still named #12/#14/#16/#17 as the frontier
long after all four had closed, and warned twice about its own drift while
doing so.

Check it live instead:

```
git status && git log origin/main..HEAD
gh issue list --state open
```

---

## The full decision set (don't re-litigate these)

**Platform & persistence (ADR-0003):**
- Desktop is a browser-based web app, reusing ADR-0001's Konva editor.
- Phone is a native app, React Native (iPhone first, Android later at low
  cost — chosen over Flutter specifically to share TypeScript with the web
  app).
- Full native feature parity **except drawing** — Bed outlines and a
  Property's drawn-in-app base map stay desktop-only; Scale Reference
  calibration (tapping two points) is *not* bundled into that exception and
  works fine on phone.
- **There are two surfaces, and a mobile browser is not one of them**
  (ADR-0003, amended 2026-09-07). The web app is the desktop surface, the
  iPhone app is the phone surface. The web app degrades politely on a
  phone-sized browser — a standing notice pointing at the iPhone app,
  nothing blocked, so a link opened on a phone isn't a dead end — but that
  is a courtesy, not a commitment: **a bug found only in a mobile browser is
  not an MVP defect.** When a CONTEXT.md term says something works "on
  phone", it means the iPhone app.
- **Drawing points at a desktop browser, never at the app.** The native app
  deliberately has no drawing either, so "unavailable here" messages on a
  phone browser must send the gardener to a desktop browser — sending them
  to the app would send them somewhere the feature doesn't exist. The two
  strings live in `apps/web/src/desktopOnly.tsx` and a test asserts they
  stay different.
- **Bed names are unique per Property**, case- and whitespace-insensitively,
  enforced both in `validateBedInput` and by a unique index (migration
  0023, applied 2026-09-07). The migration **backfills** existing duplicates
  by suffixing them rather than grandfathering them, which was only
  acceptable because every account on this project belongs to one person.
  **Don't reuse that shape once there are third-party users** — rewriting
  content a user authored is the thing to avoid, and the standard move is to
  validate on write and leave history alone.
- Cloud-hosted backend-as-a-service, Postgres-based (e.g. Supabase), with
  accounts — local-only was ruled out, not deprioritized, since two devices
  need to see the same data.
- Domain logic touching an external adapter credential (USDA, geocoder, tile
  server, parcel service) runs server-side (Edge Functions) — not optional,
  an API key can't ship in a client. Everything else runs in a shared
  TypeScript package imported by both frontends — this is *the* domain-logic
  test seam. **This split was recorded with lower confidence than the rest
  of the ADR** — see ADR-0003's explicit reconsider-if condition before
  treating it as settled forever. **OCR is deliberately not in either list**
  — see "Open, but not blocking" below.

**Property, Bed, and the map (ADR-0002, amended):**
- Property owns one scale, shared by every Bed within it — never per-Bed.
  One Property per account for MVP; schema allows more later without a
  migration.
- Three base-map sources: aerial image (auto-scaled from latitude/zoom),
  a photographed plot plan/survey/sketch, or a plan drawn in-app. **The base
  map is a structural reference layer** (property boundary, driveways,
  hardscaping, house footprint) — **not a stencil Beds are traced from.**
  Beds are always hand-drawn on top of it. One base-map source per Property;
  no mixing.
- The two non-aerial sources need Scale Reference to establish scale: two
  points plus a real-world distance, either a known measurement or a
  measured object (prefer long, fixed, permanent references).
- Bed geometry is stored in real-world units, not pixels — survives a later
  base-image swap.
- Parcel-service boundary fetching is **best-effort only**, not depended on
  — no free national source, unresolved data-licensing question. The
  photographed plot-plan path covers the same need more reliably.
- GPS-assisted pin placement: deferred, not rejected. LiDAR/AR scanning:
  considered and set aside (see ADR-0002 for both, including reopening
  conditions).

**Pins and Landmark:**
- Pins are placed by **dragging** directly onto the map. No manual numbers,
  identical on desktop and phone.
- **Landmark (distance-based pin refinement) is deferred, not required for
  MVP** — superseded once the map itself became trustworthy. May return
  later as an optional precision-assist suggestion. Never built.

**Tasks (removed from the app 2026-09-08):**
- The whole task system — care task templates, triggers, completion logging,
  one-off todos — is **gone: code deleted, tables dropped**. A third status,
  distinct from Landmark's (never built) and from its own previous one (built
  and retained). Don't re-litigate it, and don't restore it — see
  `docs/adr/0005-remove-the-task-system.md`.

**Tag Scan:**
- Photograph a nursery tag → OCR extracts candidates → human always confirms.
  **OCR is a convenience layer; manual Plant entry always works as a
  complete fallback** if OCR fails, is unavailable, or misreads something.
- Matching resolves to genus, species, *and* cultivar — never just a common
  name (one common name can span multiple species; one species can span a
  straight form and named cultivars). Ambiguous matches surface candidates
  and tell the user to check the physical tag, never guess.
- Checks for an existing matching Plant before creating a new one, to avoid
  the registry fragmenting across repeat purchases from different nurseries.
- Species-level trait suggestions (hardiness, size, sun/shade) come from
  USDA PLANTS. **Never bloom window** — it's climate/location-dependent, not
  a fixed species fact, regardless of source.
- Tag photos are kept separate from Plant reference photos, never mixed;
  kept by default (a setting, not a per-scan prompt), deletable like any
  photo.
- ~~**Recommended before full build**: a `/prototype` pass on OCR (real
  tags) and the USDA data pull~~ — **done**, see #19/ADR-0004 above. **Built
  for real** in #20, except the on-device Vision module itself (#22, not
  yet built): candidate review, ambiguous-common-name resolution,
  genus+species+cultivar duplicate detection, USDA trait projection, and
  the tag-photo-as-own-category storage all ship now, behind a
  `TagOcrAdapter` seam — `manualEntryAdapter` is the one real
  implementation today (which is also exactly the "complete fallback"
  bullet above, not a placeholder for it).

**Everything else (unchanged from the original spec):**
- One Planting = one record, `quantity` field, never one record per specimen
- Bezier-pen is in scope for the bed editor, alongside freehand and
  rectangle/oval — all three validated in the ADR-0001 prototype

### Open, but not blocking

- ~~Which OCR: on-device or a cloud API?~~ **Resolved by ADR-0004**:
  on-device, Apple's Vision
  framework — tested for real against 8 real nursery tag photos, 8/8
  produced usable text. It runs in the shared client package, not an Edge
  Function, per ADR-0003's split. Cost: `apps/mobile` needs a custom EAS
  dev client to actually reach Vision (Expo Go can't) — tracked as **#22**,
  not yet built. #20 shipped everything Tag Scan needs *except* that native
  module, behind a `TagOcrAdapter` seam `#22`'s adapter plugs into later.

---

## Issue tracker

Issues live as GitHub issues in `annetters/plant-app`, managed via the `gh`
CLI. Full workflow: `docs/agents/issue-tracker.md`. The triage labels and
the `post-mvp` scope label are documented in `docs/agents/triage-labels.md`
— `post-mvp` is a scope label, not a triage role, so an issue can carry one
of each.

**#1** is the spec. **#2–#20** were the tracer-bullet tickets `/to-tickets`
split it into, all now closed; #21 onward were filed during implementation
and QA. Don't run `/to-tickets` again.

Dependency edges use GitHub's native issue dependencies, not a text
convention. Check blockers and find the frontier live:

```
gh issue list --state open
gh api repos/annetters/plant-app/issues/<n> --jq '.issue_dependencies_summary'
```

A ticket map and a frontier list used to live here. Both were snapshots of
queryable state, both went stale, and the stale copy did get trusted at
least once. The commands above are the only reliable answer.

---

## Suggested skills

- **`/implement`** — the pattern used for every ticket so far. Run once per
  ticket, fresh session each time, pointed at a ticket number. Drives `/tdd`
  internally, closes with `/code-review`. Pick a target from the live
  frontier query above, not from any list written down here.
- **`/codebase-design`** — for module structure, particularly the
  shared-TypeScript-package boundary from ADR-0003.
- **`/domain-modeling`** — if any term in `CONTEXT.md` needs sharpening
  during implementation.

**Before starting a QA pass on any ticket, ask the user whether they want to
run it themselves or want it Playwright-automated** — don't assume (see
`CLAUDE.md`).

If you don't have these skills installed, the flow still stands on its own:
break the spec into tickets with explicit dependencies, then build one at a
time.
---

## Notes

- Use the exact terminology from `CONTEXT.md` throughout — Plant vs.
  Planting, Property, Scale Reference, Bed, Landmark (deferred), Pin, Tag
  Scan. Don't drift to synonyms.
- **Where ADRs and the spec disagree, the ADRs win** — they're newer and
  both say so explicitly.
- **The spec issue (#1) is the source of truth**, not `docs/plant-app-spec.md`
  — that file is explicitly superseded and says so at the top.
- GitHub issues are the source of truth for work tracking — run
  `gh issue list` before starting new work to avoid duplication.
- **Prefer Docker-free tooling.** Stated explicitly when setting up the
  Supabase CLI — use it in remote-only mode (`db push`/`db diff`/`gen
  types` against the linked hosted project) rather than `supabase start`,
  which needs a local Postgres-in-Docker stack. Applies beyond Supabase:
  default to a Docker-free path for other dev tooling in this repo too,
  unless told otherwise.
