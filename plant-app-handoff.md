# Handoff: Personal Garden Plant Registry — plant-app

**Date:** 2026-08-31 (updated: #18's manual QA passed, all findings fixed)
**Repo:** `annetters/plant-app` · branch `main`

---

## What to do next

**#18 (Native: Plant/Planting detail, tasks & todos) has now been manually QA'd by the user directly on a real device, every finding from that pass is fixed, and the full monorepo suite is green — not yet closed on GitHub, that's the next action.** See "Previous entry, superseded above" below for what was originally built; this entry covers the QA round on top of it.

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

## What to do next

**#17 (Native: Bloom Timeline) is now fully closed on GitHub** — phone
parity for the Bloom Timeline, implemented and manually QA'd by the user
directly on a real device via the dev client (not Playwright — this is a
native RN screen, no browser involved). See the closing comment on the
issue for full detail.

Built (commits `51c9bf5`, `bd2214b`): a new mobile `BloomTimelineScreen`
porting web's year-view chart + month-filtered list, both filterable by
Bed, straight from `packages/domain/src/bloomTimeline.ts` (zero domain
changes needed — `buildBloomTimelineBars`/`filterBloomTimelineBarsByMonth`
already handled everything, including wrap-around bloom windows like
Nov 15 → Feb 15). Reused the four read-only repositories built for #16
(Registry) unchanged — no new repository/context files. The year-view
chart's horizontal scroll is a bare `ScrollView horizontal`, no new native
dependency (`react-native-reanimated`/`gesture-handler` considered and
deliberately deferred — see the "Future idea" note in
`BloomTimelineScreen.tsx`, since nothing in the acceptance criteria asked
for snap/velocity effects beyond default momentum scrolling). Extracted
Registry's private `ChipRow` into a shared `apps/mobile/src/components/
ChipRow.tsx` since both screens needed the identical chip-filter UI.

**Confirmed safe to build concurrently with #12** before starting — both
of #17's blockers (#9 Bloom Timeline web, #13 RN scaffold) were already
closed, and #12's in-progress changes at the time touched nothing #17
needed (confirmed via file-level diff review, not assumed).

A `/code-review` pass caught and fixed two real bugs before this landed:
wrap detection compared pixel offsets (`endPx < startPx`) instead of using
the domain's own `bloomWindowWraps`, which could misfire when a wrapping
window's start/end landed on equal pixel offsets (e.g. a bloom window
running June 1 → May 31); and the "No Beds yet" hint could show during an
actual Beds-fetch error, not just when there really were no Beds. Both
fixed with regression tests.

**Manual QA on a real device found one more real bug, missed by both the
initial port and code review**: a lone chart bar (single Plant, blooming
in May) was nearly invisible — the native port had dropped web's visible
track rail (`.bloom-bar-track`'s background + border) and its per-row
month tick marks entirely, keeping only the bar itself. With nothing else
drawn on the track, an empty stretch of the horizontal scroll looked
identical to a broken render — there was nothing to anchor the eye to
"this is a timeline." Fixed (`bd2214b`) by restoring both, matching web's
`.bloom-bar-track`/`.bloom-month-tick`. A second report during the same QA
pass turned out not to be a bug — scrolling itself always worked; the
"track and label are side by side" description was just pointing out that
an earlier checklist item's wording ("scrolls underneath") didn't match
what was actually a correct, non-overlapping two-column layout. A
speculative `flex: 1` fix made in response to the misread was reverted
before committing, since it wasn't addressing a real problem.

**Process note for next time**: mid-QA, the user corrected an over-eager
commit — a QA-found fix had been committed without checking in first,
while the user was still the one driving the pass. Recorded as a standing
rule: fix and verify QA findings, but don't commit until the user says the
pass is done, even when an earlier instruction in the same session said
"commit your work" for the implementation that preceded QA.

**Deferred, not run**: testing with iOS's Larger Text / Larger
Accessibility Sizes turned up. `BloomTimelineScreen.tsx` uses fixed pixel
constants (`ROW_HEIGHT`/`LABEL_WIDTH`/`AXIS_HEIGHT`/`CHART_WIDTH`) rather
than web's CSS-percentage layout, so this needs a real check for
truncation/clipping at larger text sizes — not yet done.

Full monorepo typecheck/test suite green throughout (209 domain + 97
mobile + 188 web at close).

**#17's closure doesn't unblock anything new** — confirmed directly
against the API: no open issue lists #17 as a blocker. **#14, #15, #18**
remain frontier (all already unblocked independent of #17). Whoever
resumes next should pick one of those — this doc doesn't prescribe which.

**Pushed to `origin/main`** — `bd2214b` is the tip as of this update.

---

**Previous entry, superseded above** — **#12 (Task completion logging, history, and one-off todos) is now fully
closed on GitHub** — implemented and manually QA'd by the user directly
against the real linked Supabase project (dev server, not Playwright). See
the closing comment on the issue for full detail.

Built (commit `b8f5158`): `packages/domain/src/taskCompletion.ts`/
`oneOffTodo.ts` (validation, row mapping, `buildPlantingTaskHistory` —
always one entry per Care task template per Planting per year), new
`task_completions`/`one_off_todos` tables (migrations `0019`-`0022`,
pushed and live), and web UI: a `TasksPage` (one-off todos + a list of
Plantings linking to their own task history) and
`PlantingTaskHistoryPage` (mark done/missed per template, per year).
Reachable from the Dashboard via a plain link, not a fourth tile.

A `/code-review` pass (10 finder agents) caught two real issues before
this landed: `recordTaskCompletion` did a racy select-then-insert-or-
update instead of a single upsert against `task_completions`' own unique
constraint (fixed); and the already-built `validateTaskCompletionInput`
was never wired in, so a cleared/non-numeric year field could reach the
DB with only a generic error (fixed). Also split the original combined
repository into `TaskCompletionsRepository`/`OneOffTodosRepository`,
matching this codebase's parent/child repository convention rather than
bundling two unrelated aggregates in one.

**Manual QA** covered every acceptance criterion plus edge cases: N
templates producing N history rows (0 for a Plant with none, verified
against a real Plant before/after adding templates); marking done/missed
and persistence across reload; per-year scoping; one-off todo add/toggle/
remove; the Dashboard link rendering as a plain link, not a tile;
double-clicking "Mark done" (no error, no duplicate row); and the
Planting-vs-Plant scoping — a Plant's Care task templates only produce
task-history entries once that Plant has an actual Planting (a Pin on the
map), confirmed via the Plant's own edit page rather than assumed. No
real product bugs surfaced during QA. **Process note for next time**:
bare `supabase db push` fails with "command not found" (the CLI is a
local devDependency, not a global install) — use `npx supabase db push`
or `npm run db:push` instead.

Full monorepo typecheck/test suite green throughout (209 domain + 78
mobile + 188 web at close).

**#12's closure newly unblocks #18** (Native: Plant/Planting detail,
tasks & todos) — confirmed directly against the API (`blocked_by: 0`,
unassigned; it needed #2/#7/#12/#13, all now closed). **#14, #15, #17**
remain frontier, unaffected by #12's closure. **A concurrent session is
already working on what looks like #17** (Native: Bloom Timeline —
`apps/mobile/src/bloomTimeline/`, a new shared `apps/mobile/src/
components/ChipRow.tsx`, staged but not yet committed as of this update)
— don't pick that up again; whoever resumes next should choose a
different frontier ticket (#14, #15, or #18).

---

**Previous entry, superseded above** — #16 (Native: Registry view) is now fully closed on GitHub** — phone
parity for the Registry, manually QA'd by the user directly on a real
device against real Plant/Bed/Planting data. See the closing comment on
the issue for full detail.

Built (commit `103091b`): a new mobile `RegistryScreen` matching the web
Registry's filter/search axes (search, flower color, bloom month, sun
requirement, foliage type, native status, all combinable — reuses the
same `filterRegistryEntries` from `@plant-app/domain` web already uses),
wired from the Dashboard's Registry tile. New read-only mobile
Plants/Beds/Plantings/Properties repositories, mirroring web's pattern
but trimmed to list/get only.

**Scoping call, not a gap**: there's no native Map screen yet (#14 is
still unbuilt), so a Planting's location shows as plain "In [Bed name]"
text rather than a live link to a map that doesn't exist yet — same
reasoning as web's `/map?plantingId=` link, just without a target to jump
to. Once #14 ships, this can become a real navigation target.

A `/code-review` pass caught one real issue before QA: `formatOption`/
`MONTH_NAMES`/`formatMonthDay`/`plantLabel` had been copy-pasted from web
rather than shared, and the mobile copy had already silently drifted
(dropped web's undefined-Plant fallback). Fixed by moving all four into
`packages/domain` and repointing both apps at the shared source.

**Manual QA** by the user on a real device, against an account with real
Plant/Bed/Planting data, found and fixed two real bugs (commit
`e0b5ede`): list-item borders too light to see (`#eee` → `#ccc`), and no
way to clear the search/flower-color fields except repeated backspace
(added iOS's native `clearButtonMode`). A third report — Foliage/Native
status filters returning 0 results for everything — turned out not to be
a bug: confirmed via the web app's own Plant edit form that those fields
were genuinely never set on the affected Plants (skipped as optional
during manual entry). The underlying UX gap this exposed — a zero-match
filter result can't distinguish "no matches" from "field never set" — is
filed as **#27** (`needs-triage`), not blocking anything.

Full monorepo typecheck/test suite green throughout (209 domain + 78
mobile + 166 web).

**#16's closure doesn't unblock anything new** — confirmed directly
against the API: **#12, #14, #15, #17** were already frontier
(`blocked_by: 0`, unassigned) independent of #16. **#18** remains blocked
(`blocked_by: 1`, still needs #12). **A concurrent session is already
working on #12** — don't pick it up again, whoever resumes next should
choose a different frontier ticket (#14, #15, or #17).

---

**Previous entry, superseded above** — #20 (Tag Scan build) is now fully closed on GitHub** — the real-device
manual QA checklist (the one remaining item from this doc's prior entry)
was run end-to-end on a physical iPhone via the EAS dev client, and all six
items passed: front/back capture, manual entry, species lookup, the
ambiguous-common-name picker, duplicate-Plant detection (including "create
anyway"), and the suggested-traits accept/skip screen. See the closing
comment on the issue for full detail.

**Getting a working dev client onto the phone took real, unplanned
debugging this session**, separate from #20's own QA — worth knowing about
since it's now written up as a permanent troubleshooting section in
`apps/mobile/README.md` ("Troubleshooting: dev client won't connect"):
`scripts/setup-tag-ocr-dev-client.sh` never actually installs
`expo-dev-client` in any of its 7 stages, so the dev client built during
#22 was never a real dev client — it only ever appeared to work because it
was driven live from Xcode's ▶ Run each time. Diagnosed via the exact `RCTFatal`/"No
script URL provided" crash plus Expo CLI's own "Ensure expo-dev-client
package is installed" warning. Fixed this session (`npx expo install
expo-dev-client` + `npx expo prebuild --clean` + reinstall via Xcode) —
that fix (`apps/mobile/package.json`/`package-lock.json`), along with the
README troubleshooting section, is committed — `58a23dc`. The setup
script itself still has the underlying gap (never runs `npx expo install
expo-dev-client`) and hasn't been patched — worth doing before anyone
else runs through that wizard fresh.

Two real bugs surfaced during the device QA itself, both fixed, tested, and
already committed/pushed/deployed:
- **`usda-plant-traits`'s common-name search required an exact match**
  against USDA's `commonName` field, but USDA's values are always
  adjective-qualified compound names ("common sunflower", "garden tomato")
  — a bare word a user naturally types (sunflower, tomato, daisy, phlox,
  false indigo) could never match, silently returning a clean but wrong "no
  match" every time. The exact same mistake was independently duplicated
  client-side in `resolveCommonName`, re-filtering the server's (once
  fixed) results against the same bare-word needle and discarding them
  again. Both fixed to substring matching. Commit `f057872`, redeployed.
- **The ambiguous-species picker ("Which one is this?") had no way to
  leave the screen** if none of the listed options matched the physical
  tag — no Cancel/back button, and the app's `headerShown: false` (global,
  set in #13 to fix a real notch/safe-area bug) meant no default back
  button either. Fixed with a "Go back and edit" link back to Review
  (`navigation.goBack()`, preserves captured photos), matching the existing
  pattern on `TagScanDuplicateOfferScreen` for the same kind of situation.
  Commit `724df5f`. Deliberately did **not** touch the global
  `headerShown: false` setting itself to fix this — filed separately as
  **#26** (`needs-triage`) since re-enabling native headers risks
  reintroducing #13's regression across the whole app, not just one
  screen; the user specifically asked to revisit this later, not now.

Full monorepo typecheck/test suite green throughout (187 domain + 65
mobile). **Pushed to `origin/main`** — `724df5f` is the tip as of this
update.

**#20's closure doesn't unblock anything new** — confirmed directly against
the API: **#12, #14, #15, #16, #17** are all already frontier
(`blocked_by: 0`, unassigned) independent of #20. **#18** remains blocked
(`blocked_by: 1`, still needs #12). **#26** is `needs-triage`, not blocking
anything. Whoever resumes next should pick one of the frontier tickets —
this doc doesn't prescribe which.

---

**Previous entry, superseded above** — #20 (Tag Scan build)'s
`usda-plant-traits` Edge Function is now
deployed and smoke-tested; #20 is still open, one item left.** Checked
live rather than trusting this doc's own prior "still needed" claim (which
turned out to be stale): migrations `0009`/`0010` were already live
(`npx supabase migration list` shows local=remote through `0018`), so the
only real gap was the Edge Function itself — confirmed via
`npx supabase functions list`, which showed only `create-property`/
`search-addresses` before this update. Deployed with `npm run
functions:deploy` (blocked by the auto-mode permission classifier as a
live-deploy action; user approved explicitly before it ran). Smoke-tested
the same way `create-property`/`search-addresses` were, against a fresh
throwaway test account (signup returns a session immediately — email
confirmation is off, no Property/DB rows touched, account itself remains,
same no-service-role-access limitation noted on prior sessions' QA):
CORS preflight (204, correct `Access-Control-Allow-*` headers), missing
auth (`{"error":"Not authenticated."}`), malformed JSON body (400), both
`scientificName`/`commonName` provided at once (400, exactly-one-of
guard), a real authenticated lookup against *Digitalis purpurea* (a known
exact USDA match per ADR-0004's own prototype validation — returned real
characteristics data, e.g. `Temperature, Minimum (°F): -13`), and a real
lookup with no match (clean `{"species":[]}`, not an error — matches the
"no match is a routine outcome" design). All passed.

**Still needed before #20 can close**: a real-device manual walkthrough of
the mobile Tag Scan flow, via the custom EAS dev client built in #22 (not
Expo Go — Expo Go can't run the native Vision OCR module) — front/back
capture, manual entry, species lookup + ambiguous-species picker,
duplicate-Plant offer (including the "create anyway" override), and the
USDA-suggested-traits screen (now backed by a live, verified function
rather than an undeployed one). None of this has been exercised outside
Jest's fake DB client as of this update.

**PAUSED HERE mid-QA, resume by asking the user for their results** — the
user has the dev-client app open on their phone (`npx expo start
--dev-client` running, same Wi-Fi as the Mac, per
`apps/mobile/README.md`'s "Day-to-day workflow") and was handed this
six-item checklist to work through at their own pace, with no results
reported back yet:
1. Capture a real tag (front required; try both "photograph the back" and
   "Skip — no back photo" across different tags).
2. Manual entry — type common/scientific name by hand, confirming the
   fallback still works even when OCR fills something in.
3. Species lookup button — hits the now-deployed `usda-plant-traits`
   function; either suggested traits or a clean "not found" are both valid
   outcomes, just shouldn't error/hang.
4. Ambiguous-common-name picker (try a common name spanning multiple
   species, e.g. "sage").
5. Duplicate-Plant detection against a Plant already in the Registry,
   including the "create anyway" override.
6. Accept vs. skip the suggested-traits screen, confirming the right thing
   lands on the saved Plant either way.

When the user reports back: if all six pass cleanly, that's the last item
needed to close #20 — see the closing pattern used for #6/#8/#9/#10/#22
(GitHub closing comment summarizing the full QA, commit reference if any
code changes were needed, then updating this doc's "Issue tracker"
frontier query — #20's closure doesn't unblock anything new, since nothing
lists it as a blocker). If something fails, fix it, re-verify, and only
close once it's genuinely clean, same as every prior ticket in this repo.

---

**#11 (Dashboard, real content) is implemented, manually QA'd by the user
directly against the dev server (not Playwright), and closed on GitHub** —
see commit `8bd93e5` and the closing comment on the issue for full detail.
Both acceptance criteria turned out to already be structurally met by
#7/#8/#9/#10: each of those tickets landed its own real page and updated
the Dashboard's routing as it went, so by the time #10 closed, Map,
Registry, and Bloom Timeline were already routing to real content rather
than a placeholder — and the task/todo-list criterion is vacuously true
since #12 (which would add them) isn't built yet. The actual work this
ticket did was finishing that migration for real: removed the now-dead
`ComingSoonPage`/`ROUTED_TILE_IDS` fallback-route mechanism (T1's original
placeholder scaffolding), since every Dashboard tile now has a real route
and the fallback generator produced zero routes — pure dead code by the
time this ticket picked it up. A `/code-review` pass caught a real
regression risk in that removal: deleting the fallback generator also
silently removed the app's only safety net for any future unrouted path
(would have rendered blank instead of a message) — fixed by adding a
small, tested catch-all `NotFoundPage` + `path="*"` route to cover that
case going forward. QA'd manually by the user: all three Dashboard links
work, and the new 404 page shows correctly for a bad URL both logged-in
and logged-out (including "Back to Dashboard" correctly bouncing a
logged-out visitor to the login page). Full monorepo typecheck and test
suite green throughout (186 domain + 64 mobile + 166 web).

**#11's closure newly unblocks #12 (Task completion logging)** — confirmed
directly against the API (`blocked_by: 0`, unassigned). **#18** (Native:
Plant/Planting detail) still needs #12 in addition to #3/#8/#13, so it's
not frontier yet — confirmed `blocked_by: 1`. **#14, #16, #17** remain
frontier, unaffected by #11's closure.

**Pushed to `origin/main`** — `git log origin/main..HEAD` is empty as of
this update, confirmed directly.

---

**#10 (Registry view) has now been manually QA'd by the user directly (not
Playwright) against the real linked Supabase project, all four deferred QA
items pass, and it's closed on GitHub** — see the closing comment on the
issue for the full detail. Real QA surfaced three genuine UX/layout gaps,
all fixed and committed (`37438dc`, on top of the original `029fc9c`):
a filter match was invisible in the results (only common/scientific name
shown, no way to see *why* something matched without trusting the filter
logic blind) — fixed by showing each Plant's matching attributes (flower
color, bloom window, sun/shade, foliage, native status) inline, extracting
a shared `formatMonthDay` out of `BloomTimelinePage.tsx` into
`apps/web/src/monthDay.ts` along the way; the "View in \<Bed> on the map"
link read as a disconnected, unrelated list floating below its Plant
(inherited `main ul`'s generic top-level list spacing with nothing
grouping it under its Plant) — fixed with a scoped, indented style; and the
filter fieldset's six fields stacked jaggedly at phone width, root-caused
to the fieldset layout CSS being scoped to `form fieldset` while the
Registry's filter fieldset has no `<form>` (nothing to submit) — broadened
the fieldset/label/input CSS to apply regardless of a `<form>` wrapper, and
grouped each field into its own `<div>` (the same technique the Plant
form's date-range pairs already use) so flex-wrap can't split a label from
its control. Full monorepo typecheck and test suite green throughout (186
domain + 64 mobile + 165 web).

Also recorded in `CLAUDE.md` this session (`a58e6b7`): before starting a
QA pass, check with the user whether *they* want to run it or want it
Playwright-automated — don't assume automation. (A previous instruction in
this same doc already covers the adjacent "check with me first before
starting work" case; this is the QA-specific corollary.)

**#10's closure newly unblocks #11 (Dashboard, real content) and #16
(Native: Registry view)** — confirmed directly against the API
(`blocked_by: 0`, unassigned, on both). #11 needed #7/#8/#9/#10, all now
closed. #16 needed #10 and #13, both now closed. **#14** and **#17** were
already frontier (see below) and remain unaffected by #10's closure.

**Pushed to `origin/main`** — `git log origin/main..HEAD` is empty as of
this update, confirmed directly.

---

**#6 (Property: photographed/in-app-drawn base map + Scale Reference) is
implemented, manually verified end-to-end against the real linked Supabase
project, and closed on GitHub** — see the closing comment on the issue for
the full acceptance-criteria checklist. Initial implementation committed
`6f891ff` (22 files); `/code-review`'s two-axis pass caught and fixed one
real bug pre-commit (`BaseMapSetup` calibrating Scale Reference against a
512px canvas while the rest of the stack rendered at 768px — every Bed/Pin
on a photo or drawn base map would have landed ~1.5x off; fixed via one
shared `STAGE_SIZE_PX` constant).

**Scope grew substantially during live QA, driven by real user feedback**
(commits `70c8a9e`, `d6baeb3`, `ffbc807`): the original design only offered
photo/drawn base maps as a fallback once an address's aerial imagery came
back unavailable. QA surfaced that "usable" imagery is subjective (outdated,
tree-obscured, too low-res — not just present/absent), and some gardeners
want to skip geocoding their address entirely for privacy. Reworked so
base-map source is a free, one-time choice offered up front at Property
creation (aerial / upload / draw), identified by a new `name` field when
there's no address. The original aerial-unavailable fallback still works
unchanged. Along the way, live QA (not the unit suite, which stubs Konva
and the DB client) caught and fixed several more real bugs: migration
`0017` had already been pushed to the real project by a concurrent session
before this rework started, so amending it in place silently never reached
the database (Supabase tracks migrations by filename, not content) — the
new flow 400'd on save with **no visible error**, because a CSS rule only
styled alerts nested inside a `<form>` element and this new flow didn't use
one. Fixed by reverting `0017` to its originally-applied content, moving
the schema changes to a new `0018` (now pushed and confirmed live), and
broadening the alert-styling CSS rule to cover every error in the app, not
just form-nested ones. Also fixed: `.property-page`'s own 640px width cap
(tuned for #5's address form, before this ticket's 768px drawing canvas
existed) was clipping the canvas; removed in favor of `#root`'s existing
page-wide bound. And a redundant standalone 512px aerial thumbnail on the
Property page — which #7 had since made obsolete by rendering the same
imagery natively behind the Bed editor's own canvas — was removed entirely.

Full monorepo typecheck and test suite green throughout (186 domain + 64
mobile + 164 web at close).

**Filed during QA, not part of #6, not blocking anything**: **#24**
(`needs-triage`) — Bed drawing's rectangle/oval tools can't be rotated,
relevant when a base map isn't axis-aligned to the canvas. **#25**
(`needs-triage`) — `PlantingMap`'s full map canvas renders even before any
Bed exists, when it's entirely non-functional; a fix is scoped in the issue
but deliberately not applied.

**#6's closure newly unblocks #15** (Native: Scale Reference calibration —
confirmed directly against the API, `blocked_by: 0`; it needed #6 and the
already-closed #13). **#10** (Registry view) remains implemented and
committed but still has its own deferred manual QA queued as the user's
next-time to-do — see "Deferred QA (ticket #10)" below. **#20** remains
implemented but intentionally held open pending its own deploy/QA pass (see
its entry further down). **#21** is still `needs-triage`.

---

**#10 (Registry view) is implemented, code-reviewed, fully tested, and
committed (`029fc9c`), but has zero manual/visual verification yet — the
user can't QA right now, so this is queued as their next-time to-do.** A
gardener can filter/search the full Plant list by name, flower color,
bloom month, sun/shade, foliage type, and native status — all combinable
— via `filterRegistryEntries` in `packages/domain/src/registry.ts`, and
jump from any Registry entry with a Planting straight to that Planting's
details on the map via a new `?plantingId=` query param `PropertyPage`/
`PlantingMap` read on load. Domain-logic test matches the ticket's own
acceptance criterion (combined-axis filtering). Full monorepo typecheck
and test suite green (182 domain + 64 mobile + 157 web) — verified both
normally and in an isolated disposable worktree, since this session's
working tree already had ticket #6 sitting uncommitted in some of the
same files (`PlantingMap.tsx`, `PropertyPage.tsx`, `domain/index.ts`);
`029fc9c` contains only #10's changes, layered cleanly on top of true
`HEAD`, not on top of #6's pending work. A parallel `/code-review` pass
(5 finder angles) caught and fixed one real bug before this landed: the
map's auto-select-from-Registry effect re-fired whenever the Plantings
list changed reference for *any* reason (e.g. an unrelated Planting
created elsewhere), silently reopening a details panel the gardener had
just closed — fixed with a ref tracking which Planting id has already
been auto-opened, plus a regression test. Also extracted three small
helpers this ticket's new code duplicated from existing files
(`MONTH_NAMES`, `formatOption`, `plantLabel`) into shared modules, and
memoized the Registry's Plant-to-Planting-locations lookup to avoid an
O(plants × plantings) rescan on every render/keystroke.

**Pushed to `origin/main`** along with #6 and this doc's own update commits
— see "Current state" below for the full picture.

**Manual QA checklist for whoever resumes** (none of this has been run
yet — see "Deferred QA (ticket #10)" below for the full list):
1. Filter/search, alone and combined, against real Plant data.
2. The Planting-location map link — opens the right Planting
   automatically, including a Plant with multiple Plantings and a Plant
   with none.
3. Degraded states — no Property/Beds yet, a `?plantingId=` for a since-
   deleted Planting.
4. Phone-width layout and cross-browser (Safari/WebKit) — this repo's
   history has real instances of both classes of bug slipping past desktop-
   Chromium-only checks (#9's phone-width chart, #5's WebKit-only dropdown
   bug).

---

**#9 (Bloom Timeline) is implemented, fully manually verified by the user,
closed on GitHub, and pushed to the remote.** A gardener can view a
year-view horizontal bar chart
of Plant bloom windows (`BarTrack` in
`apps/web/src/routes/BloomTimelinePage.tsx`) and an equivalent
month-filtered list view — the same underlying `BloomTimelineBar[]`
(`buildBloomTimelineBars` + `filterBloomTimelineBarsByMonth` in
`packages/domain/src/bloomTimeline.ts`), no separate data model — both
filterable by Bed.
Domain-logic test matches the ticket's own acceptance criterion: a bar's
start/end always equals its Plant's actual bloom window.

Built across one implementation commit plus six follow-up commits, all
but the first from a live QA round — an automated Playwright-driven pass
against the real linked Supabase project, then the user's own manual
click-through, the pattern this repo now leans on for every ticket:

- `08d3851` — initial implementation.
- `81ad8eb` — the chart's own CSS didn't exist yet (caught before any QA
  even started, by rendering the real markup against the real
  `index.css` in a standalone Playwright screenshot rather than trusting
  the code) — bars would have rendered as invisible zero-height `<div>`s.
- `c7eccb0` — three real bugs found by live QA: a single `.catch()`
  mislabeled a Property-fetch failure as "Could not load your Beds."
  (split into two accurate messages, matching `PropertyPage`/
  `BedEditor`'s existing wording); the chart had no visible date
  reference beyond a hover tooltip (added a month-label axis, reusing the
  bar's own day-of-year math); nothing pointed to where Beds are created
  when none exist yet (added a "No Beds yet — draw one on the Map" link).
- `f70eb38` + `c41c5be` — the user found "All Beds" (the filter's default
  option) confusingly implied "union of every Bed's Plants," when
  unfiltered actually means "every blooming Plant in the Registry,
  planted or not." Relabeled to "None selected," and pinned the
  underlying semantics down in `CONTEXT.md`'s Bloom Timeline entry via
  `/domain-modeling`, so a future #17 (Native: Bloom Timeline) or #11
  (Dashboard) implementer doesn't assume the opposite.
- `01e1868` — phone-width (~375px) manual QA found the chart running
  flush to the screen edges (bare `<main>` gets no padding anywhere else
  in `index.css`; only `main:has(form)` does) and all 12 month-axis
  labels overlapping into unreadable mush. Fixed with a scoped
  `.bloom-timeline-page` padding rule and a `<=480px` media query that
  narrows the label column and thins the axis to every other month.
- `24cf78e` — Even with the thinned axis, text labels alone (especially
  only 6 of them on mobile) don't give a visual grid to judge a bar
  against — hard to tell how many month-blocks a bar spans just by
  eyeballing it against distant axis text. Added month tick marks
  directly on each bar's own track (all 12, reusing the axis's
  day-of-year percentages), so counting works right against the bar
  itself at any width. Verified via the standalone Playwright-screenshot
  technique (375px/900px, light/dark), **and confirmed by the user
  themselves afterward** — "the tick marks look better."

**Manual QA checklist status** (the user ran this by hand in a real
browser against the dev server, `localhost:5183`) — **all items now
pass**:
- **A. Bed filter narrows the chart/list to only that Bed's Plants** —
  passes.
- **B. Filter carries over between Chart view and List view** — passes.
- **C. Phone-width layout** — failed twice during QA (padding/overlap,
  then "hard to tell month-blocks without ticks"), fixed both times (see
  `01e1868`/`24cf78e` above), **and the tick-marks fix is now confirmed
  by the user directly.**
- **D. Cross-browser (Safari)** — passes.

**#9 is closed on GitHub and pushed to `origin/main`** — `git log
origin/main..HEAD` is empty as of this update, confirmed directly. Its
closure newly unblocks **#17** (Native: Bloom Timeline, which needed #9
and #13, #13 already closed) — confirmed `blocked_by: 0` directly against
the API. It does not yet unblock **#11** (Dashboard), which also still
needs #10 (Registry view, frontier but not yet built). See "Issue
tracker" below for the full updated map.

---

**#22 (Tag Scan: on-device Vision OCR + EAS dev client migration) is
implemented, verified end-to-end on a real iPhone against the real linked
Supabase project, and committed** (`9fd6d6f`, `b75dafd`, `675ea1f`,
`83565dc`, on top of the earlier `dc33e47`/`01b0c36`) — **not yet closed on
GitHub, that decision is still open, see below.** A gardener can
photograph a real nursery tag on a real device, have Apple's on-device
Vision framework read real text off the photo, and reach a working Review
screen — this session took that from "written but never run" all the way
through a real Plant actually being saved. Device setup itself (macOS
non-admin/Homebrew permissions, Xcode signing, the custom dev client
build) is fully documented in `apps/mobile/README.md`'s "Native dev
client" and new "Day-to-day workflow" sections — not repeated here.

**Two real bugs in the original `dc33e47` implementation, found only by
actually running it on a device** (neither was, or could have been, caught
by the unit test suite, which mocks the native module entirely):

- **The native module never actually linked into the compiled app at
  all** — `getTagOcrAdapter()` silently fell back to `manualEntryAdapter`
  every time, with zero indication anything was wrong (blank Review-screen
  fields look identical whether OCR is unavailable or just found nothing).
  Root cause was two separate gaps: `modules/tag-ocr` had no `package.json`,
  so npm never made it a discoverable local package for CocoaPods
  autolinking to find (fixed by adding one and registering it as an
  `apps/mobile` dependency via `"tag-ocr": "file:./modules/tag-ocr"`); and
  its podspec declared a 16.4 iOS minimum against the project's actual 15.1
  deployment target, so even once discoverable, CocoaPods silently excluded
  it with no warning printed anywhere in `pod install`'s output. Nothing in
  `TagOcr.swift` actually requires iOS 16.4 — lowered to 15.1 to match.
  Diagnosing this took genuinely deep tracing (temporary debug logging in
  the JS adapter, then patching the gitignored `Podfile` itself to dump
  CocoaPods' internal resolved-package list) before the platform-mismatch
  root cause surfaced — worth knowing this class of "silently excluded,
  no error anywhere" failure exists in Expo's autolinking if a future local
  module has the same problem.
- **No way to leave the Capture/Review screens once entered** — the whole
  app has `headerShown: false` (deliberately, fixes a real notch/safe-area
  bug from #13 — not reverted), and neither screen had its own Cancel.
  Fixed with a Cancel button on each, back to Dashboard.

**Also fixed, smaller UI gaps found live**: "Look up species" had no
visual styling at all (unlike every other button on the screen), reading
as plain unstyled black text easy to mistake for a disabled label — now
matches the app's existing secondary-button outline style. Neither app had
any way to see which account was currently logged in — added "Signed in as
[email]" to both Dashboards (needed mid-session to confirm the phone and
the browser were on the same account).

**What real Vision OCR actually produced**, first attempt, photographing a
real Agastache 'Blue Fortune' tag (front side only, per the guided
capture's own design — OCR only ever reads the front photo): 8/8 lines
recognized correctly and legibly ("US NATIVE", "PERENNIAL", "FULL SUN",
"ATTRACTS BUTTERFLIES", "DEER RESISTANT", "DROUGHT TOLERANT", and
`¡BLUE FORTUNE•` — Vision misread the cultivar's actual surrounding quote
marks as an inverted exclamation point and a bullet). Zero Tag Scan
candidates resulted — `parseOcrTextLines` only ever extracts a scientific
name from a strict, isolated "Genus species" line, by deliberate ADR-0004
design (common-name text was found too unreliable across the original
8-tag prototype sample to guess), and this real tag's front side never
printed an isolated scientific-name line for it to match. **Filed as
`#23`** (`needs-triage`, blocked by #22, not linked as a GitHub sub-issue
of #1 — same ad hoc pattern as #21) with a follow-up comment once the
quote-misread detail was noticed: `STANDALONE_CULTIVAR_PATTERN` already
supports extracting a quoted cultivar from its own line, so the gap isn't
only "no scientific name" but also that its accepted quote-character class
doesn't cover what Vision produced here. Not blocking #22 — manual entry
(the designed complete fallback) is exactly what got exercised instead,
successfully: typed the real common name and scientific name by hand,
tapped Continue, and a real Plant row was confirmed saved via the web
app's own Registry page against the same Supabase project.

**Not exercised this session** (would need another real tag or more
time): a tag whose front side *does* print an isolated scientific-name
line (to confirm auto-population actually works, not just the manual
fallback); the ambiguous-species picker and duplicate-Plant-offer screens
against real data; the suggested-USDA-traits screen (the one lookup
attempted this session failed — see #23's context, a genus name was typed
into Common name by mistake before the cultivar-vs-common-name confusion
was caught).

**Still open: whether to close #22 on GitHub.** The core acceptance bar —
native Vision OCR built, linked, and proven against real device output,
with manual entry as a genuinely working fallback — is met. **#20** is a
separate ticket and still has its own unresolved "before closing" items
(migrations `0009`/`0010` push status and the `usda-plant-traits` Edge
Function deploy — neither touched this session; verify before assuming
either is done) — don't conflate the two when deciding what to close.

---

**#8 (Planting: create + place Pin, view on tap) is implemented, manually
verified end-to-end against the real linked Supabase project, and closed on
GitHub** — see commit `3041ca3` and the closing comment on the issue for
full QA detail. A gardener can create a Planting against a Plant (quantity,
year acquired, source/nursery), place its Pin by dragging directly onto the
map with no manual coordinates (a point-in-polygon check against each Bed's
own outline resolves which Bed it landed in — `findBedContainingPoint` in
`packages/domain/src/planting.ts`), tap an existing Pin's list entry to view
its details, and attach a dated photo log. New `plantings`/`planting_photos`
tables (migrations `0013`-`0016`, pushed and live), RLS via ownership-through-
join (Planting -> Bed -> Property, matching Beds' own join to Properties), a
private `planting-photos` storage bucket, and `PlantingMap.tsx`
(`apps/web/src/plantings/`) wired into `/map` alongside `BedEditor` — unlike
Bed drawing, Pin placement is **not** gated to desktop, per CONTEXT.md's Pin
entry ("works identically on desktop and phone"). Domain-logic test matching
the ticket's own acceptance criterion: a Planting with quantity 24 maps to
exactly one row with `quantity: 24`, never 24 rows.

A real, Playwright-driven QA pass against the real linked Supabase project
(fresh throwaway account, same pattern as prior tickets) caught and fixed
two real bugs before this landed, the kind unit tests (which mock Supabase
and stub Konva entirely) couldn't have caught:
- **PlantingMap's canvas never actually resolved any Pin** — its container
  div was conditionally rendered behind `beds.length > 0`, but the Konva
  stage-mount effect only depends on the Property's scale (`pixelsPerFootValue`),
  not on Beds, so it ran once on mount, found the container still absent
  whenever the Property's Beds hadn't loaded yet, and left its stage/layer
  refs permanently null even after Beds arrived — no Pin could ever resolve
  into a Bed, since the effect that resolves one never re-ran. Surfaced as
  "Save Planting" staying disabled no matter where the pin was dropped.
  Fixed by always mounting the map surface once there's a scale to draw
  against, and gating only the "Draw a Bed first" messaging on `beds.length`.
- **Beds drawn in the sibling `BedEditor` were invisible to `PlantingMap`
  until a full page reload** — the two components independently fetched
  their own Bed list with no shared state, so a Bed drawn and saved in the
  editor didn't unlock Pin placement until reloading the page. Fixed by
  lifting the Bed list to `PropertyPage`: `BedEditor` now takes an optional
  `onBedsChange` callback, and `PlantingMap` accepts an optional `beds` prop
  to use instead of self-fetching (falls back to self-fetching when omitted,
  which is what its own unit tests rely on).

Also fixed, from a parallel code-review pass: removing a Planting orphaned
its uploaded photo files in storage (the `planting_photos` rows cascade-
deleted via the FK, but nothing ever cleaned up the files they pointed at —
`PlantingsRepository.remove()` now deletes storage objects first, mirroring
`PlantsRepository.removeReferencePhoto`'s storage-first ordering); a
duplicated Bed-outline-smoothing branch between `BedEditor` and
`PlantingMap` (extracted to a shared `renderedOutlinePoints` helper in
`apps/web/src/property/bedOutline.ts`, so Pin-drop containment can't drift
from what's actually drawn); a local variable shadowing the imported
`pixelsPerFoot` domain function; and the photo-thumbnail loader used
`Promise.all` (one photo's failed signed-URL request blanked out every
other already-successful thumbnail) — switched to `Promise.allSettled`.
Five lower-priority manual QA items were identified but deliberately
deferred, not run — see "Deferred QA (ticket #8)" below (real drag
gestures, touch/mobile, tapping the actual on-canvas Pin, cross-browser,
and a couple of edge cases).

**#8's closure newly unblocks #9 (Bloom Timeline), #10 (Registry view), and
#14 (Native: Map view — it needed both #8 and #13, #13 already closed)** —
confirmed directly against the API (`blocked_by: 0`, unassigned, on all
three). **#6** remains frontier, unaffected by #8. **#12** (Task completion
logging) still needs #11 (Dashboard) in addition to #8, so it's not
frontier yet. **#18** (Native: Plant/Planting detail) still needs #12,
still not frontier. See "Issue tracker" below for the full updated map.

**#7 (Bed drawing, desktop) is implemented, manually verified end-to-end
against the real linked Supabase project, and closed on GitHub** — see
commit `6173a57`. A gardener can draw a Bed outline on their Property's
aerial base map with freehand, rectangle/oval, or bezier-pen tools, toggle
pre-draw smoothing (freehand only, fixed strength per ADR-0001: decimate to
every 4th point, then 4 Chaikin passes), and have it persist across a
reload. All four tools normalize to the same `BedPoint[]` real-world-feet
outline representation (`packages/domain/src/bed.ts`) regardless of which
tool drew it — storage and rendering never branch on tool type except to
decide whether smoothing applies. New `beds` table (migrations
`0011`/`0012`, pushed and live), RLS via the parent Property (ownership-via-
join, same pattern as `care_task_templates`), and a Konva-based editor
(`apps/web/src/property/BedEditor.tsx`) wired into `/map`, gated to desktop
(non-touch, ≥900px) viewports only.

A parallel code-review pass (10 finder agents) caught and fixed several real
bugs before this landed — worth knowing about since they're the kind that
don't show up in unit tests:
- **The drawing canvas was never actually overlaid on the aerial imagery**
  it's meant to be traced against — two disconnected, differently-sized
  blocks (a 768px native canvas under the always-visible thumbnail's 512px
  CSS-capped display). Caught independently by three separate review
  agents. Fixed by rendering the aerial tiles again at native resolution
  directly behind the Konva stage when the editor is open, so both share
  one coordinate space — confirmed visually via the Playwright QA
  screenshots below.
- **A quick, short freehand drag (4-9 raw points) collapsed to a degenerate
  2-3 point sliver** under the fixed decimation strength, since
  `chaikinSmooth` no-ops below 3 points. `smoothBedOutline` now skips
  decimation when there aren't enough raw points for it to leave a
  recognizable shape (`MIN_POINTS_TO_DECIMATE` in `bed.ts`), falling back
  to running Chaikin on the raw points directly.
- **Pen-tool draw state leaked across a Close/reopen cycle** — a
  `useRef`-held in-progress anchor list survived the Konva stage's
  teardown, so a stray click near where a discarded session's first anchor
  used to be could silently close a new shape using stale points mixed with
  fresh ones. Fixed by resetting the draw-state ref in the stage effect's
  cleanup, not just on an explicit Clear/tool-change.
- **Chaikin smoothing (domain-level) was being double-applied on top of
  Konva's own curve tension**, over-rounding freehand shapes. Removed the
  Konva `tension` setting entirely — the point-based smoothing already
  handles it.
- Also extracted rectangle/oval point-geometry into pure, unit-tested
  functions (`apps/web/src/property/dragShapeGeometry.ts`, matching the pen
  tool's existing `penPath.ts`) and split Bed rendering into separate
  saved/draft Konva layers, so drawing a new Bed no longer re-smooths and
  rebuilds every other already-saved Bed on the property on every mouse
  move.

**Manual QA** was a real Playwright-driven headless browser against the
real Supabase project (a fresh throwaway account, same pattern as #5's QA):
sign up → create Property → draw and save a Bed with each of the four tools
(including smoothing on/off) → all four render correctly layered on the
aerial photo → persists correctly across a full page reload → Remove a Bed
→ Delete Property (cascades its Beds via the FK) → narrow-viewport gate
shows the correct fallback message instead of the drawing tools. Zero
console errors throughout. Five lower-priority manual QA items were
identified but deliberately deferred, not run — see "Deferred QA (ticket
#7)" below (real-mouse/trackpad feel, pen-tool curve-handle dragging,
cross-browser, a real address, and edge-case breakage attempts). Test
Property/Beds deleted afterward; the throwaway auth user itself remains
(no service-role access to remove it
from this session, same limitation noted on #5's QA).

**A pre-existing, unrelated bug was found and fixed along the way**: all of
`apps/web`'s React-Router-based component tests were failing with "invalid
hook call," for every test file, independent of anything in #7. Root cause:
`apps/web`'s own `react`/`react-dom` range (`^19.2.8`) conflicted with the
root workspace's `19.1.0` override (added during #13 for mobile's exact
Expo SDK peer pin — see that ticket's entry below), so npm had nested a
second React copy under `apps/web/node_modules` while `react-router-dom`
stayed hoisted to root and bound to the *other* copy. Confirmed via `git
stash` that this was already broken on `main` before #7 touched anything.
Fixed by realigning `apps/web`'s range to `19.1.0` so the whole monorepo
shares one React instance again — full `npm run test:run` (all three
workspaces) and `npm run typecheck` both pass clean now.

**Also found, not fixed (out of scope for #7, flagging for whoever owns Tag
Scan next)**: `packages/domain/src/usdaTraits.ts` around the
`minimumHardinessZone` projection — `Number("")` and `Number(null)` both
evaluate to `0`, which `Number.isFinite` accepts, so a USDA response with an
empty/null `Temperature, Minimum (°F)` value gets silently read as `0°F`
instead of "no data," producing a fabricated "zone 7" suggestion attributed
to USDA. The `matureHeightFeet` field two lines above already guards against
this same coercion (`> 0`); the temperature field doesn't. Caught by the
same code-review pass, on `packages/domain`/`apps/mobile` code this session
didn't otherwise touch (#20/#22's Tag Scan work, already closed).

**#19 (Tag Scan prototype: OCR placement + USDA data pull) is done and
closed on GitHub** — see commits `36da29d`, `9718f91`, and
`docs/adr/0004-tag-scan-ocr-placement-and-usda-adapter.md`. Real on-device
OCR (Apple Vision, tested against 8 real nursery tag photos) and a real
live USDA PLANTS characteristics-search pull, both throwaway prototypes
under `prototype/tag-scan-ocr/`. **Resolves the "Open, but not blocking"
OCR-placement question below** — see ADR-0004: on-device Vision wins, which
means OCR joins the shared-client-package list, not the Edge Function list,
but also means `apps/mobile` needs a custom EAS dev client to actually run
Vision (Expo Go can't reach it) — see the `#22` entry just below for why
that's now its own ticket. Also sharpened the USDA-coverage picture: only
2 of 7 real tag species had an exact USDA match — "no match" needed to be
designed as a routine outcome, not an edge case, which the code below does.

**#20 (Tag Scan build) is implemented and committed (`96e46c6`), but NOT
closed on GitHub** — same posture as #5 below: real, tested code, not a
stub, but held open pending real-environment verification this session
couldn't do. What's built, all behind real test coverage (94 domain + 55
mobile tests): OCR-candidate review, common-name-ambiguity resolution
(`resolveCommonName`), genus+species+cultivar duplicate-Plant detection
(`checkForDuplicatePlant`), and USDA trait projection + hardiness-zone
derivation, all in `packages/domain` behind a `TagOcrAdapter` seam; a
`tag_photos` table + private storage bucket (migrations `0009`/`0010`,
its own category per `CONTEXT.md`, never mixed with Plant reference
photos); a thin `usda-plant-traits` Edge Function; and a full mobile flow
in `apps/mobile/src/tagScan/` — guided two-step front/back photo capture
(front required, back optional, per issue #20's own design comment,
motivated by ADR-0004's tag2 finding that two different tags' front/back
photographed together must never be silently treated as one tag's two
sides) → Review (manual-entry fields, species lookup, duplicate offer,
suggested-traits accept/skip) → an ambiguous-species picker screen → a
duplicate-Plant offer screen.

A parallel code-review pass (11 finder agents) caught and fixed several
real bugs before this landed: picking a species on the ambiguous-species
screen didn't actually update the Review screen it returns to (React
Navigation reuses the already-mounted screen instance rather than pushing
a new one — needed a `route.params`-keyed re-sync effect); a race letting
a duplicate Plant slip through if the existing-Plants check hadn't
finished loading before Continue was pressed; the "create anyway" override
on the duplicate-offer screen bypassed `validatePlantInput` and name
trimming entirely; a suggested hardiness-zone value was shown on the
"suggested traits" screen but silently dropped when saving (fixed by
making clear it's reference-only — USDA only gives a minimum-temperature
zone, never an upper bound, so fabricating a max would overstate what the
source actually knows); and Plant-creation-then-tag-photo-linking was two
separate writes reported as one failure, which could have caused a
resubmit-triggered duplicate Plant if only the link step failed.

**Not built, and deliberately not attempted**: the real on-device Vision
OCR module itself. `manualEntryAdapter` (always proposes zero candidates)
is the one real, shipped `TagOcrAdapter` for now — per #20's own
acceptance criteria, "manual entry works as a complete fallback," which is
exactly what ships. Filed as its own ticket, **#22** (`ready-for-human`,
not `ready-for-agent`) — building the native Vision module, migrating off
Expo Go to a custom EAS dev client, and testing OCR against real tags all
need a Mac, an Apple Developer account, and a physical iPhone, none of
which a coding-agent session has access to. `#20`'s "OCR runs wherever T18
decided" acceptance criterion is therefore only structurally satisfied
(the seam is real and ready) — whether that's enough to close #20 now, or
whether #20 should stay open until #22 lands, is a call for whoever's
driving next, not decided here.

**Before closing #20**, still needed as of this update (see the "What to
do next" entry at the top of this doc for the latest — migrations and the
Edge Function are now both done, only the device QA remains):
- ~~Push migrations `0009`/`0010`~~ — **done**, confirmed already live via
  `npx supabase migration list` (turned out to have been pushed alongside
  #7's in an earlier `db push`, this doc just hadn't caught up).
- ~~Deploy `usda-plant-traits`~~ — **done**, deployed and smoke-tested
  (CORS preflight, missing auth, malformed body, both-fields-provided, a
  real matched lookup, a real no-match lookup — see "What to do next").
- Manually verify the mobile flow on a real device via Expo Go: front/back
  capture, manual entry, species lookup + ambiguous-species picker,
  duplicate-Plant offer (including the "create anyway" override), and the
  USDA-suggested-traits screen — none of this has been exercised outside
  Jest's fake DB client.

**#5 (Property + aerial base map) is implemented, committed, fully manually
verified, and closed on GitHub** — a gardener can create their one Property
(per account, MVP) by address, picked from a live autocomplete rather than
freeform text (see below), and see it rendered as a non-drawable structural
reference layer or a degraded-mode message. The three remaining deferred QA
items (degraded-mode path, one-Property-per-account error, reload
persistence) were run this update via a fresh throwaway test account
signed up directly against the real linked Supabase project, driving the
real `create-property` Edge Function and a real Playwright-driven browser
— no code changes were needed, #5 was already correct. See the closing
comment on the issue for full detail; "Deferred QA (ticket #5)" below is
kept for history, all items now checked off.

What shipped, across several rounds of real manual QA in this session
(not just unit tests — a real signed-in browser, then a Playwright-driven
headless browser for the last two bugs, which unit tests couldn't have
caught either):

- **`create-property` Edge Function** (commit `1380351`) — probes Esri
  World Imagery zoom availability server-side (ADR-0002/ADR-0003) and
  persists the resulting Property row. Code review caught three real bugs
  before first deploy: no CORS handling at all, the inserted row never set
  `user_id`, and a malformed geocoder hit could put `NaN` into
  `latitude`/`longitude`.
- **CORS preflight fix** (`f78788b`) — manual QA hit "Failed to send a
  request to the Edge Function" on every submit. `supabase-js` sends an
  `X-Client-Info` header on every request by default; the function's
  `Access-Control-Allow-Headers` didn't list it, so the browser's real
  preflight failed silently. A hand-crafted `curl OPTIONS` test hadn't
  caught this, because it hadn't set that header either — the lesson being
  a Edge Function's CORS surface needs testing against what the *real*
  client actually sends, not a guessed header list.
- **Delete Property** (`b4570b2`) — the one-per-account design had no
  recovery path for a wrong address or a QA retry. No new migration
  needed; the owner-scoped delete RLS policy and grant were already there
  from `0006`/`0007`.
- **Resolved-address display, then full address autocomplete**
  (`af95e6a`, `fe0443c`) — flagged directly by the user: a bare street with
  no city/state/country ("1 main st") geocoded to *something*, silently,
  anywhere on the planet. First pass showed what Nominatim actually
  matched, next to what was typed. User then asked for the more robust
  fix: a `search-addresses` Edge Function returning multiple candidates,
  and a combobox (`AddressAutocomplete.tsx`) that requires picking one —
  raw text can no longer be geocoded and saved directly. `create-property`
  no longer geocodes at all; it only takes an already-picked candidate and
  probes imagery. New `supabase/functions/_shared/{cors,auth,nominatim}.ts`
  once a second function existed. Code review on this diff caught a real
  race (stale candidates from a superseded search staying clickable) plus
  several smaller issues, all fixed with a regression test added for the
  race.
- **Dropdown was invisible, then too narrow** (`b7f01c3`, `3b7fa07`) — user
  reported suggestions "aren't clickable." Diagnosed by actually driving a
  real headless browser (Playwright, both Chromium and WebKit engines)
  against the dev server instead of guessing: the click handler was never
  broken in either engine — a pre-existing global CSS rule (written for an
  unrelated thumbnail list) was rendering the dropdown as unstyled flex
  text with no border, background, or hover state, indistinguishable from
  body copy. Fixed with a real dropdown style, scoped by id. Widening it
  afterward (full geocoder results run long) took two more overrides and a
  real flexbox diagnosis — bumping `main`'s `max-width` alone silently did
  nothing, because `#root` is a flex column container and `main`'s
  existing `margin: 0 auto` suppresses flex-stretch on auto-margined
  items; `width: 100%` was the actual fix. Both diagnosed by checking
  actual computed styles in a real browser, not by re-guessing.

**#13 (React Native app scaffold + auth) is implemented, committed,
manually verified on a physical iPhone via Expo Go, and closed on
GitHub** — see commits `7ff1943`, `80f8b84`, `f37c2fb`, `7d28ab0`, plus
the closing comment on the issue for full detail. `apps/mobile/` mirrors
#2's web auth scaffold (same Supabase email/password flow, `RootNavigator`
standing in for web's `RequireAuth`), imports `@plant-app/domain` per
ADR-0003. Along the way: downgraded from the initial SDK 57 scaffold to
SDK 54 to match the Expo Go build actually available on the App Store;
fixed a real npm-workspace bug where Expo's exact `react` pin conflicted
with the web app's `^` range, causing packages hoisted to the workspace
root to resolve against the wrong React instance (invalid-hooks crashes at
runtime, not just in Jest — fixed with a root-level `overrides` pin, see
`package.json`); built real email-confirmation deep-linking
(`plant-app://` scheme, `emailRedirectTo`, a link handler) that's
currently dormant since "Confirm email" was turned off on the Supabase
project during this ticket's manual QA (Supabase's default mailer hit its
rate limit, and separately the confirmation link pointed at the web app's
localhost dev URL, useless on a phone) — it's real tested code, not a
stub, and resumes working automatically if confirmation is ever
re-enabled; fixed the keyboard covering the Log in/Sign up button
(`KeyboardAvoidingView`) and the Dashboard title rendering under the
notch (`SafeAreaView` — lost automatically once `headerShown: false` is
set on the native-stack navigator). Manually verified on a real device:
sign up, log in (correct/wrong password), log out, Dashboard shell with
placeholder nav, session persists across a real force-quit/relaunch,
already-logged-in cold start skips straight to Dashboard. Not tested:
Android (no device available) and foreground/background token refresh
(not practically triggerable in a manual pass). Closing #13 does **not**
newly unblock #14–#18 — each also needs another still-open ticket (#8,
#6, #10, #9, or #3+#8+#12 respectively), confirmed via the frontier query
below.

**#2 is implemented, committed, manually verified against a real Supabase
project** (sign up, log in, land on the Dashboard shell, session survives
reload), **and closed on GitHub** — see commit `2668f2c`.

**#3 (Plant record CRUD) is implemented, committed, manually verified
against a real Supabase project** (create/view/edit/delete, reference
photo upload/remove, every domain-validation error case all passed), **and
closed on GitHub** — see commit `9018f33` and the follow-up fix commits
below.

- Four lower-priority manual QA items were identified but deliberately
  deferred, not run (see "Deferred QA (ticket #3)" below) — direct-URL
  access to another account's plant, direct-URL access to a nonexistent
  plant, photo-thumbnail persistence across a page reload, and Registry
  sort order with multiple plants. Still not run as of this update; worth
  picking up during #10 (Registry view) or whenever RLS/reload behavior is
  next touched.

**#4 (Care task templates on Plant) is implemented, committed, manually
exercised against the real Supabase project** (add a date-range template,
add a seasonal-marker template, remove a template), **all deferred QA items
now verified via a real signed-in browser (two accounts), and closed on
GitHub** — see commit `4eea9e7` and the follow-up fix commits below, plus
the closing comment on the issue for the QA detail (RLS via the `plants`
join, reload persistence, in-browser validation errors — all passed).

- Manual testing against the real project surfaced real gaps the automated
  suite (which mocks Supabase entirely) couldn't catch, all fixed and
  committed:
  - Migrations `0003_care_task_templates.sql`/`0004_grant_care_task_templates_table.sql`
    existed in-repo but hadn't actually been pushed to the linked Supabase
    project — `createCareTaskTemplate` was hitting a table that didn't
    exist, surfacing as a generic "Could not add this task template."
    error. Pushed via `npm run db:push`; confirmed live via
    `npx supabase migration list`.
  - Adding or removing a task template gave no visible confirmation — the
    status/error message only rendered near the Plant form's top-level
    Save button, far from the Care task templates section. Given that
    section its own status/error messages.
  - Two same-named "Remove" buttons (reference photos, care task
    templates) collided on accessible name — disambiguated with
    `aria-label`.
  - A date-range trigger where the start falls later in the calendar than
    the end (e.g. `6/1–1/1`) is a deliberate wraparound into the following
    year, but nothing distinguished it from a data-entry mistake. Now
    flagged both while entering the range and once listed (`dateRangeWraps`
    in `packages/domain/src/careTaskTemplate.ts`).
  - The "Trigger date range" and "Bloom window" fieldsets let their four
    month/day inputs wrap independently, reading as squished/ungrouped.
    Both now group each month/day pair onto its own row with a divider
    between start and end (`.date-pair` in `apps/web/src/index.css`).
- A related but out-of-scope idea surfaced during manual testing — a
  single-specific-day trigger (e.g. "the 1st of the month") rather than a
  range. The domain model already supports this today (a date-range
  trigger with `start == end` is valid), so this is a UI-affordance
  question only. Filed as **#21**, labeled `needs-triage` (not
  `ready-for-agent` — the proposed approach hasn't been agreed, only
  suggested). Not blocking anything.

**A further round of Plant-form fixes landed on top of #4/#3** (commit
`9b74934`), found via continued manual review rather than a new ticket:

- Free-text identity fields (common/scientific name, cultivar, flower
  color) now reject content with no letters at all (e.g. "000"), via a
  Unicode-aware check so non-Latin-script names aren't wrongly rejected.
- **Plant's hardiness zone changed shape**: from a single value (e.g.
  `"6a"`) to a whole-zone range (`{ min, max }`, e.g. "Zones 5-7") — a
  nursery tag always gives a range in whole zones, never a single value
  or a/b half-zone precision (that precision is only meaningful for a
  single real-world location's zone, which this app doesn't model yet —
  see the note in `CONTEXT.md`/domain docs if that's ever added). Domain
  type is now `PlantInput.hardinessZoneRange: { min: number; max: number }`
  in `packages/domain/src/plant.ts`; the UI is two "Min zone"/"Max zone"
  selects.
- Migration `0005_plant_hardiness_zone_range.sql` **drops the old
  `hardiness_zone` text column** and adds `hardiness_zone_min`/
  `hardiness_zone_max` — no backfill, since this is a personal
  single-user app and no real Plant row had a `hardiness_zone` value set.
  **Pushed** to the linked Supabase project (verify with
  `npx supabase migration list`, which should show `0005` live).
- Added a divider between the Plant edit page's post-form sections
  (Reference photos, Care task templates, Delete) and restored a bulleted
  list for the Registry's saved-plants list (scoped so Dashboard/other
  lists stay marker-free).

**#5 closed a previous update, which unblocked #6 and #7 as frontier work —
#7 has since been built and closed this update** (see its entry at the top
of "What to do next"), which in turn unblocked **#8** (confirmed directly
against the API right after #7 closed: `blocked_by: 0`, `ready-for-agent`,
unassigned — it needed both #3 and #7). **#6** remains frontier,
unaffected by #7's closure. **#20** also shows `blocked_by == 0` but is
already implemented and sitting open pending closure (see "What to do next"
above) — re-implementing it would be redundant. **#22** also shows
`blocked_by == 0` but is labeled `ready-for-human`, not `ready-for-agent`
(see its "What to do next" entry above for why — and note it has a
commit, `dc33e47`, but is still open as of this update). **#21** is
`needs-triage`. **#4 closed an earlier update** (deferred QA all verified —
see its entry above) but didn't change the frontier: #12, the only ticket
that lists #4 as a blocker, also needs #8 (frontier now, but not yet built)
and #11, still open.

So the real next steps are: (a) pick up **#6** or **#8** — both are
genuine, unstarted frontier work now (confirmed directly against the API);
(b) do the deferred deploy/QA pass for #20 so it can actually close, though
nothing downstream is waiting on it; (c) triage #21; or (d) pick up #22 if
you have a Mac/Apple Developer account/physical iPhone available — though
check its actual GitHub state first, since a concurrent session's commit
toward it isn't reflected here.

`/to-tickets` has already run against issue #1. Nineteen tickets were
published as GitHub issues **#2–#20**, each labeled `ready-for-agent`, each
linked to #1 as parent, with GitHub's native issue-dependency ("blocked by")
edges wired between them — see "Issue tracker" below for the full map.
**#21** was filed ad hoc during #4's manual QA, labeled `needs-triage`.
**#22** was filed ad hoc during #20's implementation, labeled
`ready-for-human` — neither is part of the original 19.

**#5 has now closed**, and **#6**/**#7** (each blocked by #5) confirm it —
both now show `blocked_by: 0` via the API, not `1`. **#20** is implemented
but intentionally left open (see above) rather than listed as frontier
work to pick up. **#4 also closed** an earlier update, but that alone
doesn't unblock **#12** (Task completion logging) — it also needs #8
(Planting) and #11 (Dashboard), both still open.

Run `/implement` in a **fresh session**, pointed at whichever ticket number
you pick — that's the context-hygiene pattern the flow expects (grilling →
spec → tickets stays one unbroken window; each `/implement` starts clean from
the ticket alone). As each ticket closes, re-run the frontier query (see
"Issue tracker") to see what newly unblocked.

Nothing here is stale-checked for you the way the old "three uncommitted
files" note used to be — `git status` was clean as of this update. Earlier
in this same round, a concurrent session working #13 had `apps/mobile/`
sitting untracked in this working tree; it's since been committed for real
(`7ff1943`, `80f8b84`, `f37c2fb`, `7d28ab0`) and **#13 is now closed** on
GitHub, verified against a real Supabase project and a physical iPhone —
see the #13 entry above. That was still a real concrete instance of the
risk this doc keeps flagging while it was in progress: this repo's working
tree is shared by more than one session, so `git status` before any broad
`git add`.

### Deferred QA (ticket #10)

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

### Deferred QA (ticket #5) — all done, #5 closed

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

### Deferred QA (ticket #8)

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

### Deferred QA (ticket #7)

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

### Deferred QA (ticket #3)

Not run yet, lower priority than the core checklist (which passed in full):

1. **Direct URL to another account's plant ID** — log in as account A, copy
   a plant's `/registry/<id>` URL, log in as account B, paste it directly.
   Expected: "Plant not found." (RLS `.maybeSingle()` returns null), not a
   data leak or raw error.
2. **Direct URL to a nonexistent plant ID** — same expected result.
3. **Reload persistence for photos** — upload a reference photo, refresh
   the page, confirm the thumbnail still renders (exercises the signed-URL
   fetch on a fresh load, not just in-session state).
4. **Multiple plants, alphabetical ordering** — add 2-3 plants with
   different common names, confirm the Registry list sorts by name.

### Deferred QA (ticket #4) — all done, #4 closed

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

A personal garden registry app for a gardener with 50–100 plantings who loses
track of what's planted (especially in winter). Core entities:

- **Plant** — species/variety-level record (common name, scientific name,
  cultivar, bloom window, flower color, sun/shade, mature size, hardiness
  zone, care task templates, reference photos)
- **Planting** — one placement decision referencing a Plant (quantity, Bed +
  Pin coordinates, year acquired, source, dated photo log)
- **Property** — the user's whole garden; owns one real-world scale shared by
  every Bed drawn within it
- **Bed** — a drawn map area within a Property, desktop-only creation
- **Pin** — a Planting's location within a Bed, placed by dragging — no
  landmark math, no manual numbers
- **Tag Scan** — an optional way to create/enrich a Plant record by
  photographing a nursery tag; OCR is a convenience layer only, manual entry
  always works
- **Views:** Map, Registry, Bloom Timeline (two presentations — chart and
  list, both on every platform), Dashboard — full native feature parity on
  phone except drawing

Full spec (source of truth): **GitHub issue #1**
Domain glossary: `CONTEXT.md`

---

## Current state

**Working tree is clean** as of this update. **#6, #10, and #11 have now
all been manually verified** (#6 and #10 in earlier updates this same
day; #11 this update, by the user directly against the dev server — not
Playwright) and are closed on GitHub. #11 turned out to need no new
user-facing behavior (Map/Registry/Bloom Timeline were already routed to
real pages by #7/#8/#9/#10) — its real work was removing the now-dead
`ComingSoonPage` placeholder-routing mechanism and adding a tested
catch-all `NotFoundPage` in its place, commit `8bd93e5`. If you're a
different session picking this up: the working tree being clean now
doesn't mean everything's done — check "What to do next" before assuming
so.

**Pushed to `origin/main`** — `git log origin/main..HEAD` is empty as of
this update, confirmed directly. Don't trust this doc's "ahead of origin"
claims over `git log origin/main..HEAD` run fresh — it's drifted from
reality more than once already. Most recent commits first:

```
8bd93e5 Finish wiring Dashboard to real views, replace dead placeholder route (#11)
37438dc Fix Registry (#10) QA findings: attribute visibility, link spacing, filter layout
a58e6b7 Document QA-ownership check-in in CLAUDE.md
293bfb9 Record #6's closure and #15's new frontier status in the handoff doc
ffbc807 Fix two more UX issues found by live QA on #6: width cap, duplicate map
d6baeb3 Fix two real bugs found by live QA on #6's up-front base-map choice
70c8a9e Make #6's base-map source a free up-front choice, not just an aerial fallback
b17d6e1 Fix handoff doc's stale push-status claims after pushing
2c77076 Update handoff doc: record #6's commit, keep its QA checklist intact
3b38701 Fix Registry test fixture for #6's new PropertyRow fields
6f891ff Add Property: photographed/in-app-drawn base map + Scale Reference (#6)
af9f274 Update handoff doc: record #10's implementation and deferred manual QA
029fc9c Add Registry view: filter/search and Planting-location links (#10)
83565dc Document the Xcode/Metro dev-client workflow and a real signing dead-end (#22)
675ea1f Show the signed-in account's email on both Dashboards
b75dafd Tag Scan: add Cancel navigation and style the "Look up species" button (#22)
9fd6d6f Fix Tag Scan's native Vision OCR module never actually linking into the app (#22)
6aa6775 Record #9's closure and #17's new frontier status in the handoff doc
a0de8dd Record #9's QA status in the handoff doc — one item unverified
24cf78e Bloom Timeline: add month tick marks to each bar's track (#9)
5272556 Record #22's paused device-setup session in the handoff doc
01b0c36 Document Tag Scan dev-client setup and fix wizard workspace glob (#22)
01e1868 Bloom Timeline: fix phone-width chart layout (#9)
c41c5be Pin down Bloom Timeline's unfiltered-view semantics in CONTEXT.md (#9)
f70eb38 Bloom Timeline: reword Bed filter's default option (#9)
c7eccb0 Bloom Timeline: fix QA findings — error attribution, month axis, Bed hint (#9)
81ad8eb Style the Bloom Timeline year-view chart (#9)
08d3851 Add Bloom Timeline: year-view chart + month-filtered list, filterable by Bed (#9)
67d3126 Record ticket #8's deferred manual QA items in the handoff doc
f96a43e Reflect #8's closure and #9/#10/#14's new frontier status in the handoff doc
3041ca3 Add Planting: create + place Pin, view on tap (#8)
6173a57 Add Bed drawing on the aerial base map (#7)
dc33e47 Add on-device Vision OCR module and adapter (#22)
4464cac Reflect #5's closure and #6/#7's new frontier status in the handoff doc
bcd0e19 Reflect #19's closure and #20's implementation in the handoff doc
96e46c6 Add Tag Scan domain logic, USDA lookup, and mobile capture/review flow (#20)
9718f91 Correct tag2 finding: mismatched front/back, not one plant's two sides
36da29d Add Tag Scan OCR-placement prototype + USDA adapter validation (#19)
b03be0b Reflect #13's closure in the handoff doc
7d28ab0 Fix keyboard-covered buttons and missing safe-area insets on mobile
3b7fa07 Widen the Property page so full addresses aren't cramped
b7f01c3 Style the address-picker dropdown — reported as "not clickable"
f37c2fb Handle Supabase email-confirmation deep links on mobile
fe0443c Add address autocomplete to replace freeform geocoding
80f8b84 Downgrade mobile app to Expo SDK 54 to match Expo Go
af95e6a Show the geocoder's resolved address alongside what was typed
7ff1943 Add React Native app scaffold + auth (#13)
b4570b2 Add a Delete Property control
f78788b Fix CORS preflight rejection on create-property (missing x-client-info)
84c803d Update handoff doc for ticket #5
1380351 Add Property + aerial base map (#5)
58672c8 Mark commits and migration 0005 as pushed in handoff doc
91fac04 Update handoff doc for the Plant-form fixes batch
9b74934 Add Plant field validation, hardiness zone range, and layout fixes
ffb3e93 Update handoff doc for ticket #4
8ce7a48 Implementation of Issue 4
b54c83c Fix care task template UX issues found in manual testing
4eea9e7 Add care task templates on Plant (#4)
8dec792 Document that plan-confirmation requests are a hard stop
05240be Reflect #3's closure in the handoff doc
f23513e Refresh handoff doc after ticket #3
1d20b8e Fix list styling on the Registry/Dashboard pages
97550cc Show a confirmation after saving a Plant
a702ec2 Fix spacing for elements outside <form>
49a72dc Add minimal form styling
285c72b Fix plant save 403 and mark required fields visibly
e847b57 Add Supabase CLI for remote-only migration management
9018f33 Add Plant record CRUD with reference photos (#3)
a728d88 Updated handoff doc after ticket 2
2668f2c Scaffold monorepo, Supabase auth, and web dashboard shell (#2)
9b22c43 Updated handoff doc, pre-implementation
1f756b1 Resolve bezier-pen scope, flag OCR execution as still open, refresh handoff
eaf1f32 Add ADR-0003: web desktop + native mobile, cloud BaaS backend
86f3772 Design Property, Scale Reference, and Tag Scan; correct base-layer purpose
85fcd4c Resolve ADR-0001 smoothing question, reconcile spec and glossary
14957a9 Second prototype added to explore GPS
492266b Added handoff document
5f9fbc7 Gitignore added
3697144 Init files
```

`2668f2c` (#2), `9018f33`–`1d20b8e` (#3, plus fixes found during manual
QA), `4eea9e7`–`91fac04` (#4, plus fixes found during manual QA, including
the hardiness-zone-range rework in `9b74934`), `1380351`–`3b7fa07` (#5,
plus several real rounds of fixes found during manual QA — see "What to do
next" above for the detailed list), `7ff1943`–`7d28ab0` (#13, RN
scaffold + auth, plus the SDK downgrade, deep-link, and device-QA fix
commits — see "What to do next" above), `36da29d`/`9718f91` (#19, Tag Scan
OCR-placement + USDA prototype, ADR-0004), `96e46c6` (#20, Tag Scan
build — domain logic, `tag_photos` migration/storage, `usda-plant-traits`
Edge Function, and the full mobile capture/review flow, minus the native
Vision OCR module split to #22), `dc33e47` (#22, on-device Vision OCR
module + adapter — **committed by a concurrent session this repo shares;
not otherwise reflected in this doc, and this update did not review or
verify its contents**), `6173a57` (#7, Bed drawing — see "What to do
next" above for full detail), and `3041ca3` (#8, Planting create + place
Pin + view on tap — domain logic, `plantings`/`planting_photos`
migrations/storage, and `PlantingMap.tsx` — see "What to do next" above for
full detail, including two real bugs a Playwright QA pass caught) are the
build work so far. #2, #3, #4, #5, #7, #8, #13, and #19 are closed on
GitHub. #20 is implemented but **not yet closed on GitHub** — see "What to
do next" above and its "Deferred QA"/deploy notes. **#22 is still open on
GitHub, still labeled `ready-for-human`, still unassigned** (confirmed
directly against the API right after #7 closed) — so despite `dc33e47`
landing code, #22 evidently still needed the Mac/Apple Developer
account/physical iPhone device-testing step this environment doesn't have.
**#22 has since been verified end-to-end on a real device and closed** —
see its own "What to do next" entry above for the full detail (two real
bugs found and fixed: the native module never actually linked into the
compiled app, and no way to leave the Capture/Review screens once entered).
#5's migrations (through `0008`) are pushed to the linked Supabase project
and both its Edge Functions (`create-property`, `search-addresses`) are
deployed; #7's migrations (`0011`/`0012`) are pushed; #20's migrations
(`0009`/`0010`, pushed alongside #7's in the same `db push`) and its
`usda-plant-traits` Edge Function — **the Edge Function itself is still not
deployed**, so #20 still can't fully close on that front — see "What to do
next" above. #8's migrations (`0013`–`0016`) are pushed and live (confirmed
via `npx supabase migration list`); #8 needed no Edge Function (Planting
touches no external adapter). #6's migrations (`0017`/`0018`) are pushed
and live — `0017` note for posterity: it turned out to already be applied
to the remote before this update's rework of #6 started (a concurrent
session had pushed it), so the rework's schema changes had to go in a
fresh `0018` rather than amending `0017` in place, which Supabase's
filename-based migration tracking would have silently ignored (see "What
to do next" for the full story). **Everything through this update's own
commits is pushed to the GitHub remote** — `git log origin/main..HEAD` is
empty, confirmed directly. **#6, #10, #11, and #22 are all now closed on
GitHub.** The remaining tickets (#12, #14, #16–#18) are still unbuilt or
unverified — #12, #14, #16, and #17 are genuine frontier work (#12 newly
unblocked by #11's closure this update, #16 by #10's closure earlier
today); #18 still needs at least one other still-open ticket (#12); #20
is built but deliberately excluded from the frontier pending its own
deploy/QA pass;
#21/#23/#24/#25 are `needs-triage`.

> On `14957a9`'s message: the satellite prototype is **not** GPS exploration.
> No GPS is read and no user photo is taken — that is exactly why the work was
> in scope when GPS positioning was not. See ADR-0002.

### What exists

| Artifact | Path | Purpose |
|---|---|---|
| **App (real, built)** | `packages/domain`, `apps/web` | Ticket #2's output (npm-workspaces monorepo, shared TS `domain` package, Vite/React/TS web app, Supabase auth, auth-gated Dashboard shell) plus ticket #3's output (`Plant`/`PlantInput` types + `validatePlantInput` in `packages/domain/src/plant.ts`; Registry list + create/view/edit/delete + reference-photo upload in `apps/web/src/routes/Plants*.tsx` and `apps/web/src/plants/`) plus ticket #4's output (`TaskTrigger`/`CareTaskTemplate` types + `validateCareTaskTemplateInput` + `computeTriggerDateRange`/`dateRangeWraps` in `packages/domain/src/careTaskTemplate.ts`; add/list/remove UI in the "Care task templates" section of `apps/web/src/routes/PlantFormPage.tsx`, repository methods on `PlantsRepository`) plus ticket #5's output (`Property`/`PropertyInput`/`AddressCandidate` types + Web Mercator scale math — `metersPerPixel`/`feetPerPixel`/`pixelsPerFoot`/`lonLatToTile`/`pickBestZoom`/`aerialTileUrl` — in `packages/domain/src/property.ts`; the `/map` page in `apps/web/src/routes/PropertyPage.tsx` and `apps/web/src/property/` — `PropertiesRepository` with `get`/`search`/`create`/`remove`, and the `AddressAutocomplete.tsx` combobox that requires picking a specific geocoder candidate rather than submitting freeform text — backed by the `create-property` and `search-addresses` Edge Functions) plus ticket #7's output (`Bed`/`BedInput`/`BedTool`/`BedPoint` types + `validateBedInput` + the ADR-0001 smoothing pipeline — `decimatePoints`/`chaikinSmooth`/`smoothBedOutline` — + `feetToPixels`/`pixelsToFeet` in `packages/domain/src/bed.ts`; the Konva-based drawing surface `BedEditor.tsx` wired into `/map`, gated to desktop viewports only via `useIsDesktopViewport`/`isDesktopViewport.ts`; pure geometry helpers `penPath.ts` (bezier-pen curve flattening) and `dragShapeGeometry.ts` (rectangle/oval point sampling); `BedsRepository` with `list`/`create`/`remove`, backed directly by the `beds` table — no Edge Function needed, unlike Property, since Bed geometry touches no external adapter) plus ticket #8's output (`Planting`/`PlantingInput`/`PlantingPhoto` types + `validatePlantingInput`/`validatePlantingPhotoInput` + `findBedContainingPoint` (ray-casting point-in-polygon) in `packages/domain/src/planting.ts`; `PlantingMap.tsx` in `apps/web/src/plantings/` wired into `/map` alongside `BedEditor` — renders every Bed's outline and Planting's Pin, lets a Pin be placed by dragging directly onto the map (no Bed picker, no manual coordinates), and opens a details panel with the dated photo log on tap; `renderedOutlinePoints`/`buildOutlineLine` extracted to `apps/web/src/property/bedOutline.ts`, shared between `BedEditor` and `PlantingMap` so Pin-drop containment can't drift from what's actually drawn; `PlantingsRepository` with `listByBeds`/`create`/`remove`/`listPhotos`/`addPhoto`/`getPhotoUrl`/`removePhoto`, backed by the `plantings`/`planting_photos` tables and the `planting-photos` storage bucket — no Edge Function needed, same reasoning as Bed) plus ticket #9's output (`BloomTimelineBar` type + `buildBloomTimelineBars`/`filterBloomTimelineBarsByMonth`/`dayOfYear`/`bloomWindowIncludesMonth` in `packages/domain/src/bloomTimeline.ts`, plus a shared `monthDayRangeWraps` extracted out of `careTaskTemplate.ts`'s `dateRangeWraps` so both features use one wrap-detection rule; `BloomTimelinePage.tsx` in `apps/web/src/routes/` wired into `/bloom-timeline` — a Chart/List view toggle, a Bed filter, a month filter, a month-axis ruler, and per-bar tick marks, all reusing the same `BloomTimelineBar[]` — no new tables/Edge Functions, since it reads existing Plant/Bed/Planting data only). See `apps/web/README.md` for the one-time Supabase project setup. Not throwaway — build on this. |
| **Mobile app (real, built)** | `apps/mobile` | Ticket #13's output — Expo/TypeScript RN app on SDK 54, importing `@plant-app/domain` for `DASHBOARD_TILES` per ADR-0003. Mirrors (does not share code with) `apps/web`'s auth scaffold: `AuthContext`/`useCredentialsForm` in `apps/mobile/src/auth/`, `LoginScreen`/`SignUpScreen`/`DashboardScreen` in `apps/mobile/src/screens/`, `RootNavigator` (`src/navigation/`) swapping between an Auth stack and a Main stack based on auth status — the native equivalent of web's `RequireAuth` guard. `authDeepLink.ts`/`useAuthDeepLinkHandler.ts` complete Supabase's email-confirmation redirect via the `plant-app://` URL scheme (`app.json`); currently dormant since "Confirm email" is off on the linked Supabase project (see the #13 entry above), but real and tested, not a stub. Ticket #20 added `apps/mobile/src/tagScan/` (see the row below) plus `expo-image-picker`/`expo-crypto` dependencies and their `app.json` permission-plugin config. See `apps/mobile/README.md` for one-time setup (same Supabase project as web, `EXPO_PUBLIC_`-prefixed env vars, running via Expo Go — no Xcode/CocoaPods needed for day-to-day dev). Not throwaway — build on this. |
| **Tag Scan (real, built — minus native OCR)** | `packages/domain/src/{tagScanCandidate,tagScanMatching,usdaTraits}.ts`, `apps/mobile/src/tagScan/` | Ticket #20's output. Domain: `TagOcrAdapter` seam + `manualEntryAdapter` (the real, shipped fallback) + `reviewTagOcrCandidates` in `tagScanCandidate.ts`; `checkForDuplicatePlant`/`parseScientificName` (genus+species+cultivar matching, never common name alone) in `tagScanMatching.ts`; `projectUsdaSpeciesTraits`/`deriveHardinessZoneFromMinimumTemperatureF` (never bloom window) in `usdaTraits.ts`. Mobile: `TagScanCaptureScreen` (guided two-step front/back photo capture, front required) → `TagScanReviewScreen` (manual entry, species lookup, USDA-suggested-traits accept/skip) → `TagScanAmbiguousSpeciesScreen` / `TagScanDuplicateOfferScreen`, wired through `TagScanRepository`/`TagScanRepositoryContext`. **Not built**: the on-device Vision OCR module itself — `manualEntryAdapter` is the only real `TagOcrAdapter` today; see #22. **Not yet deployed**: migrations `0009`/`0010` and the `usda-plant-traits` Edge Function (see "What to do next"). |
| **DB schema** | `supabase/migrations/` | SQL migrations, applied via the Supabase CLI (`npm run db:push`) against the linked remote project — no local Docker stack, by explicit preference. `0001_plants.sql` — the `plants` table, RLS, `plant-reference-photos` storage bucket. `0002_grant_plants_table.sql` — follow-up GRANT the API roles need on newer Supabase projects (RLS alone isn't enough; see the migration's own comment). `0003_care_task_templates.sql` — the `care_task_templates` table, owned by a `plant_id` FK with RLS via a join to `plants` (not a direct `user_id` column). `0004_grant_care_task_templates_table.sql` — the same follow-up GRANT `0002` needed, for the new table. `0005_plant_hardiness_zone_range.sql` — drops `hardiness_zone`, adds `hardiness_zone_min`/`hardiness_zone_max` (a plant's hardiness rating is a whole-zone range, not a single value — see "What to do next"). `0006_properties.sql` — the `properties` table (one row per account for MVP, `properties_one_per_user unique (user_id)`), RLS. `0007_grant_properties_table.sql` — the same follow-up GRANT pattern as `0002`/`0004`, for `properties`. `0008_property_resolved_address.sql` — adds nullable `resolved_address` (what the geocoder actually matched, shown next to what the user typed so a bad match is visible — see "What to do next"). `0009_tag_photos.sql` — the `tag_photos` table (its own category, distinct from `plants.reference_photo_paths`, kept-by-default, deletable) + a private `tag-photos` storage bucket, RLS mirroring `0001`'s pattern. `0010_grant_tag_photos_table.sql` — the same follow-up GRANT pattern as `0002`/`0004`/`0007`. `0011_beds.sql` (ticket #7) — the `beds` table (`property_id` FK, `tool` check-constrained to the four drawing tools, `points` jsonb with a `>= 3 points` check, `smoothing_enabled`), RLS via a join to `properties` (ownership pattern matches `care_task_templates`' join to `plants`). `0012_grant_beds_table.sql` — the same follow-up GRANT pattern, for `beds`. `0013_plantings.sql` (ticket #8) — the `plantings` table (`plant_id`/`bed_id` FKs, `quantity` check `>= 1`, `pin_x`/`pin_y` in the same Property-relative real-world-feet space as the parent Bed's own outline points), RLS via a join to `beds` -> `properties` (insert additionally checks the referenced Plant's own ownership, since a Planting has two parent references). `0014_grant_plantings_table.sql` — the same follow-up GRANT pattern, for `plantings`. `0015_planting_photos.sql` — the `planting_photos` table (its own category/table, not an array column, since each dated photo carries its own `taken_on` date) + a private `planting-photos` storage bucket, RLS via a join to `plantings` -> `beds` -> `properties`. `0016_grant_planting_photos_table.sql` — the same follow-up GRANT pattern, for `planting_photos`. `0001`–`0016` are all live on the linked project (verify with `npx supabase migration list`). Apply new ones with `npm run db:push`, diff with `npm run db:diff`, regenerate row types with `npm run db:types`. |
| **Edge Functions** | `supabase/functions/` | Server-side adapter calls per ADR-0003, deployed via `npm run functions:deploy` (deploys every function found under `supabase/functions/` in one go — Docker-free, just bundles+uploads, unlike `functions serve`/`start` which need a local Docker stack). `create-property` (ticket #5) — takes a location already picked from `search-addresses`'s candidates (no longer geocodes raw text itself), probes Esri World Imagery zoom availability, and inserts the resulting Property row. `search-addresses` (added during #5's QA) — returns multiple geocoder candidates for the address-picker UI to choose from; requiring a specific pick, not stricter input validation, is what keeps a bare street ("1 main st") from silently resolving to an arbitrary global match. `usda-plant-traits` (ticket #20) — a thin, cached proxy over USDA PLANTS' characteristics-search API (no credential needed, but it's an external adapter call per ADR-0003); deliberately does *not* run the domain package's trait-projection/matching logic itself — that stays client-side, since USDA suggestions are only ever shown for accept/reject before anything's written. **Not yet deployed** — see "What to do next". `_shared/{cors,auth,nominatim}.ts` — CORS/auth/geocoding helpers shared between functions. Web Mercator math in `create-property` is hand-duplicated from `packages/domain/src/property.ts` (Deno edge functions can't import this npm workspace package) — keep the two in sync by hand, same convention as the `PlantRow`/migration "keep in sync" comments elsewhere. |
| **Spec (current)** | [GitHub issue #1](https://github.com/annetters/plant-app/issues/1) | The real spec. 53 user stories, full implementation/testing decisions. Labeled `ready-for-agent`. |
| Spec (superseded) | `docs/plant-app-spec.md` | The original file-based spec, written before this repo had an issue tracker. Kept for history; has a banner pointing to issue #1. Do not implement against it. |
| Domain glossary | `CONTEXT.md` | Canonical term definitions — Plant, Planting, Property, Scale Reference, Bed, Landmark (deferred), Pin, Tag Scan, Task model, Registry, Bloom Timeline, Dashboard |
| Agent docs | `docs/agents/` | Issue tracker setup, triage labels, domain context |
| Decisions | `docs/adr/` | **Read these — they're normative, and win over the spec where they disagree.** ADR-0001 (bed drawing + smoothing), ADR-0002 (base layer, Property, Scale Reference — amended), ADR-0003 (platform, persistence, native app scope, domain-logic execution — amended), ADR-0004 (Tag Scan OCR runs on-device/client-side; USDA adapter validated with real coverage gaps) |
| Research | `docs/research/plant-data-source-cultivar-level-evaluation.md` | Which external plant databases were checked for Tag Scan, and why. USDA PLANTS adopted; IPNI ruled out; Proven Winners / Missouri Botanical Garden / NC State logged as unresearched future candidates. Updated alongside ADR-0004 with a real, tested USDA-coverage number (2/7 real tag species matched). |
| Prototype | `prototype/bed-editor/` | **Throwaway.** `index.html` — Konva bed editor; pre-draw smoothing toggle is what ships. `smooth-correct.html` — three post-draw smoothing UIs, all rejected. |
| Prototype | `prototype/satellite-base/index.html` | **Throwaway.** Aerial base layer, address → scaled map, lot boundaries. |
| Prototype | `prototype/tag-scan-ocr/` | **Throwaway** (ticket #19). Real on-device Vision OCR run against 8 real nursery tag photos (`vision-ocr.swift`, results in `vision-ocr-results.txt`) and a real live USDA PLANTS pull (`usda-pull.mjs`, sample response saved). `cloud-ocr.mjs` was scaffolded but never run live (no API key available) — not needed, since on-device cleared the bar. Superseded by the real code in #20 above — don't build on this directory, extract learnings only. |

All three prototypes are explicitly throwaway — do not build on them,
extract learnings only. Full reasoning lives in `docs/adr/`.

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
  later as an optional precision-assist suggestion.

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
CLI. See `docs/agents/issue-tracker.md` for the full workflow.

Triage labels: `needs-triage`, `needs-info`, `ready-for-agent`,
`ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

**#1** is the spec, labeled `ready-for-agent`. **#2–#20** are the 19
tracer-bullet tickets `/to-tickets` split it into, each also `ready-for-agent`
and linked to #1 as parent. Dependency edges use GitHub's native issue
dependencies (`issue_dependencies_summary` via the API), not a text
convention — check blockers with:

```
gh api repos/annetters/plant-app/issues/<n> --jq '.issue_dependencies_summary'
```

Ticket map (dependency order; title abbreviated):

| # | Ticket | Blocked by |
|---|---|---|
| 2 | Repo scaffold, Supabase backend, web auth skeleton | — (built, `2668f2c`, closed) |
| 3 | Plant record CRUD (manual entry) — built, `9018f33`, closed | 2 |
| 4 | Care task templates on Plant — built, `4eea9e7`–`8ce7a48`, closed | 3 |
| 5 | Property + aerial base map — built, `1380351`–`3b7fa07`, closed | 2 |
| 6 | Property: photographed/in-app-drawn base map + Scale Reference — built and verified, `6f891ff`/`70c8a9e`/`d6baeb3`/`ffbc807`, closed | 5 |
| 7 | Bed drawing (desktop) — built, `6173a57`, closed | 5 |
| 8 | Planting: create + place Pin, view on tap — built, `3041ca3`, closed | 3, 7 |
| 9 | Bloom Timeline — built and verified, `08d3851`–`24cf78e`, closed | 3, 8 |
| 10 | Registry view — built and verified, `029fc9c`/`37438dc`, closed | 3, 8 |
| 11 | Dashboard (real content) — built and verified, `8bd93e5`, closed | 7, 8, 9, 10 |
| 12 | Task completion logging, history, one-off todos — **frontier, unblocked** | 4, 8, 11 |
| 13 | React Native app scaffold + auth — built and verified, `7ff1943`–`7d28ab0`, closed | 2 |
| 14 | Native: Map view — **frontier, unblocked** | 8, 13 |
| 15 | Native: Scale Reference calibration | 6, 13 |
| 16 | Native: Registry view — **frontier, unblocked** | 10, 13 |
| 17 | Native: Bloom Timeline | 9, 13 |
| 18 | Native: Plant/Planting detail, tasks & todos | 3, 8, 12, 13 |
| 19 | Tag Scan prototype: OCR placement + USDA data pull — done, `36da29d`/`9718f91`, closed | — |
| 20 | Tag Scan build — built, `96e46c6`, **open** (deferred deploy/QA; OCR module split to #22) | 3, 13, 19 |
| 21 | Care task template: single-day trigger UX (filed during #4 QA, `needs-triage`) | 4 |
| 22 | Tag Scan: on-device Vision OCR + EAS dev client migration — verified end-to-end and closed, `9fd6d6f`–`83565dc` | — |
| 23 | Tag Scan OCR: scientific-name-only heuristic misses common real tag layouts (filed during #22, `needs-triage`) | 22 |
| 24 | Bed drawing: rotate rectangle/oval shapes (filed during #6 QA, `needs-triage`) | 7 |
| 25 | PlantingMap: hide the map canvas until a Bed exists (filed during #6 QA, `needs-triage`) | 8 |

**Frontier query**: open issues with `issue_dependencies_summary.blocked_by
== 0` and no assignee. #2, #3, #4, #5, #6, #7, #8, #9, #10, #11, #13, #19,
and #22 are closed (**#11 closed this update** — real manual QA, run by
the user directly against the dev server, not Playwright — see "What to
do next" above). **#11's closure newly unblocks #12** (Task completion
logging, needed #4/#8/#11, all now closed) — confirmed `blocked_by: 0`
directly against the API. **#14** (Native: Map view), **#16** (Native:
Registry view), and **#17** (Native: Bloom Timeline) remain frontier from
earlier closures. **#18** (Native: Plant/Planting detail) still needs #12
(now frontier but not yet closed) in addition to #3/#8/#13 — confirmed
`blocked_by: 1` directly against the API, so it's not frontier yet.
**#20** has `blocked_by == 0` but is deliberately excluded from the
frontier — it's built and awaiting closure (specifically, deploying
`usda-plant-traits` and a real-device manual QA pass — see "What to do
next" above), not unstarted work. **#21**/**#23**/**#24**/**#25** are
`needs-triage`, excluded the same way.

So the frontier as of this update is: **#12**, **#14**, **#16**, and
**#17** — all `blocked_by: 0`, unassigned, confirmed directly against the
API. **#20** remains excluded (implemented, awaiting its own deploy/QA
pass — see "What to do next" above).

---

## Suggested skills

- **`/implement`** — the pattern used for every ticket so far. Run once per
  ticket, fresh session each time, pointed at a ticket number. Drives `/tdd`
  internally, closes with `/code-review`. Don't run `/to-tickets` again —
  tickets #2–#20 are already published. **#12, #14, #16, and #17 are
  frontier now** (see "Issue tracker" above) — any is a natural next
  `/implement` target. #20 still needs a deferred-QA/deploy pass to
  actually close. **Before starting a QA pass on any ticket, check with the
  user whether they want to run it themselves or want it Playwright-
  automated** — don't assume (see `CLAUDE.md`).
- ~~`/prototype` — what #19 actually is~~ — done; see the #19 entry in "What
  to do next" above and `docs/adr/0004-tag-scan-ocr-placement-and-usda-adapter.md`.
- **`/codebase-design`** — for module structure once ticket-writing starts,
  particularly the shared-TypeScript-package boundary from ADR-0003.
- **`/domain-modeling`** — if any term in `CONTEXT.md` needs sharpening
  during implementation.

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
