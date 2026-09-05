import {
  projectUsdaSpeciesTraits,
  resolveCommonName,
  type CommonNameResolution,
  type PlantInput,
  type SpeciesNameSummary,
  type UsdaCharacteristic,
  type UsdaSpeciesSuggestedTraits,
} from '@plant-app/domain'

/**
 * The slice of `SpeciesLookupRepository` these functions need — an interface
 * rather than the class so tests can stub two calls instead of an edge
 * function.
 */
export interface SpeciesLookupSource {
  lookupUsdaByCommonName(commonName: string): Promise<SpeciesNameSummary[]>
  lookupUsdaByScientificName(
    scientificName: string,
  ): Promise<{ species: SpeciesNameSummary[]; characteristics: UsdaCharacteristic[] }>
}

/**
 * The two species-lookup mechanisms Tag Scan's review screen and the manual
 * Plant-creation form share (#31). Each pairs one edge-function call with the
 * domain function that interprets its result, so neither screen has to know
 * that pairing — and so a change to it lands in both at once.
 */

/** Never guesses: a common name spanning several species comes back `ambiguous` with every candidate, per CONTEXT.md's Tag Scan rule. */
export async function lookupSpeciesByCommonName(
  source: SpeciesLookupSource,
  commonName: string,
): Promise<CommonNameResolution> {
  return resolveCommonName(commonName, await source.lookupUsdaByCommonName(commonName))
}

/**
 * Species-level traits USDA reports for a scientific name — never a bloom
 * window, which is climate-dependent and stays user-observed (see CONTEXT.md).
 * An empty object means "USDA had nothing to suggest", a routine outcome that
 * callers treat as "just save it", not as a failure.
 */
export async function suggestSpeciesTraits(
  source: SpeciesLookupSource,
  scientificName: string,
): Promise<UsdaSpeciesSuggestedTraits> {
  const { characteristics } = await source.lookupUsdaByScientificName(scientificName)
  return projectUsdaSpeciesTraits(characteristics)
}

/**
 * Drops any suggestion the user has already answered themselves. USDA
 * proposes and the user decides (CONTEXT.md's Tag Scan rule) — a value they
 * typed into the form *is* that decision, so a suggestion must never
 * overwrite it. Only matters on a form that has these fields at all: Tag
 * Scan's review screen collects names only, so nothing there can conflict.
 *
 * `minimumHardinessZone` survives regardless because it is never written —
 * it's shown for reference only (see `UsdaSpeciesSuggestedTraits`).
 */
export function traitsNotAlreadySetBy(
  traits: UsdaSpeciesSuggestedTraits,
  input: PlantInput,
): UsdaSpeciesSuggestedTraits {
  const remaining: UsdaSpeciesSuggestedTraits = {}
  if (traits.sunRequirement !== undefined && input.sunRequirement === undefined) {
    remaining.sunRequirement = traits.sunRequirement
  }
  if (traits.matureHeightInches !== undefined && input.matureHeightInches === undefined) {
    remaining.matureHeightInches = traits.matureHeightInches
  }
  if (traits.minimumHardinessZone !== undefined) {
    remaining.minimumHardinessZone = traits.minimumHardinessZone
  }
  return remaining
}

/** Whether accepting these suggestions would actually change the Plant — the reference-only hardiness zone never would. */
export function hasApplicableTraits(traits: UsdaSpeciesSuggestedTraits): boolean {
  return traits.sunRequirement !== undefined || traits.matureHeightInches !== undefined
}

/** The one place a suggested trait is merged onto user input, shared by both creation paths so they can't drift apart. */
export function applySuggestedTraits(
  input: PlantInput,
  traits?: UsdaSpeciesSuggestedTraits,
): PlantInput {
  return {
    ...input,
    ...(traits?.sunRequirement && { sunRequirement: traits.sunRequirement }),
    ...(traits?.matureHeightInches && { matureHeightInches: traits.matureHeightInches }),
  }
}
