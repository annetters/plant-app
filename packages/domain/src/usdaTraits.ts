import type { SunRequirement } from "./plant.js";

/** A single flattened `{name, value}` pair from USDA PLANTS' characteristics
 * API (source shape: `{PlantCharacteristicName, PlantCharacteristicValue}`
 * — reshaped by the caller before this module ever sees it, so this module
 * stays independent of USDA's exact wire format). */
export interface UsdaCharacteristic {
  name: string;
  value: string;
}

/**
 * Species-level traits suggested from USDA PLANTS. Deliberately has no
 * `bloomWindow` field — per CONTEXT.md, bloom window is climate-dependent
 * and user-observed only, regardless of source, so there is no field here
 * for a caller to accidentally populate from USDA data.
 *
 * `minimumHardinessZone` (not a full `HardinessZoneRange`) because USDA
 * only supplies a minimum survivable temperature — the coldest zone a
 * species tolerates, i.e. the *low* end of the range printed on a nursery
 * tag ("Zones 5-7"). USDA has no corresponding heat-tolerance/upper-zone
 * field, so fabricating a max would overstate what this source knows.
 */
export interface UsdaSpeciesSuggestedTraits {
  sunRequirement?: SunRequirement;
  matureHeightInches?: number;
  minimumHardinessZone?: number;
}

const ZONE_BAND_WIDTH_F = 10;
/** Zone 1's floor, per the official USDA Plant Hardiness Zone Map table (planthardiness.ars.usda.gov): 13 whole zones, each a 10°F band, from -60°F (zone 1) up to 60°F+ (zone 13, open-ended). */
const ZONE_1_FLOOR_F = -60;
const MIN_ZONE = 1;
const MAX_ZONE = 13;

/**
 * Derives the coldest USDA hardiness zone a species survives from its
 * average annual extreme minimum temperature. No direct zone field exists
 * in USDA's characteristics data (see ADR-0004) — this is the documented
 * derivation. A temperature at or beyond either end of the whole-zone table
 * clamps to zone 1 or zone 13 rather than producing an out-of-range zone
 * number.
 */
export function deriveHardinessZoneFromMinimumTemperatureF(minimumTemperatureF: number): number {
  const zone = Math.floor((minimumTemperatureF - ZONE_1_FLOOR_F) / ZONE_BAND_WIDTH_F) + MIN_ZONE;
  return Math.min(MAX_ZONE, Math.max(MIN_ZONE, zone));
}

/**
 * USDA's Shade Tolerance scale collapses onto the domain's 4-value
 * SunRequirement lossily — no distinct part-sun/part-shade signal exists in
 * USDA data, so "Low"/"Intermediate" are a best-effort split. Flagged for
 * refinement if a richer source is ever added (CONTEXT.md: "sources are a
 * pluggable layer, not a single permanent choice").
 */
const SHADE_TOLERANCE_TO_SUN_REQUIREMENT: Record<string, SunRequirement> = {
  none: "full-sun",
  low: "part-sun",
  intermediate: "part-shade",
  medium: "part-shade",
  high: "full-shade",
};

/**
 * Projects USDA PLANTS' ~80-field characteristics list into the trait
 * subset Tag Scan can suggest. Any field missing, unrecognized, or not a
 * usable number is simply omitted — USDA covers only 2 of 7 real tag
 * species tested in ADR-0004, so a mostly-empty result is a routine,
 * expected outcome here, not an error to guard against upstream.
 */
export function projectUsdaSpeciesTraits(
  characteristics: readonly UsdaCharacteristic[],
): UsdaSpeciesSuggestedTraits {
  const byName = new Map(characteristics.map((c) => [c.name, c.value]));
  const traits: UsdaSpeciesSuggestedTraits = {};

  const shadeTolerance = byName.get("Shade Tolerance")?.trim().toLowerCase();
  const sunRequirement = shadeTolerance ? SHADE_TOLERANCE_TO_SUN_REQUIREMENT[shadeTolerance] : undefined;
  if (sunRequirement) traits.sunRequirement = sunRequirement;

  const matureHeightFeet = Number(byName.get("Height, Mature (feet)"));
  if (Number.isFinite(matureHeightFeet) && matureHeightFeet > 0) {
    traits.matureHeightInches = matureHeightFeet * 12;
  }

  const minimumTemperatureF = Number(byName.get("Temperature, Minimum (°F)"));
  if (Number.isFinite(minimumTemperatureF)) {
    traits.minimumHardinessZone = deriveHardinessZoneFromMinimumTemperatureF(minimumTemperatureF);
  }

  return traits;
}
