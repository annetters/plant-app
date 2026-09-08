/**
 * A Bed's drawn outline (see `CONTEXT.md`). Desktop-only creation (ADR-0001)
 * with four drawing tools — freehand, rectangle, oval, bezier-pen — all of
 * which normalize down to the same thing: a closed polygon point list in
 * real-world feet, never pixels. Smoothing (freehand only, per ADR-0001) is
 * a non-destructive render-time transform: the raw traced points are always
 * what's stored, plus a flag, never the smoothed points alone.
 */

export type BedTool = "freehand" | "rectangle" | "oval" | "pen";

/** A point in real-world feet, relative to the Property's own local origin — never pixels. */
export interface BedPoint {
  x: number;
  y: number;
}

export interface BedInput {
  propertyId: string;
  name: string;
  tool: BedTool;
  /** Raw traced points, in feet — see ADR-0001: smoothing is applied at render time, never stored. */
  points: BedPoint[];
  smoothingEnabled: boolean;
}

export interface Bed extends BedInput {
  id: string;
  createdAt: string;
}

export type BedValidationErrors = Partial<Record<keyof BedInput, string>>;

export type BedValidationResult =
  | { ok: true }
  | { ok: false; errors: BedValidationErrors };

const MIN_OUTLINE_POINTS = 3;

/** Below this, a cross-product is floating-point noise from the pixel/feet round trip rather than a real turn. */
const ORIENTATION_EPSILON = 1e-9;

/** 0 = collinear, 1 = clockwise, 2 = counter-clockwise. */
function orientation(a: BedPoint, b: BedPoint, c: BedPoint): number {
  const value = (b.y - a.y) * (c.x - b.x) - (b.x - a.x) * (c.y - b.y);
  if (Math.abs(value) < ORIENTATION_EPSILON) return 0;
  return value > 0 ? 1 : 2;
}

/**
 * A *proper* crossing only: the two segments pass through each other, with no
 * endpoint merely touching and nothing collinear. Deliberately strict —
 * a hand-traced outline grazes or doubles back on itself constantly, and
 * treating those as errors would reject good freehand traces.
 */
function segmentsProperlyCross(p1: BedPoint, q1: BedPoint, p2: BedPoint, q2: BedPoint): boolean {
  const o1 = orientation(p1, q1, p2);
  const o2 = orientation(p1, q1, q2);
  const o3 = orientation(p2, q2, p1);
  const o4 = orientation(p2, q2, q1);
  if (o1 === 0 || o2 === 0 || o3 === 0 || o4 === 0) return false;
  return o1 !== o2 && o3 !== o4;
}

/**
 * Whether a closed outline passes through itself.
 *
 * This matters because `isPointInPolygon` (`planting.ts`) resolves a dropped
 * Pin with the even-odd rule: any region a self-overlapping outline encloses
 * an *even* number of times counts as outside it. A gardener then drops a Pin
 * somewhere plainly inside their Bed and is told "Drop the pin inside a Bed."
 * with Save disabled, with nothing on screen explaining why. A garden bed is
 * a simple region, so the outline that describes it should be one too.
 *
 * Test this against the outline a Bed actually *renders* as, not its raw
 * traced points — smoothing can move edges, and the rendered shape is what
 * Pin containment runs on. `validateBedInput` does exactly that.
 */
export function outlineSelfIntersects(points: readonly BedPoint[]): boolean {
  const n = points.length;
  // Fewer than four points can only cross itself by being degenerate, which
  // the point-count rule already covers.
  if (n < 4) return false;

  for (let i = 0; i < n; i++) {
    const p1 = points[i];
    const q1 = points[(i + 1) % n];
    for (let j = i + 1; j < n; j++) {
      // Neighbouring segments share an endpoint by construction, and segment
      // 0 wraps round to meet the last one — neither is a self-crossing.
      if (j === i + 1) continue;
      if (i === 0 && j === n - 1) continue;
      if (segmentsProperlyCross(p1, q1, points[j], points[(j + 1) % n])) return true;
    }
  }
  return false;
}

