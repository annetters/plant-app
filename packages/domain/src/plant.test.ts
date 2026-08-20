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
        hardinessZone: "4b",
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

  it("rejects a malformed USDA hardiness zone", () => {
    const result = validatePlantInput(validInput({ hardinessZone: "zone 6" }));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.hardinessZone).toBeDefined();
  });

  it("accepts hardiness zones with and without a sub-band letter", () => {
    expect(validatePlantInput(validInput({ hardinessZone: "6b" }))).toEqual({ ok: true });
    expect(validatePlantInput(validInput({ hardinessZone: "10" }))).toEqual({ ok: true });
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
      hardinessZone: "4b",
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
