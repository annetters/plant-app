# Handoff: Personal Garden Plant Registry — plant-app

**Date:** 2026-08-13  
**Repo:** `annetters/plant-app` · branch `main`

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

The project is at the **pre-implementation** stage — no application code exists
yet, in any language. Four commits, all of them documents and prototypes:

```
14957a9 Second prototype added to explore GPS
492266b Added handoff document
5f9fbc7 Gitignore added
3697144 Init files
```

> On `14957a9`'s message: the satellite prototype is **not** GPS exploration.
> No GPS is read and no user photo is taken — that is exactly why the work was
> in scope when GPS positioning was not. See ADR-0002.

### What exists

| Artifact | Path | Purpose |
|---|---|---|
| Spec | `docs/plant-app-spec.md` | Full requirements, user stories, implementation & testing decisions, out-of-scope |
| Domain glossary | `CONTEXT.md` | Canonical term definitions — use these names exactly (Plant vs Planting, Bed, Pin, Landmark, Bloom Window, etc.) |
| Agent docs | `docs/agents/` | Issue tracker setup (`issue-tracker.md`), triage labels (`triage-labels.md`), domain context (`domain.md`) |
| Decisions | `docs/adr/` | **Architecture Decision Records — read these first.** ADR-0001 (bed drawing + smoothing), ADR-0002 (aerial base layer, derived scale, lot boundaries) |
| Prototype | `prototype/bed-editor/` | **Throwaway.** `index.html` — Konva bed editor; its pre-draw smoothing toggle is the behaviour the MVP ships. `smooth-correct.html` — three post-draw smoothing UIs, all rejected |
| Prototype | `prototype/satellite-base/index.html` | **Throwaway.** Aerial base layer, address → scaled map, lot boundaries |

### What the prototypes validated

Full reasoning and the full list of constraints live in `docs/adr/`. In brief:

**`prototype/bed-editor/`** (see ADR-0001)
- Konva.js works for freehand, rect, oval, and bezier-pen bed drawing
- Grid snapping, zoom/pan, landmark placement, SVG export all work
- Raw spline tension alone gives poor organic shapes; Chaikin corner-cutting over
  decimated points is what produces usable bed blobs
- Smoothing ships as a binary **pre-draw** toggle at fixed strength. An
  adjustable post-draw level was prototyped and rejected on feel; all three of
  its candidate UIs (panel slider / floating pill / drag-on-shape) were turned
  down. Honing the drawing experience is deferred to its own phase.

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
- **Bed smoothing is a binary pre-draw toggle** — adjustable post-draw smoothing was built and rejected; don't rebuild it (ADR-0001). Beds store the *raw* traced points plus a flag, never the smoothed points, so the deferred adjustable version stays possible without a geometry migration.
- **Data persistence deferred** — local vs. cloud-sync not decided yet; don't design around either

---

## Issue tracker

Issues live as GitHub issues in `annetters/plant-app`, managed via the `gh` CLI.  
See `docs/agents/issue-tracker.md` for the full workflow.

Triage labels: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`  
See `docs/agents/triage-labels.md`.

**The labels are configured, but there are currently zero issues.** Nothing has
been broken down into tickets yet — see below.

---

## What to do next

The thinking phase is essentially done: the spec is complete, the glossary is
clean, both design questions that needed runnable answers have been prototyped
and written up as ADRs, and ADR-0001's open question is now closed.

**One decision blocks everything else.**

### 1. Choose a tech stack, and decide persistence alongside it

The spec is deliberately stack-agnostic, and ADR-0001 is explicit that the
prototype's vanilla-JS/Konva choice **is not a commitment**. Decide: web app
(React/Vue + Konva?), native mobile (Swift/Kotlin?), or cross-platform (React
Native/Flutter?).

Take the deferred **local vs. cloud-sync** persistence question (spec line 80)
in the same session — the two interact, and answering them apart risks
answering them inconsistently.

This gates ticket-writing, not just coding: nearly every ticket's shape depends
on it. "Desktop-only bed creation, pin placement on both" means structurally
different things in a responsive web app versus two native clients.

Record the outcome as **ADR-0003**.

**Settle one more thing in that session: does grid scale belong on the Bed?**
`CONTEXT.md` currently puts it there. But when the aerial base layer is in use,
scale is derived once from latitude and tile zoom, so every Bed on that base
shares it — and a per-Bed scale would let two Beds on one image disagree about
the length of a foot. Per-Bed scale may still be correct for the blank-canvas
fallback. It's a schema question, it interacts with persistence, and it is
flagged as *Open* in `CONTEXT.md` under **Bed**.

### Open, but not blocking

- **Is the bezier-pen tool in scope?** ADR-0001 lists it as validated in the
  prototype; the spec's tool list is only freehand plus rectangle/oval. Decide
  when the bed editor ticket is written, not before.

### 2. Break the spec into tickets

Once the stack is settled, go straight to ticket-writing — **do not re-derive a
spec first**, `docs/plant-app-spec.md` already is one. Tickets go to GitHub
issues with blocking edges between them, so any ticket whose blockers are done
can be picked up.

Likely early tickets, blockers-first:

- **Data model** — the Plant/Planting schema. Core invariants to test: (a) one
  Planting per placement decision regardless of quantity, (b) Plant task
  templates are inherited by every Planting of that Plant.
- **Bed editor (desktop)** — the prototype answered "does Konva.js work?" (yes).
  Build the real editor as a proper module. Pre-draw smoothing toggle only.
- **Aerial base layer** — optional, with a blank-canvas fallback that is
  *required*, not a nice-to-have (ADR-0002).
- **Pin placement** — desktop and mobile; rough tap plus optional
  landmark-distance refinement, offered inline.

### 3. Implement, one ticket per context window

Each ticket is self-contained, so clear context between them.

---

## Suggested skills

This project has been run using the Matt Pocock skill set. If you have it
installed, the next three steps map onto it directly:

- **`/grill-with-docs`** — for step 1, the stack + persistence decision. It's
  stateful, so it updates `CONTEXT.md` and writes ADR-0003 as it goes.
- **`/to-tickets`** — for step 2. Skip `/to-spec`; the spec already exists.
- **`/implement`** — for step 3, once per ticket, clearing context between each.
  It drives `/tdd` internally and closes with `/code-review`.

Keep steps 1 and 2 in one unbroken context window so the decision and the
tickets build on the same thinking.

Also relevant:

- **`/codebase-design`** — for module structure once the stack is known
- **`/tdd`** — the spec has explicit testing decisions; use it for the data model
- **`/prototype`** — if another UX question needs a runnable answer (mobile pin
  placement flow and bloom timeline interactions are the untested ones)
- **`/domain-modeling`** — if the Plant/Planting or task vocabulary needs
  sharpening; it's what keeps `CONTEXT.md` clean

If you don't have these skills, the steps above stand on their own — they just
describe the ordinary flow of decide → break down → build.

---

## Notes

- Use the exact terminology from `CONTEXT.md` — "Plant" and "Planting" are distinct; never use "plant" to mean both.
- The spec was produced via an extended interview session; several decisions reversed mid-session. The final decisions in the spec supersede any earlier framing.
- **Where the ADRs and the spec disagree, the ADRs win** — they're newer and both say so explicitly. ADR-0002 narrows the spec's over-broad "no photo-based mapping" wording, and largely retires user story 21 (the user no longer measures anything, since scale is derived).
- GitHub issues are the source of truth for work tracking — check `gh issue list` before starting new work to avoid duplication.
