// Ticket #20: Tag Scan build. Rewritten for #36.
//
// Runs server-side per ADR-0003/ADR-0004: USDA PLANTS needs no credential, but
// it's an external adapter call, so it stays on the Edge Function side of that
// split (unlike OCR, which ADR-0004 places in the shared client package). This
// is a thin lookup + trivial reshape only — deliberately does NOT run
// packages/domain's projectUsdaSpeciesTraits, projectUsdaSpeciesProfile or
// resolveCommonName. Unlike create-property's tile math (which the server must
// act on immediately), USDA suggestions are only ever shown to the user for
// accept/reject before anything is written — so that logic runs once,
// canonically, in @plant-app/domain.
//
// ## What #36 changed
//
// This function used to treat `characteristicSearchResults` as the species
// universe. It isn't one: it's a 2,186-entry NRCS conservation-plant traits
// table, so *Dahlia pinnata* — an ordinary binomial — could not be recognised
// as a real plant name at all, and "USDA has no trait record" was indistinguishable
// from "no such plant."
//
// Names now resolve against `public.usda_plant_names`, our ingested copy of
// USDA's full checklist (48,994 accepted names, 44,163 synonyms), and traits
// stay live. Three tiers, narrowing as they go:
//
//   1. name    — our table. Always answers.
//   2. profile — `PlantProfile?symbol=`. Duration/growth habit, present for
//                ten of twelve sampled ornamentals that have zero characteristics.
//   3. traits  — `PlantCharacteristics/{id}`, only when the profile says the
//                taxon has any. Its absence is now an ordinary outcome, not
//                "plant not found."
//
// See docs/research/usda-plants-name-resolution.md and ADR-0004.
import { handlePreflight, jsonResponse } from "../_shared/cors.ts";
import { requireUser } from "../_shared/auth.ts";

// Recovered from the search UI's runtime config (plants.sc.egov.usda.gov/assets/config.json)
// — see the ADR and prototype/tag-scan-ocr/usda-pull.mjs, which validated this live.
const BASE = "https://plantsservices.sc.egov.usda.gov/api/";
const USER_AGENT =
  "plant-app/0.0 (Tag Scan USDA trait lookup, github.com/annetters/plant-app issue #20)";

interface UsdaCharacteristicRow {
  PlantCharacteristicName: string;
  /** Nullable, and passed through as-is — the domain's projection is the one
   * place that decides what a blank value means (see #40). */
  PlantCharacteristicValue: string | null;
}

/**
 * The subset of `PlantProfile?symbol=` we read. USDA's OpenAPI spec supplies
 * no response schema for this operation, so these field names rest on
 * observation. Verified live against the deployed function on 2026-09-09:
 * `Echinacea purpurea` returned 79 characteristics and `Dahlia pinnata` zero,
 * which only happens if both `HasCharacteristics` and `Id` are read correctly
 * — a wrong name here is falsy for every plant and would silently end all
 * trait suggestions. Re-check this pair if suggestions ever go quiet.
 */
interface UsdaPlantProfile {
  Id?: number;
  Durations?: string[] | null;
  GrowthHabits?: string[] | null;
  HasCharacteristics?: boolean;
}

interface SpeciesNameSummary {
  scientificName: string;
  commonName: string | null;
}

interface UsdaCharacteristic {
  name: string;
  value: string | null;
}

interface NameRow {
  symbol: string;
  /** The taxon's *accepted* name — what we show and what gets written into a Plant. */
  scientific_name: string;
  /** The name that actually matched, which for a synonym hit is not the accepted one. */
  matched_name: string;
  common_name: string | null;
  family: string | null;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(BASE + path, { headers: { "User-Agent": USER_AGENT } });
  if (!res.ok) throw new Error(`GET ${path} -> HTTP ${res.status}`);
  return res.json();
}

/**
 * A non-blank `scientificName`, and nothing else.
 *
 * This used to accept a `commonName` too, and answer it from the same
 * 2,186-row list. #36 moved name resolution into `search_usda_plant_names`,
 * which clients call directly — there is no name-only question left that has
 * to come through here, and a second route to the same answer is a second
 * route to get out of step.
 */
