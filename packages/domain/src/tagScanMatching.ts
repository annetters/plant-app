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

/**
 * The identity a creation path is trying to match against the registry.
 *
 * `commonName` is required even though the genus+species+cultivar rule
 * usually ignores it: it is the only signal left when a scientific name
 * isn't a binomial, and a path that couldn't supply it would silently lose
 * the fallback in `checkForDuplicatePlant`.
 */
export interface TagScanPlantIdentity {
  commonName: string;
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

/** Common names are compared case- and whitespace-insensitively — the fallback below is only as good as this being forgiving. */
function normalizeCommonName(commonName: string): string {
  return commonName.trim().toLowerCase();
}

/**
 * Matches on genus+species+cultivar — never on genus alone, and never on
 * common name alone while a real scientific name is available to tell two
 * species apart (CONTEXT.md). **Cultivar is always part of the key**: two
 * Plants may legitimately share a scientific name when a cultivar is what
 * distinguishes them, so a straight species never matches a named cultivar
 * of that species, and two different cultivars never match each other.
 *
 * **When neither name parses into genus+species**, the scientific names
 * carry no information to compare, and this falls back to common name +
 * cultivar. Without that fallback, a gardener who types anything that isn't
 * a binomial — "idk", or a bare genus like "Rudbeckia" — silently gets a
 * second record for a plant already in the Registry, which is the exact
 * fragmentation the check exists to prevent.
 *
 * The fallback deliberately requires *both* sides to be unparseable. A
 * candidate with no real scientific name is not matched against an existing
 * Plant that has one: several species share a common name, and that is the
 * confusion the genus+species rule exists to avoid. The result is an offer
 * either way, never a prohibition — creating anyway always survives.
 */
export function checkForDuplicatePlant(
  candidate: TagScanPlantIdentity,
  existingPlants: readonly Plant[],
): DuplicatePlantCheck {
  const parsedCandidate = parseScientificName(candidate.scientificName);
  const candidateCultivar = normalizeCultivar(candidate.cultivar);
  const candidateCommonName = normalizeCommonName(candidate.commonName);

  const existingPlant = existingPlants.find((plant) => {
    // Cultivar has to agree before anything else is worth comparing, on both
    // the scientific-name path and the fallback.
    if (normalizeCultivar(plant.cultivar) !== candidateCultivar) return false;

    const parsedExisting = parseScientificName(plant.scientificName);
    if (parsedCandidate && parsedExisting) {
      return (
        parsedExisting.genus.toLowerCase() === parsedCandidate.genus.toLowerCase() &&
        parsedExisting.species.toLowerCase() === parsedCandidate.species.toLowerCase()
      );
    }

    // One side has a real binomial and the other doesn't: not comparable.
    if (parsedCandidate || parsedExisting) return false;

    return normalizeCommonName(plant.commonName) === candidateCommonName;
  });

  return existingPlant ? { status: "duplicate", existingPlant } : { status: "new" };
}
