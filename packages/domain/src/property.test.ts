import { describe, expect, it } from "vitest";
import {
  aerialTileUrl,
  feetPerPixel,
  lonLatToTile,
  metersPerPixel,
  pickBestZoom,
  pixelsPerFoot,
  propertyFromRow,
  propertyInputToRow,
  validatePropertyInput,
  type PropertyInput,
  type PropertyRow,
} from "./property.js";

function validInput(overrides: Partial<PropertyInput> = {}): PropertyInput {
  return {
    address: "1600 Pennsylvania Ave NW, Washington DC",
    latitude: 38.8977,
    longitude: -77.0365,
    imageryZoom: 20,
    imageryAvailable: true,
    ...overrides,
  };
}

describe("validatePropertyInput", () => {
  it("accepts a fully resolved Property", () => {
    expect(validatePropertyInput(validInput())).toEqual({ ok: true });
  });

  it("accepts a Property with no imagery available at all", () => {
    expect(
      validatePropertyInput(validInput({ imageryZoom: null, imageryAvailable: false })),
    ).toEqual({ ok: true });
  });

  it("rejects a blank address", () => {
    const result = validatePropertyInput(validInput({ address: "   " }));
    expect(result).toEqual({ ok: false, errors: { address: "Address is required." } });
  });

  it("rejects an out-of-range latitude", () => {
    const result = validatePropertyInput(validInput({ latitude: 91 }));
    expect(result).toEqual({
      ok: false,
      errors: { latitude: "Latitude must be between -90 and 90." },
    });
  });

  it("rejects an out-of-range longitude", () => {
    const result = validatePropertyInput(validInput({ longitude: -181 }));
    expect(result).toEqual({
      ok: false,
      errors: { longitude: "Longitude must be between -180 and 180." },
    });
  });
});

describe("propertyInputToRow / propertyFromRow", () => {
  it("round-trips through the row shape", () => {
    const input = validInput();
    const row: PropertyRow = {
      id: "property-1",
      created_at: "2026-01-01T00:00:00.000Z",
      ...propertyInputToRow(input),
    };
    expect(propertyFromRow(row)).toEqual({
      id: "property-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      address: input.address,
      latitude: input.latitude,
      longitude: input.longitude,
      imageryZoom: input.imageryZoom,
      imageryAvailable: input.imageryAvailable,
    });
  });

  it("preserves a null imageryZoom (no imagery available anywhere)", () => {
    const input = validInput({ imageryZoom: null, imageryAvailable: false });
    const row: PropertyRow = {
      id: "property-1",
      created_at: "2026-01-01T00:00:00.000Z",
      ...propertyInputToRow(input),
    };
    expect(propertyFromRow(row).imageryZoom).toBeNull();
  });
});

// Ground-truth figures below are the ones ADR-0002 recorded from the
// validated prototype (`prototype/satellite-base/index.html`): the
// cos(latitude) correction, and the observed 2.2–8.3 in/px range.
describe("metersPerPixel / feetPerPixel / pixelsPerFoot", () => {
  it("matches the raw (uncorrected) Web Mercator formula at the equator", () => {
    const EARTH_CIRCUMFERENCE_METERS = 40075016.686;
    const expected = EARTH_CIRCUMFERENCE_METERS / (256 * 2 ** 20);
    expect(metersPerPixel(0, 20)).toBeCloseTo(expected, 6);
  });

  it("shrinks by roughly cos(latitude) versus the equator at the same zoom", () => {
    const atEquator = metersPerPixel(0, 20);
    const atLatitude = metersPerPixel(42.3782, 20); // Cambridge, MA
    expect(atLatitude / atEquator).toBeCloseTo(Math.cos((42.3782 * Math.PI) / 180), 6);
  });

  it("without the cos(latitude) correction, New England distances would be off by roughly 25%", () => {
    const atEquator = metersPerPixel(0, 20);
    const atLatitude = metersPerPixel(42.3782, 20);
    const errorPct = (1 - atLatitude / atEquator) * 100;
    expect(errorPct).toBeGreaterThan(20);
    expect(errorPct).toBeLessThan(30);
  });

  it("feetPerPixel and pixelsPerFoot are inverses", () => {
    expect(pixelsPerFoot(42.3782, 20)).toBeCloseTo(1 / feetPerPixel(42.3782, 20), 9);
  });

  it("stays within the ~1ft/px MVP target at zoom 20-21 for a typical mid-latitude suburb", () => {
    expect(feetPerPixel(42.3782, 21)).toBeLessThan(1);
  });
});

describe("pickBestZoom", () => {
  it("returns null when nothing is available", () => {
    expect(
      pickBestZoom([
        { zoom: 21, available: false },
        { zoom: 20, available: false },
      ]),
    ).toBeNull();
  });

  it("returns the highest available zoom, not just the first available result", () => {
    expect(
      pickBestZoom([
        { zoom: 21, available: false },
        { zoom: 20, available: true },
        { zoom: 19, available: true },
      ]),
    ).toBe(20);
  });

  it("returns an empty list's result as null", () => {
    expect(pickBestZoom([])).toBeNull();
  });
});

describe("lonLatToTile", () => {
  it("places the prime meridian / equator at the origin tile at zoom 0", () => {
    expect(lonLatToTile(0, 0, 0)).toEqual({ x: 0, y: 0 });
  });

  it("moves to a higher tile index as zoom increases for a fixed location", () => {
    const low = lonLatToTile(42.3782, -71.1266, 10);
    const high = lonLatToTile(42.3782, -71.1266, 20);
    // Each zoom level doubles the tile grid, so the index at the higher
    // zoom should track well past the lower zoom's index.
    expect(high.x).toBeGreaterThan(low.x);
    expect(high.y).toBeGreaterThan(low.y);
  });
});

describe("aerialTileUrl", () => {
  it("builds an Esri World Imagery tile URL with y before x, per the tile service's path convention", () => {
    expect(aerialTileUrl(20, 301829, 385146)).toBe(
      "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/20/385146/301829",
    );
  });
});
