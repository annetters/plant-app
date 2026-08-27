/**
 * Scale Reference (see CONTEXT.md): establishes a Property's scale when it
 * has none of its own — i.e. its base map is a photographed plot plan/survey
 * or a plan drawn in the app, neither of which carries an inherent scale the
 * way aerial imagery does (see `property.ts`'s `pixelsPerFoot`).
 *
 * Both entry modes described in CONTEXT.md — known-measurement and
 * measured-object — reduce to the exact same underlying data and the same
 * math here: two points plus a real-world distance. The mode is kept only to
 * drive which prompt/copy the UI shows; it changes nothing about how scale is
 * derived.
 */

/** A point in the base-map image/canvas's own pixel space — never feet. */
export interface ScalePoint {
  x: number;
  y: number;
}

export type ScaleReferenceMode = "known-measurement" | "measured-object";

export interface ScaleReferenceInput {
  pointA: ScalePoint;
  pointB: ScalePoint;
  /** The real-world distance between pointA and pointB, in feet. */
  realDistanceFeet: number;
  mode: ScaleReferenceMode;
}

export type ScaleReferenceValidationErrors = Partial<Record<keyof ScaleReferenceInput, string>>;

export type ScaleReferenceValidationResult =
  | { ok: true }
  | { ok: false; errors: ScaleReferenceValidationErrors };

/** Two points picked on top of the same distant edge collapse the derived scale toward infinity — this floor keeps that a validation error, not a silently unusable result. */
const MIN_POINT_SEPARATION_PX = 2;

function pointDistance(a: ScalePoint, b: ScalePoint): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

export function validateScaleReferenceInput(
  input: ScaleReferenceInput,
): ScaleReferenceValidationResult {
  const errors: ScaleReferenceValidationErrors = {};

  if (!(input.realDistanceFeet > 0)) {
    errors.realDistanceFeet = "Enter a real-world distance greater than 0.";
  }
  if (pointDistance(input.pointA, input.pointB) < MIN_POINT_SEPARATION_PX) {
    errors.pointB = "Pick two distinct points, not the same spot twice.";
  }

  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true };
}

/**
 * Two points plus a real-world distance -> pixels-per-foot, per CONTEXT.md's
 * Scale Reference. A longer baseline between the two points makes this far
 * less sensitive to small tap or measurement error — the UI should encourage
 * that, but this function itself has no opinion on baseline length beyond
 * `validateScaleReferenceInput`'s floor above.
 */
export function derivePixelsPerFootFromScaleReference(reference: ScaleReferenceInput): number {
  return pointDistance(reference.pointA, reference.pointB) / reference.realDistanceFeet;
}
