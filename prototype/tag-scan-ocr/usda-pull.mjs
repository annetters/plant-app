#!/usr/bin/env node
// PROTOTYPE — throwaway, not production code. See README.md.
// Real, live pull from USDA PLANTS' characteristics-search API (Issue #19).
// The search UI at plants.usda.gov/characteristics-search is a client-rendered
// SPA with no documented API — this base URL was recovered from its runtime
// config at https://plants.sc.egov.usda.gov/assets/config.json.
// Usage: node usda-pull.mjs ["Scientific name"]

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const BASE = "https://plantsservices.sc.egov.usda.gov/api/";
const USER_AGENT =
  "plant-app-prototype/0.0 (Tag Scan USDA adapter validation, github.com/annetters/plant-app issue #19)";

async function get(path) {
  const res = await fetch(BASE + path, {
    headers: { "User-Agent": USER_AGENT },
  });
  if (!res.ok) {
    throw new Error(`GET ${path} -> HTTP ${res.status}`);
  }
  return res.json();
}

const targetScientificName = process.argv[2] ?? "Abies amabilis";

console.log("Fetching full species list (characteristicSearchResults)...");
const species = await get("characteristicSearchResults");
console.log(`  ${species.length} species returned.`);

const match = species.find(
  (s) =>
    s.scientificNameWithoutAuthor?.toLowerCase() ===
    targetScientificName.toLowerCase(),
);
if (!match) {
  console.error(`No match for "${targetScientificName}" in the species list.`);
  process.exit(1);
}
console.log(
  `Matched: ${match.commonName} (${match.scientificNameWithoutAuthor}), id ${match.id}`,
);

console.log(`Fetching characteristics for id ${match.id}...`);
const characteristics = await get(`PlantCharacteristics/${match.id}`);
console.log(`  ${characteristics.length} characteristic fields returned.`);

const byName = Object.fromEntries(
  characteristics.map((c) => [c.PlantCharacteristicName, c.PlantCharacteristicValue]),
);

// Projected into the subset of CONTEXT.md's Plant fields USDA can actually supply.
// No direct hardiness-zone field exists — it's derived from minimum temperature
// (see docs/research/plant-data-source-cultivar-level-evaluation.md).
const projection = {
  commonName: match.commonName,
  scientificName: match.scientificNameWithoutAuthor,
  matureHeightFeet: byName["Height, Mature (feet)"] ?? null,
  sunShade: byName["Shade Tolerance"] ?? null,
  growthHabit: byName["Growth Habit"] ?? byName["Growth Form"] ?? null,
  minimumTemperatureF: byName["Temperature, Minimum (°F)"] ?? null,
};

console.log("\nProjected Plant-shaped trait subset:");
console.log(JSON.stringify(projection, null, 2));

const outPath = fileURLToPath(
  new URL("./usda-sample-response.json", import.meta.url),
);
writeFileSync(outPath, JSON.stringify(characteristics, null, 2));
console.log(`\nSaved raw response (${characteristics.length} fields) to usda-sample-response.json`);
