import { describe, expect, it } from "vitest";
import { renderedBedOutlines, type Bed } from "./bed.js";
import {
  findBedContainingPoint,
  plantingFromRow,
  plantingInputToRow,
  plantingPhotoFromRow,
  plantingPhotoInputToRow,
  resolvePinDrop,
  validatePlantingInput,
  validatePlantingPhotoInput,
  type PlantingInput,
  type PlantingPhotoInput,
  type PlantingRow,
} from "./planting.js";

const VALID_INPUT: PlantingInput = {
  plantId: "plant-1",
  bedId: "bed-1",
  quantity: 3,
  pin: { x: 2, y: 4 },
};

describe("validatePlantingInput", () => {
  it("accepts a minimal valid Planting", () => {
    expect(validatePlantingInput(VALID_INPUT)).toEqual({ ok: true });
  });

  it("accepts a full Planting with yearAcquired and sourceNursery", () => {
    const result = validatePlantingInput({
      ...VALID_INPUT,
      yearAcquired: 2022,
      sourceNursery: "Weston Nurseries",
    });
    expect(result).toEqual({ ok: true });
  });

  it("requires a Plant reference", () => {
    const result = validatePlantingInput({ ...VALID_INPUT, plantId: "" });
    expect(result).toEqual({ ok: false, errors: { plantId: "A Plant reference is required." } });
  });

  it("requires a Bed reference", () => {
    const result = validatePlantingInput({ ...VALID_INPUT, bedId: "" });
    expect(result).toEqual({ ok: false, errors: { bedId: "A Bed reference is required." } });
  });

  it("rejects a zero quantity", () => {
    const result = validatePlantingInput({ ...VALID_INPUT, quantity: 0 });
    expect(result).toEqual({
      ok: false,
      errors: { quantity: "Quantity must be a whole number of at least 1." },
    });
  });

  it("rejects a fractional quantity", () => {
    const result = validatePlantingInput({ ...VALID_INPUT, quantity: 2.5 });
    expect(result).toEqual({
      ok: false,
      errors: { quantity: "Quantity must be a whole number of at least 1." },
    });
  });

  it("rejects a negative quantity", () => {
    const result = validatePlantingInput({ ...VALID_INPUT, quantity: -3 });
    expect(result.ok).toBe(false);
  });

  it("rejects an out-of-range yearAcquired", () => {
    const result = validatePlantingInput({ ...VALID_INPUT, yearAcquired: 1899 });
    expect(result).toEqual({
      ok: false,
      errors: { yearAcquired: "Year acquired must be a real year." },
    });
  });

  it("rejects a non-integer yearAcquired", () => {
    const result = validatePlantingInput({ ...VALID_INPUT, yearAcquired: 2020.5 });
    expect(result.ok).toBe(false);
  });
});

describe("plantingInputToRow / plantingFromRow", () => {
  it("round-trips every field", () => {
    const input: PlantingInput = {
      ...VALID_INPUT,
      yearAcquired: 2021,
      sourceNursery: "Weston Nurseries",
    };
    const row: PlantingRow = {
      id: "planting-1",
      created_at: "2026-01-01T00:00:00.000Z",
      ...plantingInputToRow(input),
    };
    expect(plantingFromRow(row)).toEqual({
      id: "planting-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      ...input,
    });
  });

  it("omits yearAcquired/sourceNursery when absent, rather than emitting them as undefined", () => {
    const row: PlantingRow = {
      id: "planting-1",
      created_at: "2026-01-01T00:00:00.000Z",
      ...plantingInputToRow(VALID_INPUT),
    };
    const planting = plantingFromRow(row);
    expect("yearAcquired" in planting).toBe(false);
    expect("sourceNursery" in planting).toBe(false);
  });

  it("a quantity of 24 produces exactly one record with quantity=24, never 24 records", () => {
    // Domain-logic acceptance criterion (#8): "a Planting with quantity 24
    // produces one record with quantity=24, not 24 records" — quantity is
    // just a field on a single row; nothing in this mapping ever fans a
    // Planting out into per-specimen rows.
    const row = plantingInputToRow({ ...VALID_INPUT, quantity: 24 });
    expect(Array.isArray(row)).toBe(false);
    expect(row.quantity).toBe(24);
  });
});

const VALID_PHOTO_INPUT: PlantingPhotoInput = {
  plantingId: "planting-1",
  path: "user-1/planting-1/photo.jpg",
  takenOn: "2026-06-01",
};

