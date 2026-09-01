import { describe, expect, it } from "vitest";
import { pixelsPerFoot } from "./property.js";
import {
  bedFromRow,
  bedInputToRow,
  chaikinSmooth,
  decimatePoints,
  feetToPixels,
  pixelsToFeet,
  renderedBedOutlines,
  renderedOutlinePoints,
  smoothBedOutline,
  validateBedInput,
  type BedInput,
  type BedPoint,
  type BedRow,
} from "./bed.js";

function validInput(overrides: Partial<BedInput> = {}): BedInput {
  return {
    propertyId: "property-1",
    name: "Front border",
    tool: "freehand",
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 5 },
      { x: 0, y: 5 },
    ],
    smoothingEnabled: false,
    ...overrides,
  };
}

describe("validateBedInput", () => {
  it("accepts a Bed with a name and at least 3 points", () => {
    expect(validateBedInput(validInput())).toEqual({ ok: true });
  });

  it("rejects a blank name", () => {
    expect(validateBedInput(validInput({ name: "   " }))).toEqual({
      ok: false,
      errors: { name: "Name is required." },
    });
  });

  it("rejects fewer than 3 points", () => {
    expect(
      validateBedInput(validInput({ points: [{ x: 0, y: 0 }, { x: 1, y: 1 }] })),
    ).toEqual({
      ok: false,
      errors: { points: "A Bed outline needs at least 3 points." },
    });
  });
});

describe("decimatePoints", () => {
  const pts: BedPoint[] = Array.from({ length: 13 }, (_, i) => ({ x: i, y: i }));

  it("keeps every Nth point and always the last one", () => {
    // 13 points, step 4 -> indices 0, 4, 8, then the last point (12) appended.
    expect(decimatePoints(pts, 4)).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 4 },
      { x: 8, y: 8 },
      { x: 12, y: 12 },
    ]);
  });

  it("does not duplicate the last point when it already falls on the step", () => {
    // 9 points (indices 0-8), step 4 -> loop hits 0, 4; index 8 is the last, appended once.
    const nine = pts.slice(0, 9);
    expect(decimatePoints(nine, 4)).toEqual([
      { x: 0, y: 0 },
      { x: 4, y: 4 },
      { x: 8, y: 8 },
    ]);
  });

  it("keeps every point at step 1", () => {
    expect(decimatePoints(pts, 1)).toEqual(pts);
  });

  it("returns an empty array unchanged", () => {
    expect(decimatePoints([], 4)).toEqual([]);
  });
});

describe("chaikinSmooth", () => {
  it("doubles the point count on a closed loop, each iteration", () => {
    const square: BedPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    expect(chaikinSmooth(square, 1)).toHaveLength(8);
    expect(chaikinSmooth(square, 2)).toHaveLength(16);
  });

  it("cuts corners inward, pulling a square's corner points off the original vertices", () => {
    const square: BedPoint[] = [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ];
    const smoothed = chaikinSmooth(square, 1);
    // First pass, edge (0,0)->(10,0): quarter and three-quarter points.
    expect(smoothed[0]).toEqual({ x: 2.5, y: 0 });
    expect(smoothed[1]).toEqual({ x: 7.5, y: 0 });
    for (const original of square) {
      expect(smoothed).not.toContainEqual(original);
    }
  });

  it("leaves fewer-than-3-point input alone (not enough structure to cut corners)", () => {
    const line: BedPoint[] = [{ x: 0, y: 0 }, { x: 10, y: 0 }];
    expect(chaikinSmooth(line, 3)).toEqual(line);
  });
});

describe("smoothBedOutline", () => {
  const traced: BedPoint[] = Array.from({ length: 13 }, (_, i) => ({ x: i, y: 0 }));

  it("returns the raw points unchanged when smoothing is off", () => {
    expect(smoothBedOutline(traced, false)).toEqual(traced);
  });

  it("applies the fixed decimate-then-4-Chaikin-passes pipeline when smoothing is on", () => {
    const expected = chaikinSmooth(decimatePoints(traced, 4), 4);
    expect(smoothBedOutline(traced, true)).toEqual(expected);
  });

  it("never mutates the input array", () => {
    const copy = traced.map((p) => ({ ...p }));
    smoothBedOutline(traced, true);
    expect(traced).toEqual(copy);
  });

  it("skips decimation for a short trace rather than collapsing it to a degenerate sliver", () => {
    // A quick freehand drag can sample as few as 4-9 raw points. Decimating
    // those at the fixed step-4 strength would leave only 2-3 points —
    // below chaikinSmooth's own 3-point floor, so the "smoothed" result
    // would otherwise be a degenerate line instead of a polygon.
    const shortTrace: BedPoint[] = [
      { x: 0, y: 0 },
      { x: 5, y: 0 },
      { x: 8, y: 4 },
      { x: 5, y: 8 },
      { x: 0, y: 8 },
      { x: -2, y: 4 },
    ];
    const smoothed = smoothBedOutline(shortTrace, true);
    expect(smoothed.length).toBeGreaterThanOrEqual(3);
    expect(smoothed).toEqual(chaikinSmooth(shortTrace, 4));
  });
});

