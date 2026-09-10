/**
 * What a Property's map scale *is*, in terms a gardener can check — as
 * opposed to `pixelsPerFootForProperty`, which answers only "is there one,
 * and what do I multiply by" for the code that draws.
 *
 * Ticket #28: neither app ever showed the derived scale, so a wrong
 * calibration was indistinguishable from a right one. #6 shipped exactly
 * that failure — `BaseMapSetup` calibrated against a 512px canvas while the
 * rest of the stack rendered at 768px, putting every Bed and Pin ~1.5x off,
 * and it took a code review rather than a look at the screen to catch.
 */
import { STAGE_SIZE_PX } from "./baseMap.js";
import { pixelsPerFootForProperty, type Property } from "./property.js";

/**
 * Where a scale came from. `'aerial-imagery'` is derived from latitude and
 * imagery zoom and has no gardener-supplied input in it; `'scale-reference'`
 * is the two points and a distance the gardener entered themselves (see
 * `scaleReference.ts`), which is the only one that can be wrong, and so the
 * only one worth offering to redo.
 */
export type CalibrationSource = "aerial-imagery" | "scale-reference";

export interface CalibratedBaseMap {
  calibrated: true;
  derivedFrom: CalibrationSource;
  pixelsPerFoot: number;
  /**
   * How much ground the full-size map surface covers edge to edge. This is
   * the figure a gardener can actually falsify: "2.75 px per ft" reads as
   * plausible whatever it is, but "about 420 ft across" is obviously wrong
   * on a 180 ft lot.
   */
  mapWidthFeet: number;
  /** Whether the gardener can redo this calibration — see `CalibrationSource`. */
  recalibratable: boolean;
}

export interface UncalibratedBaseMap {
  calibrated: false;
  /**
   * The two cases want different wording and different next steps: no
   * imagery is a dead end for an aerial Property (it has to fall back to
   * photo/drawn), where a missing Scale Reference is just an unfinished
   * setup.
   */
  reason: "no-aerial-imagery" | "no-scale-reference";
}

export type BaseMapCalibration = CalibratedBaseMap | UncalibratedBaseMap;

export function baseMapCalibration(property: Property): BaseMapCalibration {
  const value = pixelsPerFootForProperty(property);
  if (value === null) {
    return {
      calibrated: false,
      reason: property.baseMapSource === "aerial" ? "no-aerial-imagery" : "no-scale-reference",
    };
  }
  const derivedFrom: CalibrationSource =
    property.baseMapSource === "aerial" ? "aerial-imagery" : "scale-reference";
  return {
    calibrated: true,
    derivedFrom,
    pixelsPerFoot: value,
    mapWidthFeet: STAGE_SIZE_PX / value,
    recalibratable: derivedFrom === "scale-reference",
  };
}

/**
 * Two decimals, trailing zeroes dropped. Two rather than one because an
 * aerial scale is routinely below 1 px per ft at the lower zooms, where a
 * single decimal collapses distinct scales onto the same "0.7".
 */
export function formatPixelsPerFoot(pixelsPerFootValue: number): string {
  return `${Number(pixelsPerFootValue.toFixed(2))} px per ft`;
}

/** Whole feet: this is something to eyeball against a driveway, not a measurement. */
export function formatMapWidthFeet(feet: number): string {
  const rounded = Math.round(feet);
  return rounded < 1 ? "under 1 ft across" : `about ${rounded} ft across`;
}
