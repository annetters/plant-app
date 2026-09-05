import type { SpeciesNameSummary, UsdaCharacteristic } from '@plant-app/domain'
import type { SupabaseClient } from '@supabase/supabase-js'

/**
 * The narrow shape of a Supabase client the species lookup needs. Only the
 * `usda-plant-traits` edge function — no tables, no storage: a species lookup
 * reads a public reference source, it never touches the user's own records.
 */
export interface SpeciesLookupDbClient {
  functions: {
    invoke(
      name: string,
      options: { body: unknown },
    ): Promise<{ data: unknown; error: { message: string } | null }>
  }
}

/** See apps/web's `asPlantsDbClient` for why this cast exists — the real client satisfies this interface at runtime, but its generic Postgrest builder types blow TypeScript's structural-check recursion budget. */
export function asSpeciesLookupDbClient(client: SupabaseClient): SpeciesLookupDbClient {
  return client as unknown as SpeciesLookupDbClient
}

const USDA_FUNCTION = 'usda-plant-traits'

/**
 * USDA PLANTS species lookup, owned by neither Tag Scan nor the Registry.
 * It started life on `TagScanRepository`, but the value of a lookup is in the
 * species traits it returns, not in having photographed a tag — so #31 moved
 * it here, where the manual Plant-creation form can reach it too rather than
 * reimplementing it. `speciesLookup.ts` pairs these calls with the domain
 * functions that interpret their results.
 */
export class SpeciesLookupRepository {
  private readonly client: SpeciesLookupDbClient

  constructor(client: SpeciesLookupDbClient) {
    this.client = client
  }

  /** A common name can span multiple species — see `resolveCommonName` in `@plant-app/domain`, which this feeds. */
  async lookupUsdaByCommonName(commonName: string): Promise<SpeciesNameSummary[]> {
    const { data, error } = await this.client.functions.invoke(USDA_FUNCTION, {
      body: { commonName },
    })
    if (error) throw new Error(error.message)
    const result = data as { error?: string; species?: SpeciesNameSummary[] }
    if (result?.error) throw new Error(result.error)
    return result.species ?? []
  }

  /** An empty `characteristics` array (no USDA match) is a routine, common outcome — see ADR-0004 — not an error. */
  async lookupUsdaByScientificName(
    scientificName: string,
  ): Promise<{ species: SpeciesNameSummary[]; characteristics: UsdaCharacteristic[] }> {
    const { data, error } = await this.client.functions.invoke(USDA_FUNCTION, {
      body: { scientificName },
    })
    if (error) throw new Error(error.message)
    const result = data as {
      error?: string
      species?: SpeciesNameSummary[]
      characteristics?: UsdaCharacteristic[]
    }
    if (result?.error) throw new Error(result.error)
    return { species: result.species ?? [], characteristics: result.characteristics ?? [] }
  }
}
