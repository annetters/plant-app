# Handoff: Personal Garden Plant Registry — plant-app

**Date:** 2026-08-12  
**Repo:** `annetters/plant-app` · branch `main`  
**Working dir:** `/Users/annette-arabasz/Documents/GitHub/plant-app`

---

## What this project is

A personal garden registry app for a gardener with 50–100 plantings who loses track of what's planted (especially in winter). The app has two linked core entities and four main views:

- **Plant** — species/variety-level record (common name, scientific name, cultivar, bloom window, flower color, sun/shade, mature size, hardiness zone, care task templates, reference photos)
- **Planting** — one placement decision referencing a Plant (quantity, bed + pin coordinates, year acquired, source, dated photo log)
- **Views:** Map (garden beds with pinned plantings), Registry (searchable/filterable plant list), Bloom Timeline (year-view bar chart), Dashboard (home screen)

Full spec: `docs/plant-app-spec.md`  
Domain glossary: `CONTEXT.md`

---

## Current state

The project is at the **pre-implementation** stage. Two commits exist:

```
5f9fbc7 Gitignore added
3697144 Init files
```

### What exists

| Artifact | Path | Purpose |
|---|---|---|
| Spec | `docs/plant-app-spec.md` | Full requirements, user stories, implementation & testing decisions, out-of-scope |
| Domain glossary | `CONTEXT.md` | Canonical term definitions — use these names exactly (Plant vs Planting, Bed, Pin, Landmark, Bloom Window, etc.) |
| Agent docs | `docs/agents/` | Issue tracker setup (`issue-tracker.md`), triage labels (`triage-labels.md`), domain context (`domain.md`) |
| Decisions | `docs/adr/` | **Architecture Decision Records — read these first.** ADR-0001 (bed drawing + smoothing), ADR-0002 (aerial base layer, derived scale, lot boundaries) |
| Prototype | `prototype/bed-editor/` | **Throwaway.** `index.html` — Konva bed editor. `smooth-correct.html` — post-draw smoothing UI variants |
| Prototype | `prototype/satellite-base/index.html` | **Throwaway.** Aerial base layer, address → scaled map, lot boundaries |

### What the prototypes validated

Full reasoning and the full list of constraints live in `docs/adr/`. In brief:

**`prototype/bed-editor/`** (see ADR-0001)
- Konva.js works for freehand, rect, oval, and bezier-pen bed drawing
- Grid snapping, zoom/pan, landmark placement, SVG export all work
- Raw spline tension alone gives poor organic shapes; Chaikin corner-cutting over
  decimated points is what produces usable bed blobs
- Smoothing should be an adjustable **post-draw** level, not a pre-draw toggle
- Open: which of the three smoothing-control UIs (panel slider / floating pill /
  drag-on-shape) to ship

**`prototype/satellite-base/`** (see ADR-0002)
- An address can be turned into a correctly scaled aerial base with no API key
- **The map scale is derived from latitude and tile zoom — the user never measures**
- Precision 2.2–8.3 in/px, comfortably inside the ~1 ft target
- Real lot boundaries are available where a jurisdiction publishes them; there is
  no free national source, so the feature must degrade gracefully
- The base layer must stay **optional** — tree canopy hides exactly the shade beds
  most worth recording

Both prototypes are **explicitly throwaway** — do not build on them. Extract
learnings only.

---

## Key decisions from the spec (don't re-litigate these)

- **Desktop-only bed creation** — freehand/shape drawing of bed outlines is desktop only; touchscreen was rejected as impractical
- **Phone + desktop pin placement** — placing Planting pins on the map works on both; rough tap or landmark-distance refinement, offered inline (not a separate guided mode)
- **No GPS pin positioning in the MVP** — deferred, *not* rejected permanently; revisit in a later phase (ADR-0002 records what would need to change). No user-taken ground photos as a base either. Top-down aerial imagery **is** in scope and is neither of those things.
- **No per-Planting task overrides** — task timing is on the Plant and applies to all its Plantings uniformly
- **Two task trigger types only** — (1) fixed calendar date range, (2) freeform seasonal-marker text; bloom-fade-relative triggers are out of scope
- **One Planting = one record** — a cluster of 24 crocus bulbs is one Planting with quantity=24, not 24 records
- **Data persistence deferred** — local vs. cloud-sync not decided yet; don't design around either

---

## Issue tracker

Issues live as GitHub issues in `annetters/plant-app`, managed via the `gh` CLI.  
See `docs/agents/issue-tracker.md` for the full workflow.

Triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`  
See `docs/agents/triage-labels.md`.

---

## What to do next

No implementation has started. Suggested starting points in priority order:

1. **Choose a tech stack** — the spec is stack-agnostic. The bed editor prototype used Konva.js (vanilla JS, no framework). Decide: web app (React/Vue + Konva?), native mobile (Swift/Kotlin?), or cross-platform (React Native/Flutter?). This decision gates everything else.
2. **Data model** — implement the Plant/Planting schema per the spec. Core invariants to test: (a) one Planting per placement decision regardless of quantity, (b) Plant task templates are inherited by all Plantings of that Plant.
3. **Bed editor (desktop)** — the prototype answers "does Konva.js work?" (yes); now build the real editor as a proper module, not a throwaway.
4. **Pin placement** — works on both desktop and mobile; rough tap + optional landmark-distance refinement inline.

---

## Suggested skills

When continuing this work, invoke these skills as relevant:

- **`mattpocock-skills:domain-modeling`** — if refining the Plant/Planting schema or task model before implementation
- **`mattpocock-skills:tdd`** — the spec has explicit testing decisions (see "Testing Decisions" section in `docs/plant-app-spec.md`); use TDD for the data model layer
- **`mattpocock-skills:prototype`** — if additional throwaway prototypes are needed to validate UX decisions (e.g. pin placement flow on mobile, bloom timeline interactions)
- **`mattpocock-skills:codebase-design`** — when choosing the tech stack and mapping out the module structure before coding starts
- **`figma:figma-generate-design`** — if the user wants to design screens in Figma before building
- **`figma:figma-swiftui`** — if going the SwiftUI/iOS native route

---

## Notes

- Use the exact terminology from `CONTEXT.md` — "Plant" and "Planting" are distinct; never use "plant" to mean both.
- The spec was produced via an extended interview session; several decisions reversed mid-session. The final decisions in the spec supersede any earlier framing.
- GitHub issues are the source of truth for work tracking — check `gh issue list` before starting new work to avoid duplication.
