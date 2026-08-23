// Ticket #20: Tag Scan build.
//
// Runs server-side per ADR-0003/ADR-0004: USDA PLANTS' characteristics-search
// API needs no credential, but it's an external adapter call, so it stays on
// the Edge Function side of that split (unlike OCR, which ADR-0004 places in
// the shared client package). This is a thin proxy + trivial reshape only —
// deliberately does NOT run packages/domain's projectUsdaSpeciesTraits,
// deriveHardinessZoneFromMinimumTemperatureF, or resolveCommonName. Unlike
// create-property's tile math (which the server must act on immediately),
// USDA suggestions are only ever shown to the user for accept/reject before
// anything is written — so that logic runs once, canonically, in
// @plant-app/domain, called from the mobile app after this function
// responds. See docs/adr/0004-tag-scan-ocr-placement-and-usda-adapter.md.
import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

// Recovered from the search UI's runtime config (plants.sc.egov.usda.gov/assets/config.json)
// — see the ADR and prototype/tag-scan-ocr/usda-pull.mjs, which validated this live.
const BASE = "https://plantsservices.sc.egov.usda.gov/api/";
const USER_AGENT =
  "plant-app/0.0 (Tag Scan USDA trait lookup, github.com/annetters/plant-app issue #20)";

interface UsdaSpeciesListEntry {
  id: number;
  scientificNameWithoutAuthor?: string;
  commonName?: string;
}

interface UsdaCharacteristicRow {
  PlantCharacteristicName: string;
  PlantCharacteristicValue: string;
}

interface SpeciesNameSummary {
  scientificName: string;
  commonName: string;
}

interface UsdaCharacteristic {
  name: string;
  value: string;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`GET ${path} -> HTTP ${res.status}`);
  return res.json();
}

// The species list is ~2186 entries and changes rarely; a Tag Scan review
// step calls this function twice in a row (once by common name, once by
// scientific name), so without a cache every scan downloads the full
// catalog twice. Deno edge isolates stay warm between invocations, making a
// short-lived module-scope cache safe and effective.
const SPECIES_LIST_CACHE_TTL_MS = 30 * 60 * 1000;
let speciesListCache: { fetchedAt: number; species: UsdaSpeciesListEntry[] } | null = null;

async function getSpeciesList(): Promise<UsdaSpeciesListEntry[]> {
  if (speciesListCache && Date.now() - speciesListCache.fetchedAt < SPECIES_LIST_CACHE_TTL_MS) {
    return speciesListCache.species;
  }
  const species = await get<UsdaSpeciesListEntry[]>("characteristicSearchResults");
  speciesListCache = { fetchedAt: Date.now(), species };
  return species;
}

function toSpeciesNameSummary(entry: UsdaSpeciesListEntry): SpeciesNameSummary | null {
  if (!entry.scientificNameWithoutAuthor || !entry.commonName) return null;
  return { scientificName: entry.scientificNameWithoutAuthor, commonName: entry.commonName };
}

interface UsdaLookupRequest {
  scientificName?: string;
  commonName?: string;
}

/** Exactly one of scientificName/commonName, non-blank. */
function parseRequestBody(body: unknown): UsdaLookupRequest | null {
  if (typeof body !== "object" || body === null) return null;
  const { scientificName, commonName } = body as Record<string, unknown>;
  const hasScientificName = typeof scientificName === "string" && scientificName.trim().length > 0;
  const hasCommonName = typeof commonName === "string" && commonName.trim().length > 0;
  if (hasScientificName === hasCommonName) return null; // both or neither
  return {
    scientificName: hasScientificName ? (scientificName as string).trim() : undefined,
    commonName: hasCommonName ? (commonName as string).trim() : undefined,
  };
}

Deno.serve(async (req) => {
  const preflight = handlePreflight(req);
  if (preflight) return preflight;
  if (req.method !== "POST") return jsonResponse({ error: "Method not allowed." }, 405);

  let parsedBody: unknown;
  try {
    parsedBody = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid request body." }, 400);
  }
  const input = parseRequestBody(parsedBody);
  if (!input) {
    return jsonResponse({ error: "Provide exactly one of scientificName or commonName." }, 400);
  }

  const auth = await requireUser(req);
  if (!auth) return jsonResponse({ error: "Not authenticated." }, 401);

  // Expected failures (no USDA match, USDA unreachable) below return HTTP 200
  // with an `{ error }`/empty-result body, not a non-2xx status — same
  // `functions.invoke` body-visibility reason as search-addresses/create-property.
  let species: UsdaSpeciesListEntry[];
  try {
    species = await getSpeciesList();
  } catch {
    return jsonResponse({ error: "Could not reach USDA PLANTS. Try again." });
  }

  if (input.commonName) {
    const needle = input.commonName.toLowerCase();
    const matches = species
      .filter((s) => s.commonName?.toLowerCase() === needle)
      .map(toSpeciesNameSummary)
      .filter((s): s is SpeciesNameSummary => s !== null);
    // No match is a routine, common outcome (ADR-0004: USDA is a
    // conservation-plant dataset, not a general horticultural one) — not an error.
    return jsonResponse({ species: matches });
  }

  const needle = input.scientificName!.toLowerCase();
  const match = species.find((s) => s.scientificNameWithoutAuthor?.toLowerCase() === needle);
  const matchSummary = match ? toSpeciesNameSummary(match) : null;
  if (!match || !matchSummary) {
    return jsonResponse({ species: [] });
  }

  let characteristicRows: UsdaCharacteristicRow[];
  try {
    characteristicRows = await get<UsdaCharacteristicRow[]>(`PlantCharacteristics/${match.id}`);
  } catch {
    return jsonResponse({ error: "Could not reach USDA PLANTS. Try again." });
  }

  const characteristics: UsdaCharacteristic[] = characteristicRows.map((row) => ({
    name: row.PlantCharacteristicName,
    value: row.PlantCharacteristicValue,
  }));

  return jsonResponse({ species: [matchSummary], characteristics });
});
