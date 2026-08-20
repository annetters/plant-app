# Handoff: Personal Garden Plant Registry — plant-app

**Date:** 2026-08-20
**Repo:** `annetters/plant-app` · branch `main`

---

## What to do next

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

**#4 (Care task templates on Plant) is implemented, committed, and manually
exercised against the real Supabase project** (add a date-range template,
add a seasonal-marker template, remove a template) — see commit `4eea9e7`
and the follow-up fix commits below. **Not yet closed on GitHub** —
migrations `0003`/`0004` are live on the linked project, but the deferred
QA items below (mirroring #3's list) haven't all been run, so it's holding
open pending a final pass rather than closed prematurely.

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
- **⚠️ Action needed**: migration `0005_plant_hardiness_zone_range.sql`
  **drops the old `hardiness_zone` text column** and adds
  `hardiness_zone_min`/`hardiness_zone_max` — this has **not** been
  pushed to the linked Supabase project yet (unlike #4's migrations,
  which were pushed mid-session). If any real Plant row already has a
  `hardiness_zone` value set, pushing this migration discards it — there
  is no backfill, since this is a personal single-user app and none of
  the manual QA so far saved one. Confirm that's still true (or export
  the value first) before running `npm run db:push`.
- Added a divider between the Plant edit page's post-form sections
  (Reference photos, Care task templates, Delete) and restored a bulleted
  list for the Registry's saved-plants list (scoped so Dashboard/other
  lists stay marker-free).

**Go straight to `/implement`, picking a ticket off the frontier.**

`/to-tickets` has already run against issue #1. Nineteen tickets are
published as GitHub issues **#2–#20**, each labeled `ready-for-agent`, each
linked to #1 as parent, with GitHub's native issue-dependency ("blocked by")
edges wired between them — see "Issue tracker" below for the full map.
**#21** was filed ad hoc during #4's manual QA, labeled `needs-triage`, not
part of the original 19.

**The frontier right now** (open tickets with zero open blockers, no
assignee — safe to start immediately):

- **#5** — Property + aerial base map — independent, map/base-layer work
- **#13** — React Native app scaffold + auth — mirrors #2 for mobile
- **#19** — Tag Scan prototype: OCR placement + USDA data pull — unchanged
  since last update

**#4** is implemented but intentionally left open (see above) rather than
listed as frontier work to pick up — don't re-implement it. **#12** (Task
completion logging) is still blocked: #4 alone isn't enough to unblock it,
it also needs #8 (Planting) and #11 (Dashboard).

Run `/implement` in a **fresh session**, pointed at whichever ticket number
you pick — that's the context-hygiene pattern the flow expects (grilling →
spec → tickets stays one unbroken window; each `/implement` starts clean from
the ticket alone). As each ticket closes, re-run the frontier query (see
"Issue tracker") to see what newly unblocked.

Nothing here is stale-checked for you the way the old "three uncommitted
files" note used to be — `git status` was clean as of this update.

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

### Deferred QA (ticket #4)

The add/remove/wraparound flows above were exercised manually; these were
not, and are the reason #4 is still open rather than closed:

1. **RLS via the `plants` join** — log in as account A, add a care task
   template to one of A's plants; log in as account B, confirm the
   template isn't readable/writable. New ownership-check pattern (a join
   to `plants`, not a direct `user_id` column like #3's), never proven
   against real Postgres.
2. **Reload persistence** — refresh the Plant edit page after adding
   templates; confirm they still load (exercises `listCareTaskTemplates`
   on a fresh mount, not just in-session state).
3. **Validation errors in the browser** — blank name, invalid trigger date
   parts, blank seasonal-marker text; confirm inline messages render as
   expected (covered by unit tests with a fake DB client, not eyeballed in
   a real browser).

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

Working tree clean (`git status` verified 2026-08-20). Most recent commits
first:

