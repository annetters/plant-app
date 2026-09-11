import { isKnownPlantGenus } from "./genusVocabulary.js";
import type { TagOcrCandidateFields } from "./tagScanCandidate.js";

/** One line of text a real OCR pass (e.g. the on-device Vision adapter, issue #22) recognized, with its confidence (0-1). */
export interface TagOcrTextObservation {
  text: string;
  confidence: number;
}

/**
 * Matches a line that is ENTIRELY "Genus species" (optionally followed by a
 * quoted cultivar) and nothing else — deliberately strict. Real nursery-tag
 * OCR text (see the real transcript backing ADR-0004,
 * `prototype/tag-scan-ocr/vision-ocr-results.txt`) is full of marketing
 * prose whose first two words look like a binomial ("This perennial",
 * "Full Sun") if only the line's start is checked. Anchoring the whole line
 * rules almost all of that out, at the cost of missing a real binomial
 * followed by untagged extra text on the same line (e.g. the real line
 * "Mangave Catch a Wave PPAF" — correctly not matched, rather than wrongly
 * parsed as genus "Mangave" species "Catch").
 *
 * Shape is necessary but not sufficient (#23). "Follow us" and "Sum mer" are
 * typographically identical to "Monarda didyma", and both matched this
 * pattern on real tags, so every match is also checked against the genus
 * vocabulary below. The anchor stays as strict as it is — loosening it was
 * this ticket's original proposal and was rejected, since with garbage
 * guaranteed on every tag it would only multiply false positives.
 */
const SCIENTIFIC_NAME_LINE_PATTERN =
  /^([A-Z][a-zà-ÿ]+)\s+([a-zà-ÿ][a-zà-ÿ-]+)(?:\s*['"“‘]([^'"”’]{2,})['"”’])?$/;

/**
 * A cultivar named on its own line, unattached to any scientific name.
 *
 * The glyph classes are widened by character, from what Vision actually
 * returned on real tags, and never by stripping arbitrary leading and trailing
 * punctuation — the real transcript uses `•` pervasively as a bullet-list
 * marker and `"` constantly as an inch mark, and a strip-and-accept rule
 * swallows both. The two additions are asymmetric on purpose: on #22's
 * Agastache tag, a decorative print style had Vision read the *opening* quote
 * of `'BLUE FORTUNE'` as an inverted exclamation mark and the *closing* one as
 * a bullet. Neither glyph is a quote character, so each is accepted only at the
 * end it was misread at — `•` opens nothing, which is what keeps the bullet
 * lists out. Both are excluded from the cultivar text itself, so a match can
 * never span from one bullet to another.
 */
const STANDALONE_CULTIVAR_PATTERN =
  /^['"“‘¡]([^'"”’¡•]{2,})['"”’•]$/;

/**
 * Best-effort interpretation of raw OCR text lines into Tag Scan candidates
 * — never a common name, since a nursery tag's marketing/common-name text is
 * far too varied and multilingual (per the real transcript) to guess
 * reliably; the user always fills that in themselves. This is a proposal,
 * not a parse the caller should trust — every field a real OCR adapter
 * produces still flows through `reviewTagOcrCandidates` and is only ever
 * applied once the user confirms it.
 *
 * Can return more than one candidate when the photo contains more than one
 * distinct scientific name — see ADR-0004's tag2 finding (a single photo
 * can combine two unrelated tags' front/back). Callers must not assume the
 * first candidate is "the" answer.
 */
export function parseOcrTextLines(
  observations: readonly TagOcrTextObservation[],
): TagOcrCandidateFields[] {
  const matches: TagOcrCandidateFields[] = [];

  for (const { text } of observations) {
    const match = text.trim().match(SCIENTIFIC_NAME_LINE_PATTERN);
    if (!match) continue;
    // The shape said "binomial"; the vocabulary decides whether it is one.
    // No candidate at all beats a confident wrong one here — a blank field the
    // user fills in themselves is the correct outcome for an unknown genus.
    if (!isKnownPlantGenus(match[1])) continue;
    matches.push({
      scientificName: `${match[1]} ${match[2]}`,
      ...(match[3] && { cultivar: match[3] }),
    });
  }

  const standaloneCultivars = collectStandaloneCultivars(observations);

  if (matches.length === 0) {
    return standaloneCultivars.length === 1 ? [{ cultivar: standaloneCultivars[0] }] : [];
  }

  // Distinct by scientific name + cultivar — Vision can recognize the same
  // printed line twice (a duplicated insert, or two identical tags).
  const distinct = new Map<string, TagOcrCandidateFields>();
  for (const m of matches) {
    const key = `${m.scientificName!.toLowerCase()}|${(m.cultivar ?? "").toLowerCase()}`;
    if (!distinct.has(key)) distinct.set(key, m);
  }
  const deduped = [...distinct.values()];

  // A cultivar printed on its own line only gets attached when there's
  // exactly one distinct scientific-name candidate — attaching it with
  // multiple candidates present risks pairing one tag's cultivar with a
  // different tag's species (ADR-0004's tag2 finding).
  if (deduped.length === 1 && !deduped[0].cultivar && standaloneCultivars.length > 0) {
    deduped[0] = { ...deduped[0], cultivar: standaloneCultivars[0] };
  }

  return deduped;
}

/**
 * The distinct cultivars printed on their own lines, in the order Vision
 * recognized them. Distinct is case-insensitive: Vision can recognize the same
 * printed line twice (a duplicated insert, or two identical tags), and one
 * cultivar read twice is not two cultivars.
 */
function collectStandaloneCultivars(
  observations: readonly TagOcrTextObservation[],
): string[] {
  const distinct = new Map<string, string>();
  for (const { text } of observations) {
    const match = text.trim().match(STANDALONE_CULTIVAR_PATTERN);
    if (!match) continue;
    // Captured verbatim, not trimmed — the rule that attaches one of these to a
    // lone scientific name predates #38 and keeps its behavior exactly.
    const cultivar = match[1];
    const key = cultivar.toLowerCase();
    if (!distinct.has(key)) distinct.set(key, cultivar);
  }
  return [...distinct.values()];
}