/**
 * The other Beds a name is checked against for uniqueness, and the Bed to
 * exclude from that check when one is being renamed rather than created.
 */
export interface BedValidationContext {
  existingBeds?: readonly { id: string; name: string }[];
  editingBedId?: string;
}

/** Bed names are compared case- and whitespace-insensitively: "Test" and " test " are the same name to a reader. */
function normalizeBedName(name: string): string {
  return name.trim().toLowerCase();
}

export function validateBedInput(input: BedInput, context: BedValidationContext = {}): BedValidationResult {
  const errors: BedValidationErrors = {};

  if (!input.name.trim()) {
    errors.name = "Name is required.";
  } else if (context.existingBeds) {
    // A Bed is identified by its id; the name is a convenience layer for the
    // gardener. But it's the layer the Registry's map links are written in
    // ("View in Front Border on the map"), so two Beds sharing a name make
    // those links ambiguous and make a misplaced Pin impossible to describe.
    const candidate = normalizeBedName(input.name);
    const clash = context.existingBeds.find(
      (bed) => bed.id !== context.editingBedId && normalizeBedName(bed.name) === candidate,
    );
    if (clash) {
      errors.name = `This Property already has a Bed called "${clash.name.trim()}". Give this one a different name.`;
    }
  }

  if (input.points.length < MIN_OUTLINE_POINTS) {
    errors.points = `A Bed outline needs at least ${MIN_OUTLINE_POINTS} points.`;
  } else if (outlineSelfIntersects(renderedOutlinePoints(input.points, input.tool, input.smoothingEnabled))) {
    errors.points =
      "This outline crosses over itself, so parts of it wouldn't accept a Pin. Redraw it as a single loop that doesn't cross.";
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true };
}

/**
 * Keep every Nth point from a traced path, always preserving the last point,
 * so smoothing works on the shape's structure rather than on hand jitter.
 * Ported from the validated prototype (`prototype/bed-editor/index.html`'s
 * `decimatePts` — see ADR-0001).
 */
export function decimatePoints(points: readonly BedPoint[], step: number): BedPoint[] {
  if (points.length === 0) return [];
  const out: BedPoint[] = [];
  for (let i = 0; i < points.length - 1; i += step) {
    out.push(points[i]);
  }
  out.push(points[points.length - 1]);
  return out;
}

/**
 * Chaikin corner-cutting over a *closed* point loop: each iteration replaces
 * every edge with two points at 1/4 and 3/4 along it, pulling corners inward
 * to produce a smooth blob. Ported from the validated prototype's `chaikin`
 * (see ADR-0001) — Beds are always closed outlines, so the loop wraps.
 */
export function chaikinSmooth(points: readonly BedPoint[], iterations: number): BedPoint[] {
  let current = points;
  for (let iteration = 0; iteration < iterations; iteration++) {
    const n = current.length;
    if (n < 3) break;
    const next: BedPoint[] = [];
    for (let i = 0; i < n; i++) {
      const curr = current[i];
      const after = current[(i + 1) % n];
      next.push(
        { x: 0.75 * curr.x + 0.25 * after.x, y: 0.75 * curr.y + 0.25 * after.y },
        { x: 0.25 * curr.x + 0.75 * after.x, y: 0.25 * curr.y + 0.75 * after.y },
      );
    }
    current = next;
  }
  return [...current];
}

const DECIMATE_STEP = 4;
const CHAIKIN_PASSES = 4;
/**
 * Below this many points, decimating at the fixed step leaves too few
 * points for a recognizable outline (e.g. a 4-9 point trace — a quick,
 * short freehand drag — decimates to just 2-3 points, which
 * `chaikinSmooth` can't do anything with). Decimation is skipped below
 * this floor; Chaikin still runs on the raw points, which stays safe no
 * matter how few there are.
 */
const MIN_POINTS_TO_DECIMATE = 10;

/**
 * The MVP's pre-draw smoothing toggle (ADR-0001): fixed strength, decimate
 * to every 4th point then 4 Chaikin passes, applied at render time. Never
 * mutates the stored raw points.
 */
