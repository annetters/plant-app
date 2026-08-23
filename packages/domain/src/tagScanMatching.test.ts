import { describe, expect, it } from "vitest";
import type { Plant } from "./plant.js";
import { checkForDuplicatePlant, parseScientificName } from "./tagScanMatching.js";

describe("parseScientificName", () => {
  it("splits a genus and species epithet", () => {
    expect(parseScientificName("Digitalis purpurea")).toEqual({
      genus: "Digitalis",
      species: "purpurea",
    });
  });

  it("ignores trailing tokens (e.g. an infraspecific epithet)", () => {
    expect(parseScientificName("Monarda didyma var. pardon")).toEqual({
      genus: "Monarda",
      species: "didyma",
    });
  });

  it("tolerates repeated internal whitespace", () => {
    expect(parseScientificName("Digitalis   purpurea")).toEqual({
      genus: "Digitalis",
      species: "purpurea",
    });
  });

  it("returns null for a genus-only name — not enough to match on", () => {
    expect(parseScientificName("Digitalis")).toBeNull();
  });

  it("returns null for blank input", () => {
    expect(parseScientificName("   ")).toBeNull();
  });
});

let nextId = 1;
function existingPlant(overrides: Partial<Plant> = {}): Plant {
  return {
    id: `plant-${nextId++}`,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    commonName: "Bee balm",
    scientificName: "Monarda didyma",
    referencePhotoPaths: [],
    ...overrides,
  };
}

describe("checkForDuplicatePlant", () => {
  it("flags a duplicate on an exact genus+species match with no cultivar on either side", () => {
    const existing = existingPlant();
    const result = checkForDuplicatePlant({ scientificName: "Monarda didyma" }, [existing]);
    expect(result).toEqual({ status: "duplicate", existingPlant: existing });
  });

  it("matches genus+species case-insensitively", () => {
    const existing = existingPlant({ scientificName: "Monarda didyma" });
    const result = checkForDuplicatePlant({ scientificName: "monarda DIDYMA" }, [existing]);
    expect(result).toEqual({ status: "duplicate", existingPlant: existing });
  });

  it("flags a duplicate when the same cultivar matches too", () => {
    const existing = existingPlant({ cultivar: "Gateway" });
    const result = checkForDuplicatePlant(
      { scientificName: "Monarda didyma", cultivar: "gateway" },
      [existing],
    );
    expect(result).toEqual({ status: "duplicate", existingPlant: existing });
  });

  it("does not flag a duplicate when cultivars differ — same species, different named cultivar", () => {
    const existing = existingPlant({ cultivar: "Gateway" });
    const result = checkForDuplicatePlant(
      { scientificName: "Monarda didyma", cultivar: "Pardon My Pink" },
      [existing],
    );
    expect(result).toEqual({ status: "new" });
  });

  it("does not flag a duplicate between a straight species and a named cultivar of it", () => {
    const existing = existingPlant();
    const result = checkForDuplicatePlant(
      { scientificName: "Monarda didyma", cultivar: "Pardon My Pink" },
      [existing],
    );
    expect(result).toEqual({ status: "new" });
  });

  it("does not flag a duplicate for a different species in the same genus", () => {
    const existing = existingPlant({ scientificName: "Monarda didyma" });
    const result = checkForDuplicatePlant({ scientificName: "Monarda fistulosa" }, [existing]);
    expect(result).toEqual({ status: "new" });
  });

  it("does not flag a duplicate from a shared common name alone", () => {
    const existing = existingPlant({ commonName: "Bee balm", scientificName: "Monarda didyma" });
    const result = checkForDuplicatePlant({ scientificName: "Melissa officinalis" }, [existing]);
    expect(result).toEqual({ status: "new" });
  });

  it("returns new when the candidate's scientific name can't be parsed", () => {
    const existing = existingPlant();
    const result = checkForDuplicatePlant({ scientificName: "Monarda" }, [existing]);
    expect(result).toEqual({ status: "new" });
  });

  it("returns new against an empty registry", () => {
    const result = checkForDuplicatePlant({ scientificName: "Monarda didyma" }, []);
    expect(result).toEqual({ status: "new" });
  });
});
