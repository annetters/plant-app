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
      matureHeightInches: 60,
      minimumHardinessZone: 5,
    });
  });

  it("never includes a bloom window suggestion — climate-dependent, user-observed only regardless of source", () => {
    const traits = projectUsdaSpeciesTraits([characteristic("Bloom Period", "Summer")]);
    expect(traits).not.toHaveProperty("bloomWindow");
  });

  // #44: USDA's Shade Tolerance readings do not track actual shade tolerance
  // and appear close to inverted, so no value of it produces a suggestion any
  // more. The first four are real readings re-fetched in the issue, and are
  // the cases that made the inversion visible: the two that used to yield
  // `full-shade` are desert plants, and the two that used to yield `part-sun`
  // are a textbook shade tree and a woodland understory fern. The rest cover
  // the remainder of the scale, which no longer has a mapping either.
  it.each([
    ["High", "Agave utahensis (Utah agave) — used to yield full-shade"],
    ["High", "Opuntia polyacantha (plains prickly pear) — used to yield full-shade"],
    ["Low", "Tsuga canadensis (eastern hemlock) — used to yield part-sun"],
    ["Low", "Adiantum pedatum (northern maidenhair) — used to yield part-sun"],
    ["None", "the rest of the scale"],
    ["Intermediate", "the rest of the scale"],
    ["Medium", "the rest of the scale"],
    ["Unknown", "an unrecognized reading"],
  ])("never suggests a sun requirement from Shade Tolerance %s (%s)", (value) => {
    const traits = projectUsdaSpeciesTraits([characteristic("Shade Tolerance", value)]);
    expect(traits).not.toHaveProperty("sunRequirement");
  });

  it("still suggests the traits that are sound alongside a Shade Tolerance reading it ignores", () => {
    const traits = projectUsdaSpeciesTraits([
      characteristic("Shade Tolerance", "High"),
      characteristic("Height, Mature (feet)", "105"),
      characteristic("Temperature, Minimum (\u00b0F)", "-33"),
    ]);

    expect(traits).toEqual({ matureHeightInches: 1260, minimumHardinessZone: 3 });
  });

  it("omits fields entirely absent from the characteristics list", () => {
    expect(projectUsdaSpeciesTraits([])).toEqual({});
  });

  it("omits mature height when the value isn't a usable number", () => {
    const traits = projectUsdaSpeciesTraits([characteristic("Height, Mature (feet)", "Unknown")]);
    expect(traits).not.toHaveProperty("matureHeightInches");
  });

  it("derives zone 7 from a real 0°F reading — 0 is the floor of zone 7, not a missing value", () => {
    const traits = projectUsdaSpeciesTraits([characteristic("Temperature, Minimum (°F)", "0")]);
    expect(traits.minimumHardinessZone).toBe(7);
  });

  it("omits the hardiness zone when the minimum temperature is present but empty", () => {
    const traits = projectUsdaSpeciesTraits([characteristic("Temperature, Minimum (°F)", "")]);
    expect(traits).not.toHaveProperty("minimumHardinessZone");
  });

  it("omits the hardiness zone when the minimum temperature is only whitespace", () => {
    const traits = projectUsdaSpeciesTraits([characteristic("Temperature, Minimum (°F)", "   ")]);
    expect(traits).not.toHaveProperty("minimumHardinessZone");
  });

  it("omits the hardiness zone when the minimum temperature is null on the wire", () => {
    const traits = projectUsdaSpeciesTraits([
      { name: "Temperature, Minimum (°F)", value: null },
    ]);
    expect(traits).not.toHaveProperty("minimumHardinessZone");
  });

  it("omits the hardiness zone when the characteristic is absent entirely", () => {
    const traits = projectUsdaSpeciesTraits([characteristic("Growth Form", "Single Crown")]);
    expect(traits).not.toHaveProperty("minimumHardinessZone");
  });

  it("omits the hardiness zone when the value isn't a usable number", () => {
    const traits = projectUsdaSpeciesTraits([characteristic("Temperature, Minimum (°F)", "Unknown")]);
    expect(traits).not.toHaveProperty("minimumHardinessZone");
  });
});
