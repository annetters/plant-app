/** A single flattened `{name, value}` pair from USDA PLANTS' characteristics
 * API (source shape: `{PlantCharacteristicName, PlantCharacteristicValue}`
 * — reshaped by the caller before this module ever sees it, so this module
 * stays independent of USDA's exact wire format). */
export interface UsdaCharacteristic {
  name: string;
  /** Nullable because the source is: a characteristic USDA has no reading for
   * can still come back as a present row carrying a null or blank value, and
   * the reshaping above only renames the fields — it doesn't clean them.
   * Typed so the blank-checking in `projectUsdaSpeciesTraits` is enforced
   * rather than incidental (#40). */
  value: string | null;
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
 *
 * No `sunRequirement` field either, deliberately (#44). This module used to map
 * USDA's `Shade Tolerance` onto the domain's `SunRequirement`, and the
 * mapping was applied faithfully — the input is what was wrong.
 * `Shade Tolerance` in the `characteristicSearchResults` dataset does not
 * track actual shade tolerance and appears close to *inverted*: `"High"`
 * (which mapped to `full-shade`) is what USDA reports for Utah agave, plains
 * prickly pear and coconut palm, while `"Low"` (which mapped to `part-sun`)
 * is what it reports for eastern hemlock, sugar maple, Canada yew and
 * northern maidenhair fern — the textbook most shade-tolerant plants there
 * are. Half of a 58-species sample reads `"High"`. Field parsing was ruled
 * out as the cause: `Drought Tolerance` on the same rows is correct.
 *
 * This mattered more than the equivalent hardiness-zone bug (#40) because a
 * suggested `sunRequirement` was *persisted* — `applySuggestedTraits` merged
 * it into the `PlantInput`, so one tap wrote a wrong value into the Registry
 * that the Registry's own sun filter then read back.
 *
 * Remapping instead of dropping was considered and rejected: the inversion is
 * clean enough to be tempting, but it would ship a guess about an
 * undocumented external field on a sample far too small to trust. The field
 * stays absent until some source can supply it honestly — which source, and
 * whether that rides along with the data-source revisit (#36, scoped to names
 * and coverage), is not decided. Absent from this type is what enforces it;
 * there is no call site left to get wrong.
 */
export interface UsdaSpeciesSuggestedTraits {
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

  const matureHeightFeet = Number(byName.get("Height, Mature (feet)"));
  if (Number.isFinite(matureHeightFeet) && matureHeightFeet > 0) {
    traits.matureHeightInches = matureHeightFeet * 12;
  }

  // Blank-checked before `Number()`, not with the mature height's `> 0` guard:
  // `Number("")`, `Number("   ")` and `Number(null)` are all a finite 0, but
  // unlike a height, 0°F is a legitimate reading — it is the floor of zone 7
  // itself. A present-but-empty value has to be rejected on the raw string, or
  // it derives a real-looking zone 7 that USDA never reported.
  const minimumTemperatureText = byName.get("Temperature, Minimum (°F)")?.trim();
  if (minimumTemperatureText) {
    const minimumTemperatureF = Number(minimumTemperatureText);
    if (Number.isFinite(minimumTemperatureF)) {
      traits.minimumHardinessZone = deriveHardinessZoneFromMinimumTemperatureF(minimumTemperatureF);
    }
  }

  return traits;
}