```
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
QA), and `4eea9e7`–`9b74934` (#4, plus fixes found during manual QA,
including the hardiness-zone-range rework in `9b74934`) are the build
work so far. #3 is closed on GitHub. #4 is implemented and partially
verified but **not yet closed on GitHub** — see "What to do next" above
and "Deferred QA (ticket #4)". `9b74934`'s migration (`0005`) is **not
yet pushed** — see the "⚠️ Action needed" note above before running
`npm run db:push`. The remaining 16 tickets (#5–#20) are still unbuilt;
#21 (filed during #4's QA) is `needs-triage`, not yet scoped for build.

> On `14957a9`'s message: the satellite prototype is **not** GPS exploration.
> No GPS is read and no user photo is taken — that is exactly why the work was
> in scope when GPS positioning was not. See ADR-0002.

### What exists

| Artifact | Path | Purpose |
|---|---|---|
| **App (real, built)** | `packages/domain`, `apps/web` | Ticket #2's output (npm-workspaces monorepo, shared TS `domain` package, Vite/React/TS web app, Supabase auth, auth-gated Dashboard shell) plus ticket #3's output (`Plant`/`PlantInput` types + `validatePlantInput` in `packages/domain/src/plant.ts`; Registry list + create/view/edit/delete + reference-photo upload in `apps/web/src/routes/Plants*.tsx` and `apps/web/src/plants/`) plus ticket #4's output (`TaskTrigger`/`CareTaskTemplate` types + `validateCareTaskTemplateInput` + `computeTriggerDateRange`/`dateRangeWraps` in `packages/domain/src/careTaskTemplate.ts`; add/list/remove UI in the "Care task templates" section of `apps/web/src/routes/PlantFormPage.tsx`, repository methods on `PlantsRepository`). See `apps/web/README.md` for the one-time Supabase project setup. Not throwaway — build on this. |
| **DB schema** | `supabase/migrations/` | SQL migrations, applied via the Supabase CLI (`npm run db:push`) against the linked remote project — no local Docker stack, by explicit preference. `0001_plants.sql` — the `plants` table, RLS, `plant-reference-photos` storage bucket. `0002_grant_plants_table.sql` — follow-up GRANT the API roles need on newer Supabase projects (RLS alone isn't enough; see the migration's own comment). `0003_care_task_templates.sql` — the `care_task_templates` table, owned by a `plant_id` FK with RLS via a join to `plants` (not a direct `user_id` column). `0004_grant_care_task_templates_table.sql` — the same follow-up GRANT `0002` needed, for the new table. `0001`–`0004` are live on the linked project (verify with `npx supabase migration list`). `0005_plant_hardiness_zone_range.sql` — drops `hardiness_zone`, adds `hardiness_zone_min`/`hardiness_zone_max` (a plant's hardiness rating is a whole-zone range, not a single value — see "What to do next"). **Not yet pushed** — read the "⚠️ Action needed" note before running `npm run db:push`. Apply new ones with `npm run db:push`, diff with `npm run db:diff`, regenerate row types with `npm run db:types`. |
| **Spec (current)** | [GitHub issue #1](https://github.com/annetters/plant-app/issues/1) | The real spec. 53 user stories, full implementation/testing decisions. Labeled `ready-for-agent`. |
| Spec (superseded) | `docs/plant-app-spec.md` | The original file-based spec, written before this repo had an issue tracker. Kept for history; has a banner pointing to issue #1. Do not implement against it. |
| Domain glossary | `CONTEXT.md` | Canonical term definitions — Plant, Planting, Property, Scale Reference, Bed, Landmark (deferred), Pin, Tag Scan, Task model, Registry, Bloom Timeline, Dashboard |
| Agent docs | `docs/agents/` | Issue tracker setup, triage labels, domain context |
| Decisions | `docs/adr/` | **Read these — they're normative, and win over the spec where they disagree.** ADR-0001 (bed drawing + smoothing), ADR-0002 (base layer, Property, Scale Reference — amended), ADR-0003 (platform, persistence, native app scope, domain-logic execution — amended) |
| Research | `docs/research/plant-data-source-cultivar-level-evaluation.md` | Which external plant databases were checked for Tag Scan, and why. USDA PLANTS adopted; IPNI ruled out; Proven Winners / Missouri Botanical Garden / NC State logged as unresearched future candidates. |
| Prototype | `prototype/bed-editor/` | **Throwaway.** `index.html` — Konva bed editor; pre-draw smoothing toggle is what ships. `smooth-correct.html` — three post-draw smoothing UIs, all rejected. |
| Prototype | `prototype/satellite-base/index.html` | **Throwaway.** Aerial base layer, address → scaled map, lot boundaries. |

Both prototypes are explicitly throwaway — do not build on them, extract
learnings only. Full reasoning lives in `docs/adr/`.

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
- **Recommended before full build**: a `/prototype` pass on OCR (real tags)
  and the USDA data pull — unlike the other three adapters, these have had
  zero hands-on validation.

**Everything else (unchanged from the original spec):**
- One Planting = one record, `quantity` field, never one record per specimen
- No per-Planting task overrides; task timing lives on Plant only
- Two task trigger types only: fixed date-range, freeform seasonal-marker
- Task completion keyed by template + Planting + year (all three needed)
- Bezier-pen is in scope for the bed editor, alongside freehand and
  rectangle/oval — all three validated in the ADR-0001 prototype

### Open, but not blocking

- **Which OCR: on-device or a cloud API?** Raised, never answered. This
  isn't a minor detail — ADR-0003's domain-logic-execution split assumed
  OCR needs server-side treatment like the other adapters, which is only
  true if it turns out to be a cloud API with a credential to protect. If
  it's on-device (e.g. Apple's Vision framework — plausible, given
  iPhone-first: free, offline, no credential at all), it could run in the
  shared client package instead. **Don't build OCR integration assuming
  either answer.** Resolve this as part of the Tag Scan prototype pass
  above — testing on-device OCR against real nursery tags is exactly how
  you'd find out whether it's accurate enough to skip the cloud option.

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
| 4 | Care task templates on Plant — built, `4eea9e7`–`8ce7a48`, **open** (deferred QA) | 3 |
| 5 | Property + aerial base map | 2 |
| 6 | Property: photographed/in-app-drawn base map + Scale Reference | 5 |
| 7 | Bed drawing (desktop) | 5 |
| 8 | Planting: create + place Pin, view on tap | 3, 7 |
| 9 | Bloom Timeline | 3, 8 |
| 10 | Registry view | 3, 8 |
| 11 | Dashboard (real content) | 7, 8, 9, 10 |
| 12 | Task completion logging, history, one-off todos | 4, 8, 11 |
| 13 | React Native app scaffold + auth | 2 |
| 14 | Native: Map view | 8, 13 |
| 15 | Native: Scale Reference calibration | 6, 13 |
| 16 | Native: Registry view | 10, 13 |
| 17 | Native: Bloom Timeline | 9, 13 |
| 18 | Native: Plant/Planting detail, tasks & todos | 3, 8, 12, 13 |
| 19 | Tag Scan prototype: OCR placement + USDA data pull | — |
| 20 | Tag Scan build | 3, 13, 19 |
| 21 | Care task template: single-day trigger UX (filed during #4 QA, `needs-triage`) | 4 |

**Frontier query**: open issues with `issue_dependencies_summary.blocked_by
== 0` and no assignee. #2 and #3 are closed. #4 has `blocked_by == 0` too
(its blocker, #3, is closed) but is deliberately excluded from the frontier
below — it's built and awaiting closure, not unstarted work. Right now the
frontier is **#5, #13, #19** — see "What to do next" above. #21 is
`needs-triage`, not `ready-for-agent`, so it's excluded from the frontier
query by design until triaged.

---

## Suggested skills

- **`/implement`** — the immediate next step. Run once per ticket, fresh
  session each time, pointed at a ticket number from the frontier (see
  "Issue tracker" above). Drives `/tdd` internally, closes with
  `/code-review`. Don't run `/to-tickets` again — tickets #2–#20 are already
  published.
- **`/prototype`** — what #19 actually is. Ticket #19 already frames the
  scope (real nursery tags through candidate OCR options, a real USDA pull);
  running `/implement` on it should drive `/prototype` internally the way
  `/implement` drives `/tdd` for build tickets.
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
