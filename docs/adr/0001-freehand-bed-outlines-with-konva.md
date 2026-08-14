# ADR-0001: Freehand Bed outlines drawn with Konva, smoothed after the fact

## Status

Accepted — 2026-08-13. **Amended the same day**: the smoothing control was
changed from an adjustable post-draw level to a binary pre-draw toggle, and
the open question this ADR carried is now closed. See "Smoothing control".

Validated by the throwaway prototypes `prototype/bed-editor/index.html` and
`prototype/bed-editor/smooth-correct.html`. Neither is production code; extract
learnings only.

## Context

A Bed is "a drawn map area representing a physical garden section" with a
freehand or shape-based outline (see `CONTEXT.md`). Real garden beds are
organic, curved shapes, not rectangles. Two questions had to be answered before
building the real editor:

1. Is a canvas library workable for desktop bed drawing at all?
2. A raw mouse-traced path looks jittery and hand-drawn. How do we get shapes
   that read as smooth garden beds without the user having to trace perfectly?

## Decision

**Use Konva.js for the desktop bed editor.** The prototype confirmed freehand,
rectangle, oval and bezier-pen drawing, grid snapping, zoom/pan, landmark
placement, and SVG export all work.

**Smooth freehand strokes with Chaikin corner-cutting applied to decimated
points**, not with spline tension alone:

- Decimate the raw path first (keep every Nth point), so the algorithm works on
  the shape's structure rather than on hand jitter.
- Then run Chaikin corner-cutting passes over the decimated points.
- Raw tension-based smoothing alone was tried first and was not sufficient.

**Ship smoothing as a binary pre-draw toggle for the MVP.** Superseded the
original post-draw framing on 2026-08-13 — see "Smoothing control" below.
Freehand strokes are either smoothed at fixed strength (decimate to every 4th
point, then 4 Chaikin passes) or left raw. This is the behaviour already in
`prototype/bed-editor/index.html`.

An adjustable post-draw level — dialling the shape from `Original` through to
`Blob` on a 9-level scale, where higher levels increase both the decimation
step and the Chaikin pass count — was prototyped and works, but is **deferred
to a later drawing-experience phase**, not adopted.

## Consequences

- Beds store the raw traced point list plus a smoothing flag — never the
  smoothed points alone. Smoothing stays non-destructive and is recomputed on
  render. Storing the raw path is what keeps the deferred adjustable-level
  work open: a boolean can widen to a 0–8 level later without a migration of
  the geometry itself.
- **Gotcha worth keeping:** the closed shape needs `tension: 0.5` on the Konva
  line. At lower tension the implicit closing join renders as a flat segment
  while every other edge is curved, which looks like a bug in the shape.
- Chaikin passes are capped at 5 — beyond that, extra iterations over few
  remaining control points give diminishing returns.
- Bed creation stays **desktop-only**. Touchscreen freehand tracing of precise
  outlines was evaluated and rejected as impractical. Pin placement is a
  separate concern and does work on phone.
- The prototype used vanilla JS with no framework. That is not a commitment —
  the stack decision is still open.

## Smoothing control

**Resolved 2026-08-13: none of the three post-draw variants ship.**

`smooth-correct.html` prototyped three ways to expose an adjustable post-draw
smoothing level:

- **A** — slider in the side panel
- **B** — floating pill near the shape
- **C** — drag directly on the shape

All three were rejected on feel. The MVP keeps the original pre-draw toggle
instead, and honing the drawing experience is deferred to its own phase.

Worth knowing for whoever picks that phase up: the rejection was of these
three *interactions*, not of adjustable smoothing as an idea, and not of the
algorithm. The 9-level Chaikin scale in `smooth-correct.html` works and its
level labels (`Original` → `Blob`) read well; what none of A/B/C got right was
where the control lives and when it appears. Starting that phase by
re-prototyping the same three patterns would repeat settled work.
