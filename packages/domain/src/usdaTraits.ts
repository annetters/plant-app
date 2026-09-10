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

/**
 * The raw per-plant record USDA's `PlantProfile?symbol=…` endpoint carries,
 * reshaped by the caller before this module sees it — same arrangement as
 * `UsdaCharacteristic`, and for the same reason: the wire format is an
 * undocumented internal API, and this module shouldn't depend on its exact
 * field names.
 */
export interface UsdaSpeciesProfileSource {
  durations: readonly string[];
  growthHabits: readonly string[];
  family: string | null;
}

/**
 * Facts USDA reports about a species that the app shows but never saves.
 *
 * Worth having because it is free coverage for the taxa that need it most:
 * ten of twelve garden ornamentals sampled during #36's research have *zero*
 * conservation characteristics — no height, no minimum temperature, nothing
 * `projectUsdaSpeciesTraits` can use — yet still report duration, growth
 * habit and family. Before #36, those species looked to the app like plants
 * that did not exist.
 *
 * Deliberately **not** a `UsdaSpeciesSuggestedTraits`. Nothing here maps onto
 * a Plant field, and nothing here is offered for saving:
 *
 * - Duration (annual/perennial) and growth habit have no column on `plants`,
 *   and inventing one to hold an unverified external reading is how #44
 *   happened.
 * - Family is USDA's, in Cronquist-era taxonomy — it reports *Acer palmatum*
 *   as Aceraceae and *Hemerocallis fulva* as Liliaceae. That is the source's
 *   known quirk, not an error, but it means the value must read as USDA's
 *   claim rather than ours.
 * - Native status is absent on purpose. USDA answers it per coarse region
 *   ("L48: Native, CAN: Introduced"), and the user's judgement (2026-09-09)
 *   is that native is only meaningful against the gardener's own area —
 *   region-level is not useful and would be read as an answer it isn't.
 *   Tracked separately as #50.
 */
export interface UsdaSpeciesProfile {
  durations: string[];
  growthHabits: string[];
  family: string | null;
}

function distinctNonBlank(values: readonly string[] | undefined): string[] {
  const seen = new Set<string>();
  for (const value of values ?? []) {
    const trimmed = value?.trim();
    if (trimmed) seen.add(trimmed);
  }
  return [...seen];
}

function blankToNull(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Cleans USDA's per-plant record into the reference-only shape. An
 * all-empty result is routine — the caller shows nothing, exactly as it
 * does for a species with no characteristics. Absence is never an error
 * here, and since #36 it is no longer "plant not found" either.
 */
export function projectUsdaSpeciesProfile(
  source: UsdaSpeciesProfileSource | undefined,
): UsdaSpeciesProfile {
  return {
    durations: distinctNonBlank(source?.durations),
    growthHabits: distinctNonBlank(source?.growthHabits),
    family: blankToNull(source?.family),
  };
}

/**
 * One line of attributed reference text, or `null` when there is nothing to
 * say. Attribution is the point: see `UsdaSpeciesProfile` on why every claim
 * here has to stay USDA's rather than the app's.
 */
export function describeUsdaSpeciesProfile(profile: UsdaSpeciesProfile): string | null {
  const parts = [
    profile.durations.map((duration) => duration.toLowerCase()).join(", "),
    profile.growthHabits.map((habit) => habit.toLowerCase()).join(", "),
    profile.family ? `family ${profile.family}` : "",
  ].filter((part) => part.length > 0);
  if (parts.length === 0) return null;
  return `USDA PLANTS records this species as: ${parts.join(" · ")}`;
}
