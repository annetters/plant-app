import type { Plant } from "./plant.js";

export interface ParsedScientificName {
  genus: string;
  species: string;
}

/**
 * Splits a free-text scientific name into genus + species epithet by
 * whitespace. Returns `null` for anything that doesn't yield at least two
 * tokens (a genus-only name, or blank input) — that's "no match possible",
 * not a crash. Trailing tokens (an infraspecific epithet, "var. x") are
 * ignored; only the first two tokens are used for matching.
 */
export function parseScientificName(scientificName: string): ParsedScientificName | null {
  const tokens = scientificName.trim().split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return null;
  return { genus: tokens[0], species: tokens[1] };
}

/** The genus+species+cultivar identity a Tag Scan is trying to match against the registry. */
export interface TagScanPlantIdentity {
  scientificName: string;
  cultivar?: string;
}

export type DuplicatePlantCheck =
  | { status: "duplicate"; existingPlant: Plant }
  | { status: "new" };

function normalizeCultivar(cultivar: string | undefined): string | undefined {
  const trimmed = cultivar?.trim().toLowerCase();
  return trimmed ? trimmed : undefined;
}

/**
 * Matches on genus+species+cultivar, never just common name or genus alone
 * — see CONTEXT.md. A straight species (no cultivar) never matches a named
 * cultivar of the same species, and vice versa; CONTEXT.md treats those as
 * distinct Plants. A candidate whose scientific name can't be parsed into
 * genus+species is reported as "new" rather than risking a false-positive
 * duplicate flag on data too malformed to compare.
 */
export function checkForDuplicatePlant(
  candidate: TagScanPlantIdentity,
  existingPlants: readonly Plant[],
): DuplicatePlantCheck {
  const parsedCandidate = parseScientificName(candidate.scientificName);
  if (!parsedCandidate) return { status: "new" };
  const candidateCultivar = normalizeCultivar(candidate.cultivar);

  const existingPlant = existingPlants.find((plant) => {
    const parsedExisting = parseScientificName(plant.scientificName);
    if (!parsedExisting) return false;
    if (parsedExisting.genus.toLowerCase() !== parsedCandidate.genus.toLowerCase()) return false;
    if (parsedExisting.species.toLowerCase() !== parsedCandidate.species.toLowerCase()) return false;
    return normalizeCultivar(plant.cultivar) === candidateCultivar;
  });

  return existingPlant ? { status: "duplicate", existingPlant } : { status: "new" };
}
