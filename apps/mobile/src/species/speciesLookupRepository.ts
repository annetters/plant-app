import type { SpeciesNameSummary, UsdaCharacteristic, UsdaSpeciesProfileSource } from '@plant-app/domain'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The narrow shape of a Supabase client the species lookup needs: the
 * `usda-plant-traits` edge function, and the `search_usda_plant_names` RPC.
 * No tables, no storage — a species lookup reads a public reference source,
 * it never touches the user's own records.
 */
export interface SpeciesLookupDbClient {
  functions: {
    invoke(
      name: string,
      options: { body: unknown },
    ): Promise<{ data: unknown; error: { message: string } | null }>
  }
  rpc(
    name: string,
    params: Record<string, unknown>,
  ): Promise<{ data: unknown; error: { message: string } | null }>
}

/** See apps/web's `asPlantsDbClient` for why this cast exists — the real client satisfies this interface at runtime, but its generic Postgrest builder types blow TypeScript's structural-check recursion budget. */
export function asSpeciesLookupDbClient(client: SupabaseClient): SpeciesLookupDbClient {
  return client as unknown as SpeciesLookupDbClient
}

const USDA_FUNCTION = 'usda-plant-traits'
const NAME_SEARCH_RPC = 'search_usda_plant_names'

/** A screenful. A common name legitimately spans several species; a fragment can span hundreds, and past a point a candidate list stops being a choice. */
const MAX_NAME_MATCHES = 25

/** One row of `search_usda_plant_names` — snake_case because it comes straight from Postgres. */
interface UsdaNameRow {
  scientific_name: string
  common_name: string | null
}

/**
 * USDA PLANTS species lookup, owned by neither Tag Scan nor the Registry.
 * It started life on `TagScanRepository`, but the value of a lookup is in the
 * species traits it returns, not in having photographed a tag — so #31 moved
 * it here, where the manual Plant-creation form can reach it too rather than
 * reimplementing it. `speciesLookup.ts` pairs these calls with the domain
 * functions that interpret their results.
 *
 * Since #36 the two calls take different routes, which is the whole shape of
 * that ticket: **names local, traits live.** Name resolution is a query
 * against our own ingested copy of USDA's checklist, so it costs one database
 * round trip and no external call at all. Traits still come from USDA per
 * lookup, so those keep going through the edge function.
 */
export class SpeciesLookupRepository {
  private readonly client: SpeciesLookupDbClient

  constructor(client: SpeciesLookupDbClient) {
    this.client = client
  }

  /**
   * A common name can span multiple species — see `resolveSpeciesMatches` in
   * `@plant-app/domain`, which this feeds. The RPC does the matching,
   * including USDA's collapsed compound names ("bee balm" → "beebalm") and
   * scientific names, so what comes back is already the match set; nothing
   * downstream should filter it again.
   */
  async lookupUsdaByCommonName(commonName: string): Promise<SpeciesNameSummary[]> {
    const { data, error } = await this.client.rpc(NAME_SEARCH_RPC, {
      search_text: commonName,
      result_limit: MAX_NAME_MATCHES,
    })
    if (error) throw new Error(error.message)
    return ((data ?? []) as UsdaNameRow[]).map((row) => ({
      scientificName: row.scientific_name,
      commonName: row.common_name,
    }))
  }

  /**
   * An empty `characteristics` array is a routine outcome and, since #36, no
   * longer means "no such plant" — only that USDA's conservation-traits table
   * has no row for it, which is true of most garden ornamentals. `species`
   * being empty is the "not found" signal now.
   */
  async lookupUsdaByScientificName(scientificName: string): Promise<{
    species: SpeciesNameSummary[]
    profile?: UsdaSpeciesProfileSource
    characteristics: UsdaCharacteristic[]
    traitSourceUnavailable?: boolean
  }> {
    const { data, error } = await this.client.functions.invoke(USDA_FUNCTION, {
      body: { scientificName },
    })
    if (error) throw new Error(error.message)
    const result = data as {
      error?: string
      species?: SpeciesNameSummary[]
      profile?: UsdaSpeciesProfileSource
      characteristics?: UsdaCharacteristic[]
      traitSourceUnavailable?: boolean
    }
    if (result?.error) throw new Error(result.error)
    return {
      species: result.species ?? [],
      profile: result.profile,
      characteristics: result.characteristics ?? [],
      traitSourceUnavailable: result.traitSourceUnavailable ?? false,
    }
  }
}
