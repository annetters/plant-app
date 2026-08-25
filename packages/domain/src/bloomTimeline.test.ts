import { describe, expect, it } from "vitest";
import {
  bloomWindowIncludesMonth,
  bloomWindowWraps,
  buildBloomTimelineBars,
  dayOfYear,
} from "./bloomTimeline.js";
import type { Plant } from "./plant.js";
import type { Planting } from "./planting.js";

function plant(overrides: Partial<Plant> & Pick<Plant, "id" | "commonName">): Plant {
  return {
    scientificName: "Testus plantus",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    referencePhotoPaths: [],
    ...overrides,
  };
}

function planting(overrides: Partial<Planting> & Pick<Planting, "id" | "plantId" | "bedId">): Planting {
  return {
    quantity: 1,
    pin: { x: 0, y: 0 },
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("dayOfYear", () => {
  it("returns 1 for January 1", () => {
    expect(dayOfYear({ month: 1, day: 1 })).toBe(1);
  });

  it("returns 366 for December 31 (leap-safe cumulative table)", () => {
    expect(dayOfYear({ month: 12, day: 31 })).toBe(366);
  });

  it("accounts for prior months' lengths", () => {
    expect(dayOfYear({ month: 3, day: 1 })).toBe(61); // Jan (31) + Feb (29, leap-safe) + 1
  });
});

describe("bloomWindowWraps", () => {
  it("is false for a window within one year", () => {
    expect(bloomWindowWraps({ start: { month: 4, day: 1 }, end: { month: 6, day: 15 } })).toBe(false);
  });

  it("is true when start falls later in the calendar than end", () => {
    expect(bloomWindowWraps({ start: { month: 11, day: 15 }, end: { month: 2, day: 15 } })).toBe(true);
  });

  it("is false for a same-day window", () => {
    expect(bloomWindowWraps({ start: { month: 5, day: 1 }, end: { month: 5, day: 1 } })).toBe(false);
  });
});

describe("bloomWindowIncludesMonth", () => {
  it("includes months within a non-wrapping window", () => {
    const window = { start: { month: 4, day: 1 }, end: { month: 6, day: 15 } };
    expect(bloomWindowIncludesMonth(window, 4)).toBe(true);
    expect(bloomWindowIncludesMonth(window, 5)).toBe(true);
    expect(bloomWindowIncludesMonth(window, 6)).toBe(true);
    expect(bloomWindowIncludesMonth(window, 3)).toBe(false);
    expect(bloomWindowIncludesMonth(window, 7)).toBe(false);
  });

  it("includes months across a year-wrapping window", () => {
    const window = { start: { month: 11, day: 15 }, end: { month: 2, day: 15 } };
    expect(bloomWindowIncludesMonth(window, 11)).toBe(true);
    expect(bloomWindowIncludesMonth(window, 12)).toBe(true);
    expect(bloomWindowIncludesMonth(window, 1)).toBe(true);
    expect(bloomWindowIncludesMonth(window, 2)).toBe(true);
    expect(bloomWindowIncludesMonth(window, 6)).toBe(false);
  });
});

describe("buildBloomTimelineBars", () => {
  const bloomingPlant = plant({
    id: "plant-1",
    commonName: "Coneflower",
    bloomWindow: { start: { month: 6, day: 1 }, end: { month: 8, day: 15 } },
  });
  const otherBloomingPlant = plant({
    id: "plant-2",
    commonName: "Aster",
    cultivar: "Purple Dome",
    bloomWindow: { start: { month: 9, day: 1 }, end: { month: 10, day: 1 } },
  });
  const plantWithNoBloomWindow = plant({ id: "plant-3", commonName: "Fern" });

  it("a bar's bloom window start/end matches the Plant's bloom window (#9 acceptance criterion)", () => {
    const bars = buildBloomTimelineBars([bloomingPlant], []);
    expect(bars).toHaveLength(1);
    expect(bars[0].bloomWindow.start).toEqual(bloomingPlant.bloomWindow!.start);
    expect(bars[0].bloomWindow.end).toEqual(bloomingPlant.bloomWindow!.end);
  });

  it("omits Plants with no bloom window set", () => {
    const bars = buildBloomTimelineBars([bloomingPlant, plantWithNoBloomWindow], []);
    expect(bars.map((bar) => bar.plantId)).toEqual(["plant-1"]);
  });

  it("carries the Plant's cultivar through when present", () => {
    const bars = buildBloomTimelineBars([otherBloomingPlant], []);
    expect(bars[0].cultivar).toBe("Purple Dome");
  });

  it("omits cultivar entirely when the Plant has none", () => {
    const bars = buildBloomTimelineBars([bloomingPlant], []);
    expect("cultivar" in bars[0]).toBe(false);
  });

  it("with no Bed filter, includes every blooming Plant regardless of Planting", () => {
    const bars = buildBloomTimelineBars([bloomingPlant, otherBloomingPlant], []);
    expect(bars.map((bar) => bar.plantId).sort()).toEqual(["plant-1", "plant-2"]);
  });

  it("filtered by Bed, includes only Plants with a Planting in that Bed", () => {
    const plantings: Planting[] = [
      planting({ id: "planting-1", plantId: "plant-1", bedId: "bed-a" }),
      planting({ id: "planting-2", plantId: "plant-2", bedId: "bed-b" }),
    ];
    const bars = buildBloomTimelineBars([bloomingPlant, otherBloomingPlant], plantings, "bed-a");
    expect(bars.map((bar) => bar.plantId)).toEqual(["plant-1"]);
  });

  it("filtered by a Bed with no Plantings, returns nothing even though blooming Plants exist", () => {
    const bars = buildBloomTimelineBars([bloomingPlant, otherBloomingPlant], [], "bed-a");
    expect(bars).toEqual([]);
  });

  it("a Plant planted in multiple Beds still produces exactly one bar for its own Bed", () => {
    const plantings: Planting[] = [
      planting({ id: "planting-1", plantId: "plant-1", bedId: "bed-a" }),
      planting({ id: "planting-2", plantId: "plant-1", bedId: "bed-b" }),
    ];
    const bars = buildBloomTimelineBars([bloomingPlant], plantings, "bed-a");
    expect(bars).toHaveLength(1);
  });
});
