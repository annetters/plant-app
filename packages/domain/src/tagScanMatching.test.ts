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
    const result = checkForDuplicatePlant({ commonName: "Bee balm", scientificName: "Monarda didyma" }, [existing]);
    expect(result).toEqual({ status: "duplicate", existingPlant: existing });
  });

  it("matches genus+species case-insensitively", () => {
    const existing = existingPlant({ scientificName: "Monarda didyma" });
    const result = checkForDuplicatePlant({ commonName: "Bee balm", scientificName: "monarda DIDYMA" }, [existing]);
    expect(result).toEqual({ status: "duplicate", existingPlant: existing });
  });

  it("flags a duplicate when the same cultivar matches too", () => {
    const existing = existingPlant({ cultivar: "Gateway" });
    const result = checkForDuplicatePlant(
      { commonName: "Bee balm", scientificName: "Monarda didyma", cultivar: "gateway" },
      [existing],
    );
    expect(result).toEqual({ status: "duplicate", existingPlant: existing });
  });

  it("does not flag a duplicate when cultivars differ — same species, different named cultivar", () => {
    const existing = existingPlant({ cultivar: "Gateway" });
    const result = checkForDuplicatePlant(
      { commonName: "Bee balm", scientificName: "Monarda didyma", cultivar: "Pardon My Pink" },
      [existing],
    );
    expect(result).toEqual({ status: "new" });
  });

  it("does not flag a duplicate between a straight species and a named cultivar of it", () => {
    const existing = existingPlant();
    const result = checkForDuplicatePlant(
      { commonName: "Bee balm", scientificName: "Monarda didyma", cultivar: "Pardon My Pink" },
      [existing],
    );
    expect(result).toEqual({ status: "new" });
  });

  it("does not flag a duplicate for a different species in the same genus", () => {
    const existing = existingPlant({ scientificName: "Monarda didyma" });
    const result = checkForDuplicatePlant({ commonName: "Bee balm", scientificName: "Monarda fistulosa" }, [existing]);
    expect(result).toEqual({ status: "new" });
  });

  it("does not flag a duplicate from a shared common name alone", () => {
    const existing = existingPlant({ scientificName: "Monarda didyma" });
    const result = checkForDuplicatePlant({ commonName: "Bee balm", scientificName: "Melissa officinalis" }, [existing]);
    expect(result).toEqual({ status: "new" });
  });

  it("returns new when only the candidate's scientific name can't be parsed", () => {
    // Asymmetric on purpose: the existing Plant has a real binomial and this
    // candidate doesn't, so there is nothing comparable. Several species share
    // a common name, which is the confusion the genus+species rule avoids —
    // the common-name fallback applies only when NEITHER side parses.
    const existing = existingPlant();
    const result = checkForDuplicatePlant({ commonName: "Bee balm", scientificName: "Monarda" }, [existing]);
    expect(result).toEqual({ status: "new" });
  });

  it("returns new against an empty registry", () => {
    const result = checkForDuplicatePlant({ commonName: "Bee balm", scientificName: "Monarda didyma" }, []);
    expect(result).toEqual({ status: "new" });
  });
});

describe("checkForDuplicatePlant — neither name is a binomial", () => {
  // The QA finding (2026-09-07): two Plants both named "rudbeckia" with the
  // scientific name "idk" were created with no duplicate offer at all,
  // because an unparseable scientific name used to skip the check outright.
  it("falls back to the common name when neither scientific name parses", () => {
    const existing = existingPlant({ commonName: "rudbeckia", scientificName: "idk" });
    const result = checkForDuplicatePlant({ commonName: "rudbeckia", scientificName: "idk" }, [
      existing,
    ]);
    expect(result).toEqual({ status: "duplicate", existingPlant: existing });
  });

  it("matches the fallback common name case- and whitespace-insensitively", () => {
    const existing = existingPlant({ commonName: "Rudbeckia", scientificName: "idk" });
    const result = checkForDuplicatePlant({ commonName: "  rudbeckia ", scientificName: "unknown" }, [
      existing,
    ]);
    expect(result).toEqual({ status: "duplicate", existingPlant: existing });
  });

  it("still separates two cultivars that share a common name", () => {
    // The user's own note: plants can share a scientific name when a cultivar
    // is the differentiator. Cultivar stays part of the key on this path too.
    const existing = existingPlant({
      commonName: "rudbeckia",
      scientificName: "idk",
      cultivar: "Goldsturm",
    });
    const result = checkForDuplicatePlant(
      { commonName: "rudbeckia", scientificName: "idk", cultivar: "Little Goldstar" },
      [existing],
    );
    expect(result).toEqual({ status: "new" });
  });

  it("does not match a straight species against a named cultivar", () => {
    const existing = existingPlant({
      commonName: "rudbeckia",
      scientificName: "idk",
      cultivar: "Goldsturm",
    });
    const result = checkForDuplicatePlant({ commonName: "rudbeckia", scientificName: "idk" }, [
      existing,
    ]);
    expect(result).toEqual({ status: "new" });
  });

  it("does not match two different common names", () => {
    const existing = existingPlant({ commonName: "rudbeckia", scientificName: "idk" });
    const result = checkForDuplicatePlant({ commonName: "echinacea", scientificName: "idk" }, [
      existing,
    ]);
    expect(result).toEqual({ status: "new" });
  });

  it("returns new when only the existing Plant's scientific name can't be parsed", () => {
    const existing = existingPlant({ commonName: "Bee balm", scientificName: "idk" });
    const result = checkForDuplicatePlant(
      { commonName: "Bee balm", scientificName: "Monarda didyma" },
      [existing],
    );
    expect(result).toEqual({ status: "new" });
  });
});
