import { describe, expect, it } from "vitest";
import {
  baseMapCalibration,
  formatMapWidthFeet,
  formatPixelsPerFoot,
} from "./baseMapCalibration.js";
import { STAGE_SIZE_PX } from "./baseMap.js";
import { pixelsPerFoot, type Property, type PropertyInput } from "./property.js";
import type { ScaleReferenceInput } from "./scaleReference.js";

function validProperty(overrides: Partial<Property> = {}): Property {
  const input: PropertyInput = {
    address: "1600 Pennsylvania Ave NW, Washington DC",
    resolvedAddress: "White House, 1600, Pennsylvania Avenue Northwest, Washington, DC 20500",
    latitude: 38.8977,
    longitude: -77.0365,
    imageryZoom: 20,
    imageryAvailable: true,
    baseMapSource: "aerial",
    baseMapPhotoPath: null,
    baseMapDrawing: null,
    scaleReference: null,
    name: null,
  };
  return { id: "property-1", createdAt: "2026-01-01T00:00:00.000Z", ...input, ...overrides };
}

const scaleReference: ScaleReferenceInput = {
  pointA: { x: 0, y: 0 },
  pointB: { x: 300, y: 0 },
  realDistanceFeet: 25,
  mode: "known-measurement",
};

describe("baseMapCalibration", () => {
  it("reports an aerial Property as calibrated from its imagery", () => {
    const property = validProperty({ baseMapSource: "aerial", imageryZoom: 20 });
    const expected = pixelsPerFoot(property.latitude!, 20);
    expect(baseMapCalibration(property)).toEqual({
      calibrated: true,
      derivedFrom: "aerial-imagery",
      pixelsPerFoot: expected,
      mapWidthFeet: STAGE_SIZE_PX / expected,
      recalibratable: false,
    });
  });

  it("reports a calibrated photo Property as recalibratable, since a Scale Reference can be redone", () => {
    const property = validProperty({
      baseMapSource: "photo",
      baseMapPhotoPath: "user-1/property-1/plan.jpg",
      scaleReference,
    });
    expect(baseMapCalibration(property)).toEqual({
      calibrated: true,
      derivedFrom: "scale-reference",
      pixelsPerFoot: 12,
      mapWidthFeet: STAGE_SIZE_PX / 12,
      recalibratable: true,
    });
  });

  it("reports a calibrated drawn Property as recalibratable too", () => {
    const property = validProperty({
      baseMapSource: "drawn",
      baseMapDrawing: [[{ x: 0, y: 0 }, { x: 100, y: 0 }]],
      scaleReference,
    });
    expect(baseMapCalibration(property)).toMatchObject({
      calibrated: true,
      derivedFrom: "scale-reference",
      recalibratable: true,
    });
  });

  it("distinguishes an aerial Property with no imagery from an uncalibrated photo one", () => {
    expect(
      baseMapCalibration(
        validProperty({ baseMapSource: "aerial", imageryZoom: null, imageryAvailable: false }),
      ),
    ).toEqual({ calibrated: false, reason: "no-aerial-imagery" });

    expect(
      baseMapCalibration(validProperty({ baseMapSource: "photo", baseMapPhotoPath: "p.jpg" })),
    ).toEqual({ calibrated: false, reason: "no-scale-reference" });
  });

  /**
   * The whole point of surfacing the scale: #6 shipped a base map calibrated
   * against a 512px canvas while everything else rendered at 768px, so every
   * Bed and Pin was ~1.5x off. The px-per-ft figure alone reads as plausible
   * either way; the ground width it implies does not.
   */
  it("turns a 1.5x-off calibration into a visibly wrong ground width", () => {
    const correct = baseMapCalibration(
      validProperty({ baseMapSource: "photo", baseMapPhotoPath: "p.jpg", scaleReference }),
    );
    const miscalibrated = baseMapCalibration(
      validProperty({
        baseMapSource: "photo",
        baseMapPhotoPath: "p.jpg",
        scaleReference: { ...scaleReference, realDistanceFeet: 25 * 1.5 },
      }),
    );
    expect(correct).toMatchObject({ calibrated: true, mapWidthFeet: 64 });
    expect(miscalibrated).toMatchObject({ calibrated: true, mapWidthFeet: 96 });
  });
});

describe("formatPixelsPerFoot", () => {
  it("keeps two decimals, so a sub-1 aerial scale doesn't round away to nothing", () => {
    expect(formatPixelsPerFoot(2.7543)).toBe("2.75 px per ft");
    expect(formatPixelsPerFoot(0.686)).toBe("0.69 px per ft");
  });

  it("drops trailing zeroes rather than printing 12.00", () => {
    expect(formatPixelsPerFoot(12)).toBe("12 px per ft");
    expect(formatPixelsPerFoot(3.5)).toBe("3.5 px per ft");
  });
});

describe("formatMapWidthFeet", () => {
  it("rounds to whole feet — this is an eyeball check, not a measurement", () => {
    expect(formatMapWidthFeet(279.27)).toBe("about 279 ft across");
    expect(formatMapWidthFeet(64)).toBe("about 64 ft across");
  });

  it("never claims a map is 0 ft across when the scale is extreme", () => {
    expect(formatMapWidthFeet(0.4)).toBe("under 1 ft across");
  });
});
