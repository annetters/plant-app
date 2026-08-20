import { describe, expect, it } from "vitest";
import {
  plantFromRow,
  plantInputToRow,
  validatePlantInput,
  type PlantInput,
  type PlantRow,
} from "./plant.js";

function validInput(overrides: Partial<PlantInput> = {}): PlantInput {
  return {
    commonName: "Joe Pye Weed",
    scientificName: "Eutrochium purpureum",
    ...overrides,
  };
}

describe("validatePlantInput", () => {
  it("accepts a minimal Plant with only the required identity fields", () => {
    expect(validatePlantInput(validInput())).toEqual({ ok: true });
  });

  it("accepts a Plant with every optional field filled in", () => {
    const result = validatePlantInput(
      validInput({
        cultivar: "Gateway",
        flowerColor: "mauve pink",
        bloomWindow: { start: { month: 7, day: 15 }, end: { month: 9, day: 1 } },
        sunRequirement: "full-sun",
        matureHeightInches: 72,
        matureSpreadInches: 48,
        hardinessZoneRange: { min: 4, max: 8 },
        foliageType: "deciduous",
        nativeStatus: "native",
        referencePhotoPaths: ["user-1/plant-1/photo.jpg"],
      }),
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects a blank common name", () => {
    const result = validatePlantInput(validInput({ commonName: "  " }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.commonName).toBeDefined();
  });

  it("rejects a blank scientific name", () => {
    const result = validatePlantInput(validInput({ scientificName: "" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.scientificName).toBeDefined();
  });

  it("rejects a common name with no letters", () => {
    const result = validatePlantInput(validInput({ commonName: "000" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.commonName).toBeDefined();
  });

  it("rejects a scientific name with no letters", () => {
    const result = validatePlantInput(validInput({ scientificName: "000" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.scientificName).toBeDefined();
  });

  it("rejects a cultivar with no letters", () => {
    const result = validatePlantInput(validInput({ cultivar: "000" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.cultivar).toBeDefined();
  });

  it("rejects a flower color with no letters", () => {
    const result = validatePlantInput(validInput({ flowerColor: "000" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.flowerColor).toBeDefined();
  });

  it("accepts a cultivar or flower color that mixes letters and digits", () => {
    const result = validatePlantInput(
      validInput({ cultivar: "24-Karat Gold", flowerColor: "24k gold" }),
    );
    expect(result).toEqual({ ok: true });
  });

  it("accepts a common name written entirely in a non-Latin script", () => {
    const result = validatePlantInput(validInput({ commonName: "紫式部" }));
    expect(result).toEqual({ ok: true });
  });

  it("leaves an omitted cultivar and flower color unvalidated (still optional)", () => {
    const result = validatePlantInput(validInput());
    expect(result).toEqual({ ok: true });
  });

  it("rejects a bloom window with an out-of-range month", () => {
    const result = validatePlantInput(
      validInput({
        bloomWindow: { start: { month: 13, day: 1 }, end: { month: 9, day: 1 } },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["bloomWindow.start"]).toBeDefined();
  });

  it("rejects a bloom window day that doesn't exist in that month", () => {
    const result = validatePlantInput(
      validInput({
        bloomWindow: { start: { month: 4, day: 31 }, end: { month: 9, day: 1 } },
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["bloomWindow.start"]).toBeDefined();
  });

  it("allows February 29 in a bloom window, since it's year-independent", () => {
    const result = validatePlantInput(
      validInput({
        bloomWindow: { start: { month: 2, day: 29 }, end: { month: 3, day: 1 } },
      }),
    );
    expect(result).toEqual({ ok: true });
  });

  it("allows a bloom window that wraps the year boundary (e.g. a winter bloomer)", () => {
    const result = validatePlantInput(
      validInput({
        bloomWindow: { start: { month: 11, day: 1 }, end: { month: 2, day: 15 } },
      }),
    );
    expect(result).toEqual({ ok: true });
  });

  it("rejects a non-positive mature height", () => {
    const result = validatePlantInput(validInput({ matureHeightInches: 0 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.matureHeightInches).toBeDefined();
  });

  it("rejects a non-positive mature spread", () => {
    const result = validatePlantInput(validInput({ matureSpreadInches: -3 }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.matureSpreadInches).toBeDefined();
  });

  it("rejects a hardiness zone range with an out-of-range min", () => {
    const result = validatePlantInput(validInput({ hardinessZoneRange: { min: 0, max: 7 } }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["hardinessZoneRange.min"]).toBeDefined();
  });

  it("rejects a hardiness zone range with an out-of-range max", () => {
    const result = validatePlantInput(validInput({ hardinessZoneRange: { min: 5, max: 14 } }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["hardinessZoneRange.max"]).toBeDefined();
  });

  it("rejects a hardiness zone range where max is less than min", () => {
    const result = validatePlantInput(validInput({ hardinessZoneRange: { min: 7, max: 5 } }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors["hardinessZoneRange.max"]).toBeDefined();
  });

  it("accepts a whole-number hardiness zone range, single-zone or multi-zone alike", () => {
    expect(validatePlantInput(validInput({ hardinessZoneRange: { min: 5, max: 7 } }))).toEqual({
      ok: true,
    });
    expect(validatePlantInput(validInput({ hardinessZoneRange: { min: 6, max: 6 } }))).toEqual({
      ok: true,
    });
  });

  it("reports every invalid field at once, not just the first", () => {
    const result = validatePlantInput({
      commonName: "",
      scientificName: "",
      matureHeightInches: -1,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(Object.keys(result.errors).sort()).toEqual(
        ["commonName", "matureHeightInches", "scientificName"].sort(),
      );
    }
  });
});

describe("plantInputToRow / plantFromRow", () => {
  it("round-trips a Plant through the database row shape", () => {
    const input = validInput({
      cultivar: "Gateway",
      bloomWindow: { start: { month: 7, day: 15 }, end: { month: 9, day: 1 } },
      sunRequirement: "full-sun",
      matureHeightInches: 72,
      hardinessZoneRange: { min: 4, max: 8 },
      foliageType: "deciduous",
      nativeStatus: "native",
      referencePhotoPaths: ["user-1/plant-1/a.jpg"],
    });

    const row: PlantRow = {
      id: "plant-1",
      ...plantInputToRow(input),
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-02T00:00:00.000Z",
    };

    const plant = plantFromRow(row);

    expect(plant).toEqual({
      id: "plant-1",
      createdAt: "2026-01-01T00:00:00.000Z",
      updatedAt: "2026-01-02T00:00:00.000Z",
      ...input,
    });
  });

  it("maps absent optional fields to null columns and back to undefined", () => {
    const row: PlantRow = {
      id: "plant-2",
      ...plantInputToRow(validInput()),
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };

    expect(row.cultivar).toBeNull();
    expect(row.bloom_start_month).toBeNull();
    expect(row.reference_photo_paths).toEqual([]);

    const plant = plantFromRow(row);
    expect(plant.cultivar).toBeUndefined();
    expect(plant.bloomWindow).toBeUndefined();
    expect(plant.referencePhotoPaths).toEqual([]);
  });
});
