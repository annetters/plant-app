# Handoff: Personal Garden Plant Registry — plant-app

**Date:** 2026-08-19
**Repo:** `annetters/plant-app` · branch `main`

---

## What to do next

**Go straight to `/implement`, picking a ticket off the frontier.**

`/to-tickets` has already run against issue #1. Nineteen tickets are
published as GitHub issues **#2–#20**, each labeled `ready-for-agent`, each
linked to #1 as parent, with GitHub's native issue-dependency ("blocked by")
edges wired between them — see "Issue tracker" below for the full map.

**The frontier right now** (open tickets with zero open blockers — safe to
start immediately):

- **#2** — Repo scaffold, Supabase backend, and web auth walking skeleton
- **#19** — Tag Scan prototype: OCR placement + USDA data pull

Run `/implement` in a **fresh session**, pointed at whichever ticket number
you pick — that's the context-hygiene pattern the flow expects (grilling →
spec → tickets stays one unbroken window; each `/implement` starts clean from
the ticket alone). As each ticket closes, re-run the frontier query (see
"Issue tracker") to see what newly unblocked.

Nothing here is stale-checked for you the way the old "three uncommitted
files" note used to be — `git status` was clean as of this update.

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

Eight commits, working tree clean (`git status` verified 2026-08-19):

```
1f756b1 Resolve bezier-pen scope, flag OCR execution as still open, refresh handoff
eaf1f32 Add ADR-0003: web desktop + native mobile, cloud BaaS backend
86f3772 Design Property, Scale Reference, and Tag Scan; correct base-layer purpose
85fcd4c Resolve ADR-0001 smoothing question, reconcile spec and glossary
14957a9 Second prototype added to explore GPS
492266b Added handoff document
5f9fbc7 Gitignore added
3697144 Init files
```

No code has been written yet — these commits are all docs/prototypes/spec.
The 19 tickets (#2–#20) are the first actual build work.

> On `14957a9`'s message: the satellite prototype is **not** GPS exploration.
> No GPS is read and no user photo is taken — that is exactly why the work was
> in scope when GPS positioning was not. See ADR-0002.

### What exists

| Artifact | Path | Purpose |
|---|---|---|
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
| 2 | Repo scaffold, Supabase backend, web auth skeleton | — |
| 3 | Plant record CRUD (manual entry) | 2 |
| 4 | Care task templates on Plant | 3 |
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

**Frontier query**: open issues with `issue_dependencies_summary.blocked_by
== 0` and no assignee. Right now that's **#2** and **#19** — see "What to do
next" above.

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
