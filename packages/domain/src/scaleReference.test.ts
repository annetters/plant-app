import { describe, expect, it } from "vitest";
import {
  derivePixelsPerFootFromScaleReference,
  validateScaleReferenceInput,
  type ScaleReferenceInput,
} from "./scaleReference.js";

function validInput(overrides: Partial<ScaleReferenceInput> = {}): ScaleReferenceInput {
  return {
    pointA: { x: 0, y: 0 },
    pointB: { x: 300, y: 0 },
    realDistanceFeet: 25,
    mode: "known-measurement",
    ...overrides,
  };
}

// Ticket #6's own acceptance criterion: "two points + a real distance derives
// the correct scale."
describe("derivePixelsPerFootFromScaleReference", () => {
  it("derives pixels-per-foot from a horizontal baseline", () => {
    expect(derivePixelsPerFootFromScaleReference(validInput())).toBe(12);
  });

  it("derives pixels-per-foot from a diagonal baseline (Pythagorean distance)", () => {
    // A 3-4-5 triangle scaled by 10: distance = 50px.
    const reference = validInput({
      pointA: { x: 0, y: 0 },
      pointB: { x: 30, y: 40 },
      realDistanceFeet: 10,
    });
    expect(derivePixelsPerFootFromScaleReference(reference)).toBe(5);
  });

  it("gives the same result for known-measurement and measured-object modes — the math doesn't depend on mode", () => {
    const known = derivePixelsPerFootFromScaleReference(validInput({ mode: "known-measurement" }));
    const measured = derivePixelsPerFootFromScaleReference(validInput({ mode: "measured-object" }));
    expect(known).toBe(measured);
  });

  it("prefers a longer baseline being less sensitive to error — same absolute point error, smaller relative effect", () => {
    const short = validInput({ pointA: { x: 0, y: 0 }, pointB: { x: 10, y: 0 }, realDistanceFeet: 1 });
    const shortWithError = validInput({
      pointA: { x: 0, y: 0 },
      pointB: { x: 11, y: 0 },
      realDistanceFeet: 1,
    });
    const long = validInput({ pointA: { x: 0, y: 0 }, pointB: { x: 1000, y: 0 }, realDistanceFeet: 100 });
    const longWithError = validInput({
      pointA: { x: 0, y: 0 },
      pointB: { x: 1001, y: 0 },
      realDistanceFeet: 100,
    });
    const shortErrorPct =
      Math.abs(
        derivePixelsPerFootFromScaleReference(shortWithError) -
          derivePixelsPerFootFromScaleReference(short),
      ) / derivePixelsPerFootFromScaleReference(short);
    const longErrorPct =
      Math.abs(
        derivePixelsPerFootFromScaleReference(longWithError) -
          derivePixelsPerFootFromScaleReference(long),
      ) / derivePixelsPerFootFromScaleReference(long);
    expect(longErrorPct).toBeLessThan(shortErrorPct);
  });
});

describe("validateScaleReferenceInput", () => {
  it("accepts a valid reference", () => {
    expect(validateScaleReferenceInput(validInput())).toEqual({ ok: true });
  });

  it("rejects a zero real distance", () => {
    expect(validateScaleReferenceInput(validInput({ realDistanceFeet: 0 }))).toEqual({
      ok: false,
      errors: { realDistanceFeet: "Enter a real-world distance greater than 0." },
    });
  });

  it("rejects a negative real distance", () => {
    const result = validateScaleReferenceInput(validInput({ realDistanceFeet: -5 }));
    expect(result.ok).toBe(false);
  });

  it("rejects two coincident points", () => {
    const result = validateScaleReferenceInput(
      validInput({ pointA: { x: 50, y: 50 }, pointB: { x: 50, y: 50 } }),
    );
    expect(result).toEqual({
      ok: false,
      errors: { pointB: "Pick two distinct points, not the same spot twice." },
    });
  });

  it("rejects two points too close together to be a usable baseline", () => {
    const result = validateScaleReferenceInput(
      validInput({ pointA: { x: 50, y: 50 }, pointB: { x: 51, y: 50 } }),
    );
    expect(result.ok).toBe(false);
  });
});
