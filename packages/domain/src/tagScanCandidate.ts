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
  /**
   * Null where the source has no common name for the taxon. USDA carries none
   * for 5,218 of its 48,994 accepted names, and this used to be a required
   * field, so those species were silently discarded before the user ever saw
   * them — the same coverage gap #36 exists to close, in a second place.
   */
  commonName: string | null;
}

/**
 * What a name lookup came back with, reduced to the only three cases a UI has
 * to handle. Named for the species rather than the common name because #36
 * widened what can produce it: the index matches scientific names and USDA's
 * collapsed compound common names too, so the query behind these candidates
 * is no longer necessarily a common name.
 */
export type SpeciesResolution =
  | { status: "unresolved" }
  | { status: "resolved"; species: SpeciesNameSummary }
  | { status: "ambiguous"; candidates: SpeciesNameSummary[] };

/**
 * Turns whatever a name lookup found into the one decision the UI needs:
 * nothing, one species, or a choice to put to the user. It never guesses — a
 * common name can span multiple species (CONTEXT.md's Liatris example:
 * "Liatris" covers both *spicata* and *aspera*), so every distinct candidate
 * is surfaced for the user to check against the physical tag.
 *
 * Distinctness is by scientific name: the same species arriving twice — as an
 * accepted name and again as one of USDA's 44,163 synonyms, say — isn't
 * ambiguity.
 *
 * This deliberately does **not** re-check the candidates against what the
 * user typed. It used to, back when the source was a 2,186-row list filtered
 * with `.includes()` in an Edge Function. The name index now does the
 * matching itself and does it better — it collapses punctuation, so "bee
 * balm" finds USDA's "beebalm" (the file holds that spelling 29 times and the
 * spaced one zero), and it matches scientific names too, which is what makes
 * typing "dahlia" find *Dahlia pinnata*. Re-filtering here would throw away
 * every one of those matches for failing a test the search had already
 * decided, more carefully, to pass.
 */
export function resolveSpeciesMatches(
  knownSpecies: readonly SpeciesNameSummary[],
): SpeciesResolution {
  const distinctByScientificName = new Map<string, SpeciesNameSummary>();
  for (const species of knownSpecies) {
    const key = species.scientificName.trim().toLowerCase();
    if (!distinctByScientificName.has(key)) distinctByScientificName.set(key, species);
  }
  const distinct = [...distinctByScientificName.values()];

  if (distinct.length === 0) return { status: "unresolved" };
  if (distinct.length === 1) return { status: "resolved", species: distinct[0]! };
  return { status: "ambiguous", candidates: distinct };
}