export function smoothBedOutline(
  points: readonly BedPoint[],
  smoothingEnabled: boolean,
): BedPoint[] {
  if (!smoothingEnabled) return [...points];
  const base = points.length >= MIN_POINTS_TO_DECIMATE ? decimatePoints(points, DECIMATE_STEP) : points;
  return chaikinSmooth(base, CHAIKIN_PASSES);
}

/**
 * A Bed's outline as it's actually rendered — raw points as-is for
 * rectangle/oval/pen, smoothed for freehand (ADR-0001: smoothing is
 * computed at render time, never stored). The single source of truth for
 * "which points represent this Bed right now", shared by every renderer
 * (web's Konva outline, the phone's SVG polygon) and by the Pin-drop
 * containment test — so a dragged Pin resolves against the same shape
 * that's actually drawn on screen, on both surfaces.
 */
export function renderedOutlinePoints(
  points: readonly BedPoint[],
  tool: BedTool,
  smoothingEnabled: boolean,
): BedPoint[] {
  return tool === "freehand" ? smoothBedOutline(points, smoothingEnabled) : [...points];
}

/**
 * Every Bed swapped onto the outline it actually renders as (see
 * `renderedOutlinePoints`) — the shape a dropped Pin must be tested against,
 * since resolving against raw traced points would put a Pin in a Bed the
 * gardener can plainly see it's outside of (a smoothed freehand corner sits
 * well inside its own trace).
 *
 * Separate from `resolvePinDrop` (`planting.ts`) because a drag resolves on
 * every frame while these outlines only change when the Beds do: compute
 * this once per Bed list and hand the result to each `resolvePinDrop` call,
 * rather than re-smoothing every Bed on every pointer move.
 */
export function renderedBedOutlines<
  T extends { points: readonly BedPoint[]; tool: BedTool; smoothingEnabled: boolean },
>(beds: readonly T[]): (Omit<T, "points"> & { points: BedPoint[] })[] {
  return beds.map((bed) => ({
    ...bed,
    points: renderedOutlinePoints(bed.points, bed.tool, bed.smoothingEnabled),
  }));
}

/** Rounds to the nearest thousandth of a foot — far finer than the app's ~1ft/px target, just enough to absorb floating-point noise from a pixel/feet round trip. */
function roundFeet(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Real-world feet -> canvas pixels, at a given Property scale (feet -> pixels ratio). Never rounded — pixels are render-only. */
export function feetToPixels(points: readonly BedPoint[], pixelsPerFootValue: number): BedPoint[] {
  return points.map((p) => ({ x: p.x * pixelsPerFootValue, y: p.y * pixelsPerFootValue }));
}

/**
 * Canvas pixels -> real-world feet, at a given Property scale. This is the
 * direction that produces what gets stored, so it's rounded — see
 * `roundFeet`. Scale-independent by design: the same feet points survive a
 * later change of scale (e.g. the Property's base image being replaced)
 * untouched, only their *rendering* changes.
 */
export function pixelsToFeet(points: readonly BedPoint[], pixelsPerFootValue: number): BedPoint[] {
  return points.map((p) => ({
    x: roundFeet(p.x / pixelsPerFootValue),
    y: roundFeet(p.y / pixelsPerFootValue),
  }));
}

/** The `beds` table's row shape — the seam between domain types and Postgres. */
export interface BedRow {
  id: string;
  property_id: string;
  name: string;
  tool: BedTool;
  points: BedPoint[];
  smoothing_enabled: boolean;
  created_at: string;
}

export function bedInputToRow(input: BedInput): Omit<BedRow, "id" | "created_at"> {
  return {
    property_id: input.propertyId,
    name: input.name,
    tool: input.tool,
    points: input.points,
    smoothing_enabled: input.smoothingEnabled,
  };
}

export function bedFromRow(row: BedRow): Bed {
  return {
    id: row.id,
    createdAt: row.created_at,
    propertyId: row.property_id,
    name: row.name,
    tool: row.tool,
    points: row.points,
    smoothingEnabled: row.smoothing_enabled,
  };
}
