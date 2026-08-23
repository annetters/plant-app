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

export function validateBedInput(input: BedInput): BedValidationResult {
  const errors: BedValidationErrors = {};

  if (!input.name.trim()) {
    errors.name = "Name is required.";
  }
  if (input.points.length < MIN_OUTLINE_POINTS) {
    errors.points = `A Bed outline needs at least ${MIN_OUTLINE_POINTS} points.`;
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
