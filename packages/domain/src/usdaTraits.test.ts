import { describe, expect, it } from "vitest";
import {
  deriveHardinessZoneFromMinimumTemperatureF,
  projectUsdaSpeciesTraits,
  type UsdaCharacteristic,
} from "./usdaTraits.js";

describe("deriveHardinessZoneFromMinimumTemperatureF", () => {
  it("maps each official USDA 10°F band floor to its zone", () => {
    expect(deriveHardinessZoneFromMinimumTemperatureF(-60)).toBe(1);
    expect(deriveHardinessZoneFromMinimumTemperatureF(-50)).toBe(2);
    expect(deriveHardinessZoneFromMinimumTemperatureF(-40)).toBe(3);
    expect(deriveHardinessZoneFromMinimumTemperatureF(-30)).toBe(4);
    expect(deriveHardinessZoneFromMinimumTemperatureF(-20)).toBe(5);
    expect(deriveHardinessZoneFromMinimumTemperatureF(-10)).toBe(6);
    expect(deriveHardinessZoneFromMinimumTemperatureF(0)).toBe(7);
    expect(deriveHardinessZoneFromMinimumTemperatureF(10)).toBe(8);
    expect(deriveHardinessZoneFromMinimumTemperatureF(20)).toBe(9);
    expect(deriveHardinessZoneFromMinimumTemperatureF(30)).toBe(10);
    expect(deriveHardinessZoneFromMinimumTemperatureF(40)).toBe(11);
    expect(deriveHardinessZoneFromMinimumTemperatureF(50)).toBe(12);
    expect(deriveHardinessZoneFromMinimumTemperatureF(60)).toBe(13);
  });

  it("matches the real Digitalis purpurea sample (-13°F -> zone 5)", () => {
    expect(deriveHardinessZoneFromMinimumTemperatureF(-13)).toBe(5);
  });

  it("clamps below zone 1 rather than returning a negative or zero zone", () => {
    expect(deriveHardinessZoneFromMinimumTemperatureF(-200)).toBe(1);
  });

  it("clamps above zone 13, since zone 13 has no stated upper bound", () => {
    expect(deriveHardinessZoneFromMinimumTemperatureF(200)).toBe(13);
  });
});

function characteristic(name: string, value: string): UsdaCharacteristic {
  return { name, value };
}

describe("projectUsdaSpeciesTraits", () => {
  it("projects the real Digitalis purpurea sample into suggested traits", () => {
    const traits = projectUsdaSpeciesTraits([
      characteristic("Height, Mature (feet)", "5.0"),
      characteristic("Shade Tolerance", "High"),
      characteristic("Temperature, Minimum (°F)", "-13"),
      characteristic("Growth Form", "Single Crown"),
    ]);

    expect(traits).toEqual({
      sunRequirement: "full-shade",
      matureHeightInches: 60,
      minimumHardinessZone: 5,
    });
  });

  it("never includes a bloom window suggestion — climate-dependent, user-observed only regardless of source", () => {
    const traits = projectUsdaSpeciesTraits([characteristic("Bloom Period", "Summer")]);
    expect(traits).not.toHaveProperty("bloomWindow");
  });

  it("maps each Shade Tolerance value to a sun requirement", () => {
    expect(projectUsdaSpeciesTraits([characteristic("Shade Tolerance", "None")])).toEqual({
      sunRequirement: "full-sun",
    });
    expect(projectUsdaSpeciesTraits([characteristic("Shade Tolerance", "Low")])).toEqual({
      sunRequirement: "part-sun",
    });
    expect(projectUsdaSpeciesTraits([characteristic("Shade Tolerance", "Intermediate")])).toEqual({
      sunRequirement: "part-shade",
    });
  });

  it("omits sun requirement for an unrecognized Shade Tolerance value rather than guessing", () => {
    const traits = projectUsdaSpeciesTraits([characteristic("Shade Tolerance", "Unknown")]);
    expect(traits).not.toHaveProperty("sunRequirement");
  });

  it("omits fields entirely absent from the characteristics list", () => {
    expect(projectUsdaSpeciesTraits([])).toEqual({});
  });

  it("omits mature height when the value isn't a usable number", () => {
    const traits = projectUsdaSpeciesTraits([characteristic("Height, Mature (feet)", "Unknown")]);
    expect(traits).not.toHaveProperty("matureHeightInches");
  });
});
