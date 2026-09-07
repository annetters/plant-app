# Handoff: Personal Garden Plant Registry — plant-app

**Date:** 2026-09-06 (updated: **#37 built, reviewed, and closed on the user's instruction — the duplicate-Plant check now runs on all three creation paths, and its "add a Planting instead" offer is real for the first time**; see "#37: the duplicate check on every creation path" immediately below. Also **#29 fixed on `main` and closed by the user — `PropertyPage`'s no-scale message now branches on `baseMapSource`, so a photo/drawn Property is told its Scale Reference isn't calibrated yet rather than that aerial imagery is missing**; see "#29 fixed" below. Also **#33 fixed on `main` and closed by the user earlier the same day** — a dot per placed point in the drawing surface, reusing the treatment `calibrate` already applies to its ScalePoints; see "#33 fixed" below. Previously 2026-09-05: **#33 re-triaged to `ready-for-agent` — the reported symptom is a missing point marker, not the drag-vs-click question the ticket posed**; see "#33 re-triaged" below. Previously 2026-09-04: **the backlog is triaged — `needs-triage` is empty, and only four issues stand between here and the MVP**; see "Backlog triage: the board now has a verdict on every issue" immediately below. Previously the same day: **#31 is built, device-QA'd, closed by the user, and pushed — three QA findings, all fixed**; see "#31: manual Plant creation on native mobile" immediately below. Also filed **#36** against the USDA data source. Previously the same day: **#15 is built, device-QA'd, closed by the user, and pushed — every ticket #2–#20 under the spec now has code, and no build work remains on the frontier**; see "#15: native Scale Reference calibration" below. Previously 2026-09-03: Previously the same day: **#25's blocking gap is fixed and QA'd** — see "#25's last gap closed" immediately below, which supersedes both "What to do next" entries and the "Not yet resolved — blocks closing #25" section. Earlier the same day: the task system was removed from the MVP commitment — see "Scope change". Previous update, 2026-09-02: everything pushed, #18 closed by the user, and the QA orphaned when #3/#7/#8/#17 were closed is now collected in #34 — see "After both QA passes" below, which corrects several claims made elsewhere in this doc)
**Repo:** `annetters/plant-app` · branch `main`

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

**One item remains unrun**, and it is the one that needs a rebuild: the Tag
Scan `formatOption` display change ("full shade", not "full-shade"), reachable
only through a real tag scan and therefore only from the custom dev client. It
is cosmetic and the stored value is unchanged.

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

Two small carried-over items: `apps/mobile/AGENTS.md` points at the Expo
**v57** docs while the app is pinned to **54.0.37** (the SDK 54 docs are the
right ones — see #13's entry for why the downgrade happened); and the
`[POST-MVP]` tag convention introduced in the task-scope change is still used
only in #1.

---

## #25's last gap closed — QA run by the user, everything fixed

**This entry supersedes the "What to do next" section further down and the
whole of "Not yet resolved — blocks closing #25".** That gap is gone.

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

## Scope change (2026-09-03): the task system is out of the MVP

**Care task templates, task triggers, task completion logging, and one-off
todos are no longer part of what the MVP promises.** Decided with the user
through a `/grill-with-docs` session. This was a scope call, not a quality
one — scheduling garden care simply matters less than the rest of the
registry, and holding MVP for its remaining polish wasn't worth it.

**No code was removed, and none should be.** The feature is built, migrated,
tested, and still fully working on both platforms.
`packages/domain/src/{careTaskTemplate,taskCompletion,oneOffTodo}.ts`,
migrations `0003`/`0004`/`0019`/`0020`/`0021`/`0022`, `apps/web/src/tasks/`,
`TasksPage`, `PlantingTaskHistoryPage` and their native equivalents are
**not dead code** — do not delete them, and do not treat them as unfinished
MVP work. **#4, #12 and #18 stay closed** and remain accurate history of work
that was genuinely done.

What changed instead:

- **`CONTEXT.md`** — the four task glossary entries now lead with "Built and
  working, but outside the MVP commitment", plus the Plant field list and the
  Dashboard entry. Deliberately *not* Landmark's "deferred" wording, which
  would be false here: Landmark was never built, this was. Committed and
  pushed in `7ccff8a`, along with this doc's own updates.
- **#1 (the spec)** — 15 `[POST-MVP]` tags across the Solution bullet, user
  stories 10–12 and 48–51, and the Task model / Task completion /
  no-per-Planting-overrides bullets. The native-parity claim no longer
  promises task management; three task example tests moved out of the MVP
  acceptance list into their own marked bullet; a new Out of Scope entry; and
  a dated amendment in Further Notes carrying the retention rule above. Story
  numbering was left unchanged on purpose, so existing references stay valid.
- **New `post-mvp` label**, applied to **#21** (single-day trigger UX — the
  only piece of task work never built), which stays open with the reasoning
  commented on it.

One thing a later session may want to revisit: the **`[POST-MVP]` tag
convention is new**, invented for this and used only in #1 so far.

> **Updated 2026-09-04.** `post-mvp` is still a scope label rather than a
> triage role, but it is no longer undocumented: the backlog triage pass (see
> "Backlog triage: the board now has a verdict on every issue") put it in
> `docs/agents/triage-labels.md` under its own **Scope labels** heading, held
> deliberately apart from the five-role mapping table. #21 no longer carries
> `needs-triage`.

---

## What to do next

> **Also read "After both QA passes" further down.** It was written later and
> corrects this entry's git state, the standing instruction about #18, and
> every "not pushed yet" line in this doc.

> **Superseded — see "#25's last gap closed" at the top of this doc.** The
> unresolved thread named below is fixed and QA'd.

**#25's browser QA checklist is complete, but #25 is NOT ready to close** —
one unresolved thread is a real behavior change caused by #25 itself, not a
side-finding, and it wasn't covered by this session's checklist. See
"Not yet resolved — blocks closing #25" immediately below before doing
anything else with this ticket.

The checklist itself: every item scoped to #25 passed (see "#25 checklist
results" below for the walkthrough). Two unrelated real bugs surfaced along
the way and are fixed, tested, and committed; two more unrelated ones were
filed instead of fixed, at the user's choice.

**#25 STAYS OPEN on GitHub regardless — same standing rule as #14 below: never
close an issue without the user explicitly asking**, even once the item below
is resolved and the checklist is fully clean.

### Not yet resolved — blocks closing #25

> **RESOLVED — see "#25's last gap closed" at the top of this doc.** Everything
> in this section is history: the fix was implemented, reviewed and verified by
> the user. Nothing below blocks #25 any more.

**A freshly created Property shows no imagery at all until "Draw a Bed" is
clicked** — found during the peer session's #14 pass (see "#25 already has a
finding, before its own QA has started" further down for the original
write-up), not by this session's checklist. Neither `PlantingMap` (hidden
while `beds.length === 0`, #25's own change) nor `BedEditor` (base map only
renders once its drawing panel is open) shows anything in the gap between —
before #25, `PlantingMap`'s unconditional canvas was what confirmed a new
address had resolved correctly. This session's checklist tested "no Beds yet"
on an *existing* Property, not a Property that was *just created*, so this
specific path is still unverified against the current code. A fix was
suggested (render the base map in `BedEditor`'s closed state) but never agreed
or implemented. **Next step: decide on that fix (or an alternative), test the
freshly-created-Property path specifically, then #25 is closable** (pending
the user's explicit ask, per the standing rule above).

**This session ran concurrently with a peer session also working in this
repo** (the one that did #14's device QA, below). Both sessions shared one
working tree, so commit `25340f3` — nominally a #14 fix — also carries this
session's uncommitted `PlantingMap.tsx` transparency fix; it got swept in when
the peer session committed. Not a mistake, just how two sessions in one
working tree can interleave. Worth knowing if the two don't obviously line up
by commit message.

### #25 checklist results

1. **Passes.** Empty state renders with no leftover canvas, grey box, or scroll gap.
2. **Passes** — draw-and-save-without-reloading still resolves a Pin into the new Bed exactly as before. Along the way, the user found Beds hard to see against the base map: `PlantingMap.tsx`'s `BED_FILL` was `rgba(82,183,136,0.12)`, diverging from `BedEditor.tsx`'s `0.2` despite a code comment claiming the two render identically. **Fixed** — bumped to `0.2` to match (landed in `25340f3`, see above).
3. **All three base-map sources checked; aerial and photo backdrops correct.** The user found the separate **drawn base-map creation flow** (Property setup, `BaseMapSetup.tsx` — a different screen from anything #25 touches) confusing: dragging to trace a line does nothing until mouseup, because that screen is click-to-place-points by design, not freehand, and nothing in the UI makes that obvious mid-drag. Real UX gap, not a #25 regression. **Filed as #33**, not fixed.
4. **Inconclusive.** On this pass, Beds and the base map arrived close enough together on reload that the load-order flash wasn't visibly distinguishable either way. No action taken — still an open design trade-off (see #25's own writeup below) if it turns out to matter later.
5–7. **Pass** — reload with existing Beds, the Registry's `?plantingId=` deep link, and phone-width layout all behave as expected.
8. **Passes in Safari**, and surfaced a real, pre-existing, non-Safari-specific bug along the way: opening "Draw a Bed" never showed previously-saved Beds on the editor's own canvas, even though they showed correctly in the Beds list below it. Root cause: the effect drawing saved Beds onto the Konva layer depended on `[beds, pixelsPerFootValue]` alone — neither changes again once the Beds fetch resolves, and that fetch almost always resolves before the editor is ever opened, so the effect's one real run found the layer still `null` and never fired again once the layer existed. Same *shape* of bug as #8's original null-ref issue, which #25's own code comment (below) describes. **Fixed and tested** (`b6ff131`): added `open` to the effect's dependency list so it re-runs once the Konva stage actually mounts. A regression test was added and confirmed to fail without the fix before landing it.
9. **Not testable as written** on the Property used for this pass — its base-map source is an uploaded photo, so genuinely zero `arcgisonline` requests is correct, not a bug. Optional item to begin with; left unverified against an aerial-source Property.

**Also found, unrelated to #25, filed rather than fixed (user's choice):** leaving "Bed name" blank and clicking "Save Bed" shows no visible error. Validation does run and does produce "Name is required.", but the `<p role="alert">` renders at the very top of `BedEditor`'s `<section>` — above the 768px canvas and the Save button, off-screen from where the user is actually looking when they click Save. Same class of bug already fixed once for `PlantDetailScreen` on native (a failed Save with the invalid field scrolled out of view gave no visible feedback). **Filed as #32**.

**The freshly-created-Property gap is not covered by items 1–9 above** — see "Not yet resolved — blocks closing #25" at the top of this doc.

**Full monorepo suite**: web 187/187 passing (+1 from the new regression test), typecheck clean. Domain and mobile untouched this session.

**Git state**: `b6ff131` was the tip when this entry was written. Superseded — see "After both QA passes" immediately below.

---

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

## Known unfixed defects

**#40** — `packages/domain/src/usdaTraits.ts` derives a fabricated hardiness
zone when USDA returns an empty minimum-temperature value. Found during #7,
carried unfiled in this doc's archive until 2026-09-06, still present in
`main`. The issue has the full write-up; don't restate it here.

Anything else in this class belongs on the tracker, not in this section.
Trimming this doc on 2026-09-06 removed a large archive whose only unique
content was defects like this one — file them when found.

## Deferred QA by ticket

Outstanding manual QA carried over from closed tickets is also tracked as
**#34** (`ready-for-human`). That issue is the live status; the checklists
below are the detail behind it.

### Ticket #10

Not run yet — the user couldn't QA this session, so this is queued as
their own to-do for next time, against the real linked Supabase project
in a real browser:

1. **Filter/search — the core acceptance criterion.** With several real
   Plants covering a mix of sun requirements, flower colors, bloom
   windows, foliage types, and native status: try each filter axis alone
   (partial common name, scientific name, and cultivar for search; a
   flower-color substring; bloom month; sun/shade; foliage; native
   status), then combine 2-3 at once and confirm the result is the
   intersection, not the union. Clear back to no filters and confirm the
   full list returns. Search for something matching nothing and confirm
   "No Plants match these filters." appears rather than a blank list that
   looks broken.
2. **Planting-location links — the map jump.** Pick a Plant with a real
   Planting and confirm a "View in \<Bed name> on the map" link appears
   under it; click it and confirm `/map` loads with that Planting's
   details panel (quantity, year, source, photo log) open automatically,
   with no need to hunt for its Pin. Close the panel, navigate back to the
   Registry, and click the same link again — confirm it reopens (exercises
   the ref-guard `/code-review` added, which should reset because
   `PropertyPage` remounts on navigation). A Plant planted in **more than
   one** Bed should show multiple links, each opening the correct
   Planting. A Plant with **no** Planting yet should show no map link.
3. **Degraded/edge states.** Before any Property/Beds exist: confirm the
   Registry still loads and filters normally, just with no map links
   anywhere. A `?plantingId=` naming a since-deleted Planting: confirm the
   map just loads normally with no panel and no crash.
4. **Cosmetic.** Phone-width viewport with all six filter fields plus the
   existing list — check nothing looks cramped or broken (Bloom Timeline's
   #9 QA found a real phone-width bug here). Cross-browser (Safari/
   WebKit) — this repo's history (#5's dropdown bug) has found real
   WebKit-only rendering gaps Chromium alone misses.

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

### Ticket #8 — NOT RUN, and #8 was closed anyway

**#8 was closed on GitHub 2026-08-24 with every item below still unrun.** **Tracked in #34.** The
user confirmed on 2026-09-02 that these remain genuinely outstanding and are
waiting on their own QA. Item 2 (touch/mobile) is arguably now answered by
#14's device QA, which exercised real Pin dragging on the native equivalent.


Not run — these need real hardware/browsers or human judgment, not the
synthetic Playwright pass this session already ran (create/view/photo-log/
remove a Planting, reload persistence, zero console errors — see the #8
entry in "What to do next" above for that pass's full detail, including the
two real bugs it caught). Lower priority than a shipping blocker, but worth
picking up before leaning on this feature for real garden-planning use:

1. **Actually dragging the Pin with a mouse/trackpad.** The automated pass
   never simulated a real drag on the Pin marker — Konva canvas drags are
   awkward to script reliably — so it set up the test Bed to already cover
   the Pin's default starting position and let it resolve with no drag at
   all. Never exercised: dragging the Pin from center to elsewhere inside a
   Bed, dragging it outside every Bed (confirm "Drop the pin inside a Bed."
   appears and Save disables) and back in (confirm Save re-enables), and how
   the drag actually feels — snappy vs. laggy, any visual glitches mid-drag.
2. **Touch/mobile behavior.** CONTEXT.md's Pin entry says placement should
   work identically on desktop and phone (unlike Bed drawing, which stays
   desktop-only) — `PlantingMap` is deliberately not gated to desktop for
   this reason, but it's never been touched on an actual phone or even a
   touch-emulated browser. Check: does a finger-drag move the Pin, does the
   map/form layout fit reasonably on a small screen.
3. **Tapping the actual on-canvas Pin, not the list button.** The
   automated pass used each Planting's "View" list button — same handler as
   tapping the rendered Pin, but easier to script. Never clicked the actual
   circle on the canvas; worth confirming hit-testing works reliably at its
   small radius.
4. **Cross-browser.** Only Chromium was driven. This repo's own history
   (#5's dropdown-not-clickable bug) found real WebKit-only rendering
   differences Chromium missed; `PlantingMap` hasn't been checked in WebKit
   at all.
5. **A couple of edge cases**: removing a Bed that already has Plantings on
   it (the FK cascade-deletes them server-side — does the Plantings list
   go stale in the UI until a reload, or update cleanly?); two overlapping
   Beds (a dropped Pin resolves to whichever Bed comes first in the loaded
   list, which might not be the one visually on top); and real image files
   for the photo log (the automated pass uploaded a 4-byte fake JPEG) —
   actual file sizes, multiple photos in one log, and confirming they list
   most-recent-first.

### Ticket #7 — NOT RUN, and #7 was closed anyway

**#7 was closed on GitHub 2026-08-23 with every item below still unrun.** **Tracked in #34.** The
user confirmed on 2026-09-02 that these remain genuinely outstanding and are
waiting on their own QA — closing the ticket did not retire them.


Not run — these need human judgment or a real device/browser, not the
synthetic Playwright pass this session already ran (all four tools drawn,
saved, persisted across reload, removed, cascade-deleted, zero console
errors — see the #7 entry in "What to do next" above for that pass's full
detail). Lower priority than a shipping blocker, but worth picking up
before leaning on this feature for real garden-planning use:

1. **How drawing actually feels with a real mouse/trackpad** — the
   Playwright pass traced a mechanical circle for freehand; a real
   hand-traced garden-bed shape, and whether the smoothing toggle's
   rounding looks good on it, is the real test.
2. **Bezier-pen curve handles (click+drag)** — the automated pass only
   clicked straight-edged corners. Dragging after a click to pull a curved
   edge is the one pen-tool interaction never exercised.
3. **Cross-browser** — only Chromium was driven. This repo's own history
   (#5's dropdown-not-clickable bug) found real WebKit-only rendering
   differences Chromium missed; Bed Editor hasn't been checked in WebKit at
   all.
4. **A real address the user cares about**, not just the Cambridge, MA test
   address — confirm the aerial imagery and drawn Bed alignment look right
   at that property's actual latitude/zoom.
5. **Trying to break it**: a very tiny rectangle/oval drag (near the
   8px/5px discard threshold), drawing a Bed that overlaps another Bed, and
   clicking "Clear" mid-draw for each of the four tools.

### Ticket #3 — item 1 done, three still not run

**#3 was closed on GitHub 2026-08-20 with these items still unrun.** They are
genuinely outstanding, not abandoned — the user confirmed on 2026-09-02 that
they are still waiting on their own QA. **Tracked in #34** along with #7's,
#8's and #17's.

1. ~~**Direct URL to another account's plant ID**~~ — **done, passed**
   (confirmed by the user 2026-09-02). Logging in as another account and
   pasting a plant's `/registry/<id>` URL directly gives "Plant not found."
   via RLS, not a data leak. This was the only item here with an
   access-control failure mode rather than a cosmetic one.
2. **Direct URL to a nonexistent plant ID** — same expected result.
3. **Reload persistence for photos** — upload a reference photo, refresh
   the page, confirm the thumbnail still renders (exercises the signed-URL
   fetch on a fresh load, not just in-session state).
4. **Multiple plants, alphabetical ordering** — add 2-3 plants with
   different common names, confirm the Registry list sorts by name.

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

**Tasks (out of the MVP commitment as of 2026-09-03):**
- The whole task system — care task templates, triggers, completion logging,
  one-off todos — is **built and live, but outside what the MVP promises**.
  A different status from Landmark's: this one exists and works. Don't
  re-litigate the cut, and **don't delete the code** — see "Scope change" at
  the top of this doc for the retention rule and the file list.

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
- No per-Planting task overrides; task timing lives on Plant only
- Two task trigger types only: fixed date-range, freeform seasonal-marker
- Task completion keyed by template + Planting + year (all three needed)
- Bezier-pen is in scope for the bed editor, alongside freehand and
  rectangle/oval — all three validated in the ADR-0001 prototype

### Open, but not blocking

- ~~Which OCR: on-device or a cloud API?~~ **Resolved by ADR-0004** (see the
  #19 entry in "What to do next" above): on-device, Apple's Vision
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
