/** A locally-captured tag photo, before it's uploaded anywhere. */
export interface TagPhotoInput {
  uri: string;
}

/** Text an OCR (or manual-entry) pass proposes for a tag. Every field is
 * optional and unvalidated — this is a proposal, not a Plant, and may be
 * partial, garbled, or wrong. */
export interface TagOcrCandidateFields {
  commonName?: string;
  scientificName?: string;
  cultivar?: string;
}

export type TagOcrSource = "vision-ocr" | "manual-entry";

/**
 * The seam any OCR implementation plugs into. `recognize` never throws for
 * "nothing readable" — it resolves to an empty array, which
 * `reviewTagOcrCandidates` treats identically to the manual-entry fallback:
 * something the user fills in themselves. A real on-device Vision-framework
 * adapter (see ADR-0004) implements this same interface without touching
 * any of the review/matching/suggestion logic built against it.
 */
export interface TagOcrAdapter {
  readonly source: TagOcrSource;
  recognize(photo: TagPhotoInput): Promise<TagOcrCandidateFields[]>;
}

/**
 * The real, shipped adapter for this pass — not a stand-in for OCR, but the
 * "manual entry is a complete fallback" acceptance criterion itself.
 * Deliberately never reads the photo: it always defers to the human, so the
 * same review step that would pre-fill real OCR candidates renders blank
 * editable fields instead.
 */
export const manualEntryAdapter: TagOcrAdapter = {
  source: "manual-entry",
  async recognize() {
    return [];
  },
};

/**
 * The only state a scan can be in after an adapter runs. There is
 * deliberately no "applied"/"confirmed" status here — per CONTEXT.md's Tag
 * Scan rule (OCR proposes, a human decides), turning a candidate into a
 * Plant is a distinct, later, explicit step this type cannot skip past.
 * Candidates are surfaced verbatim, including obviously bad ones — rejecting
 * or filtering here would be a silent auto-decision, which is exactly what
 * this step must never do.
 */
export interface TagScanCandidateReview {
  status: "needs-confirmation";
  source: TagOcrSource;
  candidates: TagOcrCandidateFields[];
}

export function reviewTagOcrCandidates(
  source: TagOcrSource,
  candidates: TagOcrCandidateFields[],
): TagScanCandidateReview {
  return { status: "needs-confirmation", source, candidates };
}

/** A species as a name-lookup source (USDA today, others later) reports it. */
export interface SpeciesNameSummary {
  scientificName: string;
  commonName: string;
}

export type CommonNameResolution =
  | { status: "unresolved" }
  | { status: "resolved"; species: SpeciesNameSummary }
  | { status: "ambiguous"; candidates: SpeciesNameSummary[] };

/**
 * A common name can span multiple species (CONTEXT.md's Liatris example:
 * "Liatris" covers both *spicata* and *aspera*) — this never guesses,
 * it surfaces every distinct species so the user can check the physical
 * tag. Distinctness is by scientific name: the same species appearing twice
 * in a source list isn't ambiguity.
 */
export function resolveCommonName(
  commonName: string,
  knownSpecies: readonly SpeciesNameSummary[],
): CommonNameResolution {
  const needle = commonName.trim().toLowerCase();
  const matches = knownSpecies.filter((species) => species.commonName.trim().toLowerCase() === needle);

  const distinctByScientificName = new Map<string, SpeciesNameSummary>();
  for (const species of matches) {
    const key = species.scientificName.trim().toLowerCase();
    if (!distinctByScientificName.has(key)) distinctByScientificName.set(key, species);
  }
  const distinct = [...distinctByScientificName.values()];

  if (distinct.length === 0) return { status: "unresolved" };
  if (distinct.length === 1) return { status: "resolved", species: distinct[0] };
  return { status: "ambiguous", candidates: distinct };
}
