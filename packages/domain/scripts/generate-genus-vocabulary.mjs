#!/usr/bin/env node
/**
 * Regenerates `src/data/plantGenera.ts` — the plant-genus vocabulary
 * `parseOcrTextLines` validates a candidate scientific name against (#23).
 *
 * Run from `packages/domain`:
 *
 *     node scripts/generate-genus-vocabulary.mjs
 *
 * ## Where the data comes from
 *
 * GBIF's taxonomic backbone (dataset `d7dddbf4-2cf0-4f39-9b2a-bb099caae36c`),
 * restricted to `kingdom=Plantae` (`highertaxonKey=6`), `rank=GENUS`, and a
 * `taxonomicStatus` of `ACCEPTED` or `SYNONYM`. The `canonicalName` of each
 * hit is taken verbatim.
 *
 * ## Why that filter, and not a different one
 *
 * `SYNONYM` is kept deliberately. *Perovskia* and *Mangave* are synonyms
 * under current taxonomy but are exactly what nurseries print — horticulture
 * lags taxonomy by decades — so dropping them would reject real tag text.
 *
 * `DOUBTFUL` is dropped deliberately. It is what dragged in the only
 * marketing-word collision found during triage (*Aurora*, a doubtful
 * Combretaceae genus). It is not pure noise, though: *Angelica* is a real,
 * widely sold garden genus that sits in the backbone as `DOUBTFUL`. No single
 * status filter is correct, which is why the overrides below exist.
 *
 * ## Why not `species/match`
 *
 * GBIF's `species/match` endpoint fails in a way that resembles success. It
 * returns `ACCEPTED` with `confidence: 99` for the words "Follow", "Deer" and
 * "Winners", silently backing off to a match on *Plantae* itself, and returns
 * `HIGHERRANK` for genuine genera like *Hosta* and *Helleborus* because
 * homonyms in other families make it refuse to disambiguate. Do not use it
 * here; this script uses the backbone search with exact `canonicalName`
 * equality instead.
 *
 * ## Overrides are NOT baked in here
 *
 * `src/data/genusVocabularyOverrides.json` holds `additions` for real genera
 * the status filter wrongly drops and `exclusions` for entries that collide
 * with ordinary tag text. `genusVocabulary.ts` merges them at load, *not*
 * this script, so editing an override takes effect immediately — without a
 * network round trip and without regenerating a 48k-name file. #23 asked for
 * the generator to apply them; the criterion under it ("the override file is
 * data, not code, and is editable without touching the parser") is better
 * served this way, and #39 exists to curate that file from real scans over
 * time, so edits should be cheap. This script only *checks* the file: an
 * addition GBIF now carries on its own is reported as retirable.
 *
 * The consequence is that this file stays a faithful mirror of GBIF, and
 * every local judgement call lives in one small hand-edited file next to it.
 */

import { readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const OVERRIDES_PATH = join(HERE, "../src/data/genusVocabularyOverrides.json");
const OUTPUT_PATH = join(HERE, "../src/data/plantGenera.ts");

const BACKBONE_DATASET_KEY = "d7dddbf4-2cf0-4f39-9b2a-bb099caae36c";
/** GBIF's backbone key for kingdom Plantae. */
const PLANTAE_HIGHER_TAXON_KEY = 6;
const PAGE_SIZE = 1000;
/** Kept low on purpose — this is someone else's free public API. */
const CONCURRENT_PAGES = 4;

function pageUrl(offset) {
  const params = new URLSearchParams({
    datasetKey: BACKBONE_DATASET_KEY,
    highertaxonKey: String(PLANTAE_HIGHER_TAXON_KEY),
    rank: "GENUS",
    limit: String(PAGE_SIZE),
    offset: String(offset),
  });
  params.append("status", "ACCEPTED");
  params.append("status", "SYNONYM");
  return `https://api.gbif.org/v1/species/search?${params}`;
}

async function fetchPage(offset) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(pageUrl(offset));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (attempt === 3) throw new Error(`offset ${offset} failed: ${error.message}`);
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
    }
  }
}

/**
 * Re-checks every field the query already filtered on. The query is trusted to
 * narrow, not to be correct: a silently changed parameter name would come back
 * as a successful response full of the wrong ranks, which is the failure mode
 * worth catching loudly here rather than shipping into the bundle.
 */
function canonicalNamesFrom(results) {
  const names = [];
  for (const result of results) {
    if (result.rank !== "GENUS") continue;
    if (result.kingdom !== "Plantae") continue;
    if (result.taxonomicStatus !== "ACCEPTED" && result.taxonomicStatus !== "SYNONYM") continue;
    const name = result.canonicalName?.trim();
    // Genus names are a single word; anything else is a backbone oddity, not
    // something the parser's first-word lookup could ever match anyway.
    if (!name || /\s/.test(name)) continue;
    names.push(name);
  }
  return names;
}

