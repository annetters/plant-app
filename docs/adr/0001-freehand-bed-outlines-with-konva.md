# ADR-0001: Freehand Bed outlines drawn with Konva, smoothed after the fact

## Status

Accepted — 2026-08-13.

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

**Smoothing is an adjustable post-draw property, not a pre-draw mode.** The
user draws, then dials the shape from `Original` through to `Blob` on a
9-level scale. Higher levels increase both the decimation step and the number
of Chaikin passes, so the shape gets progressively rounder.

## Consequences

- Beds store a point list plus a smoothing level, so the original traced shape
  is preserved and smoothing stays non-destructive and re-adjustable.
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

## Open

Which smoothing control UI to ship. `smooth-correct.html` explores three, and
no verdict has been recorded:

- **A** — slider in the side panel
- **B** — floating pill near the shape
- **C** — drag directly on the shape

Pick one before building the real editor.
