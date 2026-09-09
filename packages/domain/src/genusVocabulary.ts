import overrides from "./data/genusVocabularyOverrides.json";
import { PLANT_GENERA_NEWLINE_DELIMITED } from "./data/plantGenera.js";

/**
 * Whether a word is a known plant genus (#23).
 *
 * Tag Scan's parser used to decide what a scientific name was from typography
 * alone — a capitalised word followed by a lowercase one. Nursery tags always
 * carry marketing copy of exactly that shape, so "Follow us" and a
 * Vision-split "Sum mer" were proposed as species with as much confidence as
 * "Monarda didyma", and the review screen pre-filled them for the user to
 * confirm. The shape rule could not be tightened out of it (it was already
 * whole-line anchored and still leaked 2 of 8 real tags) and loosening it, as
 * this ticket originally proposed, would have made precision worse. The
 * discriminator has to be vocabulary, not shape. ADR-0006 records the whole
 * decision.
 *
 * The vocabulary is data compiled ahead of time and consulted locally —
 * `parseOcrTextLines` stays synchronous and pure, and a scan never makes a
 * network call to decide what a word is. See
 * `scripts/generate-genus-vocabulary.mjs` for where the list comes from and
 * why its filter is drawn where it is.
 *
 * This gate stacks *on top of* the shape rule rather than replacing it, so a
 * false positive now has to be both a real genus and followed by a lowercase
 * word. It narrows the problem sharply without eliminating it: 17 of 34
 * ordinary English words probed during triage turn out to be genuine genera
 * (*Iris*, *Veronica*, *Dahlia*, *Viola*…), so a line like "Veronica loves
 * full sun" still gets through. Those are also genera a gardener will
 * legitimately scan, so they are not pre-emptively excluded — the exclusions
 * layer is where one gets handled if it shows up in practice, and #39 is
 * about gathering the evidence for that rather than guessing.
 */
export function isKnownPlantGenus(word: string): boolean {
  const normalized = normalizeGenus(word);
  if (!normalized) return false;
  return vocabulary().has(normalized);
}

/** Size of the loaded vocabulary. A function, not a constant, so that merely reading it doesn't force the vocabulary to be built. */
export function knownPlantGenusCount(): number {
  return vocabulary().size;
}

/**
 * OCR casing is not trustworthy, so every lookup is case-insensitive. Folding
 * happens here and at build time both, so the lookup itself is a plain Set hit.
 */
function normalizeGenus(word: string): string {
  return word.trim().toLowerCase();
}

let built: ReadonlySet<string> | undefined;

/**
 * Built on first use, not at import.
 *
 * `@plant-app/domain`'s index re-exports the parser, so an eager version of
 * this would split a ~600KB string and build a 48k-entry Set on the JS thread
 * during app startup — on both apps, for every gardener, including the
 * majority of sessions that never open Tag Scan at all. Deferring it costs
 * nothing at the call site: the first scan pays ~48k Set insertions once, and
 * `isKnownPlantGenus` stays synchronous and pure either way, which is what
 * #23 requires of it.
 */
function vocabulary(): ReadonlySet<string> {
  if (built) return built;

  const genera = new Set<string>();
  for (const genus of PLANT_GENERA_NEWLINE_DELIMITED.split("\n")) {
    const normalized = normalizeGenus(genus);
    if (normalized) genera.add(normalized);
  }

  // Additions first, then exclusions, so an entry in both is excluded. The
  // overrides file is hand-edited data (see ADR-0006), so a malformed entry is
  // a live possibility and must not take the app down at startup with it: a
  // bad entry is skipped, and the vocabulary is still the backbone's.
  for (const { genus } of overrides.additions) {
    const normalized = typeof genus === "string" ? normalizeGenus(genus) : "";
    if (normalized) genera.add(normalized);
  }
  for (const { genus } of overrides.exclusions) {
    const normalized = typeof genus === "string" ? normalizeGenus(genus) : "";
    if (normalized) genera.delete(normalized);
  }

  built = genera;
  return built;
}