describe("feetToPixels / pixelsToFeet", () => {
  it("scales feet up to pixels at a given Property scale", () => {
    expect(feetToPixels([{ x: 10, y: 5 }], 4)).toEqual([{ x: 40, y: 20 }]);
  });

  it("scales pixels back down to feet, rounded to the nearest thousandth", () => {
    expect(pixelsToFeet([{ x: 40, y: 20 }], 4)).toEqual([{ x: 10, y: 5 }]);
  });

  it("round-trips a feet point list through pixel space at one fixed scale", () => {
    const feet: BedPoint[] = [{ x: 12, y: 8 }, { x: 0, y: 3 }];
    const scale = pixelsPerFoot(42.3782, 20);
    expect(pixelsToFeet(feetToPixels(feet, scale), scale)).toEqual(feet);
  });
});

// The ticket's mandated domain-logic test: a Bed's real-world-unit geometry
// stays correct after its Property's base image is replaced. Replacing the
// base image changes the aerial zoom (and so the Property's feet<->pixel
// scale) without touching the Bed's stored points at all.
describe("a Bed's geometry after its Property's base image is replaced", () => {
  it("keeps the same feet points, even though they render to different pixels at the new scale", () => {
    const feet: BedPoint[] = [
      { x: 0, y: 0 },
      { x: 12, y: 0 },
      { x: 12, y: 8 },
      { x: 0, y: 8 },
    ];
    const scaleBeforeReplacement = pixelsPerFoot(42.3782, 20);
    const scaleAfterReplacement = pixelsPerFoot(42.3782, 18); // a coarser base image, different zoom

    const pixelsBefore = feetToPixels(feet, scaleBeforeReplacement);
    const pixelsAfter = feetToPixels(feet, scaleAfterReplacement);

    // The image swap really does change how the same Bed renders...
    expect(pixelsAfter).not.toEqual(pixelsBefore);

    // ...but the stored real-world geometry round-trips correctly under
    // either scale — it was never coupled to a specific base image's pixels.
    expect(pixelsToFeet(pixelsBefore, scaleBeforeReplacement)).toEqual(feet);
    expect(pixelsToFeet(pixelsAfter, scaleAfterReplacement)).toEqual(feet);
  });
});

describe("renderedOutlinePoints", () => {
  const traced: BedPoint[] = Array.from({ length: 20 }, (_, i) => ({ x: i, y: i % 3 }));

  it("smooths a freehand outline that asked for smoothing", () => {
    expect(renderedOutlinePoints(traced, "freehand", true)).toEqual(
      smoothBedOutline(traced, true),
    );
  });

  it("leaves a freehand outline alone when smoothing is off", () => {
    expect(renderedOutlinePoints(traced, "freehand", false)).toEqual(traced);
  });

  it("never smooths a shape tool, even with the flag set — only freehand traces have hand jitter to remove", () => {
    for (const tool of ["rectangle", "oval", "pen"] as const) {
      expect(renderedOutlinePoints(traced, tool, true)).toEqual(traced);
    }
  });

  it("returns a copy, so a caller can't mutate the stored raw points through it", () => {
    const result = renderedOutlinePoints(traced, "rectangle", false);
    result[0] = { x: 999, y: 999 };
    expect(traced[0]).toEqual({ x: 0, y: 0 });
  });
});

describe("renderedBedOutlines", () => {
  const freehandBed = {
    id: "bed-1",
    name: "Front border",
    tool: "freehand" as const,
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    smoothingEnabled: true,
  };

  it("swaps each Bed onto the outline it actually renders as", () => {
    expect(renderedBedOutlines([freehandBed])[0].points).toEqual(
      renderedOutlinePoints(freehandBed.points, "freehand", true),
    );
  });

  it("carries each Bed's other fields through, so the resolved Bed is still identifiable", () => {
    expect(renderedBedOutlines([freehandBed])[0]).toMatchObject({
      id: "bed-1",
      name: "Front border",
    });
  });

  it("leaves the Beds it was given untouched", () => {
    const before = [...freehandBed.points];

    renderedBedOutlines([freehandBed]);

    expect(freehandBed.points).toEqual(before);
  });
});

describe("bedInputToRow / bedFromRow", () => {
  it("round-trips through the row shape", () => {
    const input = validInput({ tool: "pen", smoothingEnabled: true });
    const row: BedRow = {
      id: "bed-1",
      created_at: "2026-01-01T00:00:00.000Z",
      ...bedInputToRow(input),
    };
    expect(bedFromRow(row)).toEqual({
      id: "bed-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      propertyId: input.propertyId,
      name: input.name,
      tool: input.tool,
      points: input.points,
      smoothingEnabled: input.smoothingEnabled,
    });
  });
});