async function main() {
  const first = await fetchPage(0);
  const total = first.count;
  console.log(`GBIF matches ${total} rows for this filter.`);

  const names = new Set(canonicalNamesFrom(first.results));
  const offsets = [];
  for (let offset = PAGE_SIZE; offset < total; offset += PAGE_SIZE) offsets.push(offset);

  let sawEndOfRecords = Boolean(first.endOfRecords);
  let rowsSeen = first.results.length;
  for (let i = 0; i < offsets.length; i += CONCURRENT_PAGES) {
    const batch = offsets.slice(i, i + CONCURRENT_PAGES);
    const pages = await Promise.all(batch.map(fetchPage));
    for (const page of pages) {
      rowsSeen += page.results.length;
      if (page.endOfRecords) sawEndOfRecords = true;
      for (const name of canonicalNamesFrom(page.results)) names.add(name);
    }
    console.log(`  fetched ${Math.min(i + CONCURRENT_PAGES, offsets.length) + 1}/${offsets.length + 1} pages, ${names.size} distinct so far`);
  }

  // A partial run is the failure mode that matters: it writes a shorter file
  // that looks entirely normal, and the damage surfaces much later as real
  // genera being silently rejected on a scan. Refuse to write one.
  if (!sawEndOfRecords) {
    throw new Error(
      `Paginated ${rowsSeen} of ${total} rows without GBIF ever reporting endOfRecords. ` +
        `Refusing to write a possibly truncated vocabulary.`,
    );
  }
  if (rowsSeen < total) {
    throw new Error(
      `Saw ${rowsSeen} rows but GBIF reported ${total}. Refusing to write a truncated vocabulary.`,
    );
  }
  // Distinct names always land well below the row count — the same genus
  // recurs across statuses and families (Hosta appears four times). This floor
  // is a smoke alarm for a collapsed run, not a precise expectation.
  const MINIMUM_PLAUSIBLE_GENERA = 40_000;
  if (names.size < MINIMUM_PLAUSIBLE_GENERA) {
    throw new Error(
      `Only ${names.size} distinct genera survived the filter, below the ${MINIMUM_PLAUSIBLE_GENERA} floor. ` +
        `Something changed upstream — inspect before writing.`,
    );
  }

  const sorted = [...names].sort((a, b) => a.localeCompare(b, "en"));
  const raw = sorted.join("\n");

  const file = `// GENERATED FILE — do not edit by hand.
// Regenerate with: node scripts/generate-genus-vocabulary.mjs
//
// Source: GBIF taxonomic backbone (dataset ${BACKBONE_DATASET_KEY}),
// kingdom=Plantae, rank=GENUS, taxonomicStatus in {ACCEPTED, SYNONYM}.
// Generated ${new Date().toISOString().slice(0, 10)} from ${total} matching rows, which dedupe
// to ${sorted.length} distinct genus names. The generator script documents why
// that filter and not another.
//
// This is the unmodified backbone slice. The local additions and exclusions
// live in \`genusVocabularyOverrides.json\` and are merged by
// \`genusVocabulary.ts\` at load, so they can be edited without regenerating
// this file.
//
// Stored as one newline-delimited string rather than an array literal: it is
// the same data at a fraction of the parse cost and file size, and it stays
// readable in a diff. \`genusVocabulary.ts\` splits it once at module load.
export const PLANT_GENERA_NEWLINE_DELIMITED = ${JSON.stringify(raw)};
`;

  await writeFile(OUTPUT_PATH, file);
  console.log(
    `\nWrote ${OUTPUT_PATH}\n  ${sorted.length} genera, ${(Buffer.byteLength(file) / 1024).toFixed(0)}KB on disk`,
  );

  // Not applied here, only checked — an addition the backbone has since picked
  // up on its own is dead weight the override file should stop carrying.
  const overrides = JSON.parse(await readFile(OVERRIDES_PATH, "utf8"));
  const retirable = overrides.additions.filter(({ genus }) => names.has(genus));
  const ineffective = overrides.exclusions.filter(({ genus }) => !names.has(genus));
  if (retirable.length) {
    console.log(
      `\nOverride additions the backbone now carries by itself (retire them): ${retirable
        .map(({ genus }) => genus)
        .join(", ")}`,
    );
  }
  if (ineffective.length) {
    console.log(
      `\nOverride exclusions that match nothing in the backbone (harmless, but dead): ${ineffective
        .map(({ genus }) => genus)
        .join(", ")}`,
    );
  }
}

await main();
