import { describe, expect, it } from "vitest";
import { formatMonthDay, formatOption, MONTH_NAMES, plantLabel } from "./plantDisplay.js";
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

describe("MONTH_NAMES", () => {
  it("has 12 full month names, January-first", () => {
    expect(MONTH_NAMES).toHaveLength(12);
    expect(MONTH_NAMES[0]).toBe("January");
    expect(MONTH_NAMES[11]).toBe("December");
  });
});

describe("formatMonthDay", () => {
  it("renders a MonthDay as 'Month Day'", () => {
    expect(formatMonthDay({ month: 4, day: 15 })).toBe("April 15");
  });
});

describe("formatOption", () => {
  it("replaces hyphens with spaces", () => {
    expect(formatOption("full-sun")).toBe("full sun");
    expect(formatOption("native")).toBe("native");
  });
});

describe("plantLabel", () => {
  it("returns the common name when there is no cultivar", () => {
    expect(plantLabel(plant({ id: "p1", commonName: "Coneflower" }))).toBe("Coneflower");
  });

  it("appends the cultivar in parentheses when set", () => {
    expect(plantLabel(plant({ id: "p1", commonName: "Coneflower", cultivar: "Magnus" }))).toBe(
      "Coneflower (Magnus)",
    );
  });

  it("returns a fallback label when the Plant is undefined", () => {
    expect(plantLabel(undefined)).toBe("Unknown plant");
  });
});
