import { describe, expect, it } from "vitest";
import { filterRegistryEntries } from "./registry.js";
import type { Plant } from "./plant.js";

function plant(overrides: Partial<Plant> & Pick<Plant, "id" | "commonName">): Plant {
  return {
    scientificName: "Testus plantus",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    referencePhotoPaths: [],
    ...overrides,
  };
}

const CONEFLOWER = plant({
  id: "p1",
  commonName: "Coneflower",
  scientificName: "Echinacea purpurea",
  cultivar: "Magnus",
  flowerColor: "purple-pink",
  bloomWindow: { start: { month: 6, day: 1 }, end: { month: 8, day: 15 } },
  sunRequirement: "full-sun",
  foliageType: "deciduous",
  nativeStatus: "native",
});

const ASTER = plant({
  id: "p2",
  commonName: "Aster",
  scientificName: "Symphyotrichum novae-angliae",
  flowerColor: "violet",
  bloomWindow: { start: { month: 9, day: 1 }, end: { month: 10, day: 15 } },
  sunRequirement: "full-sun",
  foliageType: "deciduous",
  nativeStatus: "native",
});

const FERN = plant({
  id: "p3",
  commonName: "Christmas Fern",
  scientificName: "Polystichum acrostichoides",
  sunRequirement: "full-shade",
  foliageType: "evergreen",
  nativeStatus: "native",
});

const HOSTA = plant({
  id: "p4",
  commonName: "Hosta",
  scientificName: "Hosta 'Blue Angel'",
  flowerColor: "lavender",
  sunRequirement: "part-shade",
  foliageType: "deciduous",
  nativeStatus: "non-native",
});

const ALL = [CONEFLOWER, ASTER, FERN, HOSTA];

describe("filterRegistryEntries", () => {
  it("returns every Plant when no filter is set", () => {
    expect(filterRegistryEntries(ALL, {})).toEqual(ALL);
  });

  it("filters by search text against common name, scientific name, or cultivar, case-insensitively", () => {
    expect(filterRegistryEntries(ALL, { search: "cone" })).toEqual([CONEFLOWER]);
    expect(filterRegistryEntries(ALL, { search: "echinacea" })).toEqual([CONEFLOWER]);
    expect(filterRegistryEntries(ALL, { search: "MAGNUS" })).toEqual([CONEFLOWER]);
  });

  it("filters by flower color, case-insensitively, excluding Plants with no flower color", () => {
    expect(filterRegistryEntries(ALL, { flowerColor: "violet" })).toEqual([ASTER]);
    expect(filterRegistryEntries(ALL, { flowerColor: "purple" })).toEqual([CONEFLOWER]);
  });

  it("filters by bloom month, excluding Plants with no bloom window", () => {
    expect(filterRegistryEntries(ALL, { bloomMonth: 7 })).toEqual([CONEFLOWER]);
    expect(filterRegistryEntries(ALL, { bloomMonth: 10 })).toEqual([ASTER]);
  });

  it("filters by sun requirement", () => {
    expect(filterRegistryEntries(ALL, { sunRequirement: "full-shade" })).toEqual([FERN]);
  });

  it("filters by foliage type", () => {
    expect(filterRegistryEntries(ALL, { foliageType: "evergreen" })).toEqual([FERN]);
  });

  it("filters by native status", () => {
    expect(filterRegistryEntries(ALL, { nativeStatus: "non-native" })).toEqual([HOSTA]);
  });

  it("combines every axis with AND, narrowing across all of them at once", () => {
    // Coneflower and Aster both bloom in full sun and are native, but only
    // Coneflower's bloom window includes July and only Coneflower's flower
    // color mentions "purple" — every axis must hold for a Plant to survive.
    const result = filterRegistryEntries(ALL, {
      sunRequirement: "full-sun",
      nativeStatus: "native",
      bloomMonth: 7,
      flowerColor: "purple",
    });
    expect(result).toEqual([CONEFLOWER]);
  });

  it("returns nothing when the combined axes match no Plant", () => {
    const result = filterRegistryEntries(ALL, { sunRequirement: "full-shade", flowerColor: "violet" });
    expect(result).toEqual([]);
  });
});