function parseScientificName(body: unknown): string | null {
  if (typeof body !== "object" || body === null) return null;
  const { scientificName } = body as Record<string, unknown>;
  if (typeof scientificName !== "string" || scientificName.trim().length === 0) return null;
  // Internal runs collapsed too, not just the ends: the index stores single
  // spaces, so "Dahlia  pinnata" would otherwise match nothing and forfeit
  // traits for what is plainly the right name.
  return scientificName.trim().replace(/\s+/g, " ");
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
  const scientificName = parseScientificName(parsedBody);
  if (!scientificName) {
    return jsonResponse({ error: "Provide a scientificName." }, 400);
  }

  const auth = await requireUser(req);
  if (!auth) return jsonResponse({ error: "Not authenticated." }, 401);

  // Expected failures (no USDA match, USDA unreachable) below return HTTP 200
  // with an `{ error }`/empty-result body, not a non-2xx status — same
  // `functions.invoke` body-visibility reason as search-addresses/create-property.

  // Resolve against our own index first, so a taxon with no trait record is
  // still a plant we know exists.
  const { data: nameMatches, error: nameError } = await auth.supabase.rpc(
    "search_usda_plant_names",
    { search_text: scientificName, result_limit: 1 },
  );
  if (nameError) {
    return jsonResponse({ error: "Could not search the USDA plant names. Try again." });
  }
  const match = ((nameMatches ?? []) as NameRow[])[0];
  // `search_usda_plant_names` ranks an exact scientific-name hit first, but it
  // is a substring search — take the top row only when it really is the name
  // that was asked for, or "Rosa rug" would silently become *Rosa rugosa*.
  //
  // Compared against `matched_name`, not the accepted name: a gardener typing
  // a synonym off an older tag ("Sedum spectabile") matched a row whose
  // accepted name is a different string (*Hylotelephium spectabile*), and
  // answering with the name USDA accepts today is the point of ingesting the
  // 44,163 synonym rows.
  if (!match || match.matched_name.toLowerCase() !== scientificName.toLowerCase()) {
    return jsonResponse({ species: [] });
  }

  const summary: SpeciesNameSummary = {
    scientificName: match.scientific_name,
    commonName: match.common_name,
  };

  let profile: UsdaPlantProfile | null = null;
  // Reported rather than swallowed. USDA being unreachable costs the extra
  // detail, never the name — that's ours now and never left the database — but
  // silently answering "no traits" during an outage rebuilds the exact
  // ambiguity #36 existed to remove, one layer further in.
  let traitSourceUnavailable = false;
  try {
    profile = await get<UsdaPlantProfile>(
      `PlantProfile?symbol=${encodeURIComponent(match.symbol)}`,
    );
  } catch {
    traitSourceUnavailable = true;
  }

  const speciesProfile = {
    durations: profile?.Durations ?? [],
    growthHabits: profile?.GrowthHabits ?? [],
    // From our checklist copy, not from the profile record: it's the same
    // USDA family, already local, and one fewer field to depend on.
    family: match.family,
  };

  // Tier 3. `HasCharacteristics` is USDA's own answer to "is this taxon in the
  // conservation-traits table" — *Dahlia pinnata* reports false, and
  // `PlantCharacteristics/34210` duly returns `[]`. Skipping the call when it
  // says false is what stops a missing trait record reading as a missing plant.
  let characteristics: UsdaCharacteristic[] = [];
  if (profile?.HasCharacteristics && profile.Id !== undefined) {
    try {
      const rows = await get<UsdaCharacteristicRow[]>(`PlantCharacteristics/${profile.Id}`);
      characteristics = rows.map((row) => ({
        name: row.PlantCharacteristicName,
        value: row.PlantCharacteristicValue,
      }));
    } catch {
      traitSourceUnavailable = true;
    }
  }

  return jsonResponse({
    species: [summary],
    profile: speciesProfile,
    characteristics,
    traitSourceUnavailable,
  });
});