describe("validatePlantingPhotoInput", () => {
  it("accepts a valid dated photo", () => {
    expect(validatePlantingPhotoInput(VALID_PHOTO_INPUT)).toEqual({ ok: true });
  });

  it("requires a takenOn date", () => {
    const result = validatePlantingPhotoInput({ ...VALID_PHOTO_INPUT, takenOn: "" });
    expect(result).toEqual({ ok: false, errors: { takenOn: "A date is required." } });
  });

  it("rejects a malformed takenOn date", () => {
    const result = validatePlantingPhotoInput({ ...VALID_PHOTO_INPUT, takenOn: "not-a-date" });
    expect(result).toEqual({ ok: false, errors: { takenOn: "Enter a valid date." } });
  });

  it("rejects a calendar-invalid takenOn date", () => {
    const result = validatePlantingPhotoInput({ ...VALID_PHOTO_INPUT, takenOn: "2026-02-30" });
    expect(result).toEqual({ ok: false, errors: { takenOn: "Enter a valid date." } });
  });
});

describe("plantingPhotoInputToRow / plantingPhotoFromRow", () => {
  it("round-trips every field", () => {
    const row = {
      id: "photo-1",
      created_at: "2026-01-01T00:00:00.000Z",
      ...plantingPhotoInputToRow(VALID_PHOTO_INPUT),
    };
    expect(plantingPhotoFromRow(row)).toEqual({
      id: "photo-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      ...VALID_PHOTO_INPUT,
    });
  });
});

describe("findBedContainingPoint", () => {
  const squareBed: Bed = {
    id: "bed-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    propertyId: "property-1",
    name: "Front border",
    tool: "rectangle",
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    smoothingEnabled: false,
  };
  const otherBed: Bed = {
    ...squareBed,
    id: "bed-2",
    points: [
      { x: 20, y: 20 },
      { x: 30, y: 20 },
      { x: 30, y: 30 },
      { x: 20, y: 30 },
    ],
  };

  it("finds the Bed whose outline contains the point", () => {
    expect(findBedContainingPoint({ x: 5, y: 5 }, [squareBed, otherBed])).toBe(squareBed);
    expect(findBedContainingPoint({ x: 25, y: 25 }, [squareBed, otherBed])).toBe(otherBed);
  });

  it("returns null when the point falls outside every Bed", () => {
    expect(findBedContainingPoint({ x: 15, y: 15 }, [squareBed, otherBed])).toBeNull();
  });

  it("returns null when there are no Beds", () => {
    expect(findBedContainingPoint({ x: 5, y: 5 }, [])).toBeNull();
  });
});

describe("resolvePinDrop", () => {
  // 10ft x 10ft, drawn with a shape tool so no smoothing is involved — at
  // 2px/ft it covers stage pixels 0..20.
  const squareBed: Bed = {
    id: "bed-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    propertyId: "property-1",
    name: "Front border",
    tool: "rectangle",
    points: [
      { x: 0, y: 0 },
      { x: 10, y: 0 },
      { x: 10, y: 10 },
      { x: 0, y: 10 },
    ],
    smoothingEnabled: false,
  };

  it("converts the drop's pixels to the real-world feet a Pin is stored in", () => {
    const outlines = renderedBedOutlines([squareBed]);

    expect(resolvePinDrop({ x: 10, y: 6 }, 2, outlines).feet).toEqual({ x: 5, y: 3 });
  });

  it("resolves which Bed the drop landed in, with no Bed ever picked by hand", () => {
    const outlines = renderedBedOutlines([squareBed]);

    expect(resolvePinDrop({ x: 10, y: 10 }, 2, outlines).bed?.id).toBe("bed-1");
  });

  it("reports no Bed when the drop falls outside every outline", () => {
    const outlines = renderedBedOutlines([squareBed]);

    expect(resolvePinDrop({ x: 100, y: 100 }, 2, outlines).bed).toBeNull();
  });

  it("reports no Bed when the Property has none drawn yet", () => {
    expect(resolvePinDrop({ x: 10, y: 10 }, 2, []).bed).toBeNull();
  });
});

describe("resolvePinDrop against a smoothed Bed", () => {
  // A traced right-angled corner: smoothing rounds it off, so a point just
  // inside the raw corner sits outside what's actually drawn on screen.
  const traced = [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 10 },
    { x: 0, y: 10 },
  ];
  const freehandBed: Bed = {
    id: "bed-1",
    createdAt: "2026-01-01T00:00:00.000Z",
    propertyId: "property-1",
    name: "Front border",
    tool: "freehand",
    points: traced,
    smoothingEnabled: true,
  };

  it("keeps a Pin out of a Bed whose drawn edge it fell outside, even though the raw trace contains it", () => {
    const corner = { x: 0.4, y: 0.4 };

    expect(findBedContainingPoint(corner, [freehandBed])).not.toBeNull();
    expect(resolvePinDrop({ x: corner.x * 2, y: corner.y * 2 }, 2, renderedBedOutlines([freehandBed])).bed).toBeNull();
  });
});
