import type { SpeciesLookupDbClient } from '../species/speciesLookupRepository'

/**
 * An in-memory stand-in for the two routes a species lookup takes since #36:
 * the `search_usda_plant_names` RPC for names, and the `usda-plant-traits`
 * edge function for traits. Both default to "nothing found", so a test only
 * has to `mockResolvedValueOnce` when it cares about the lookup.
 */
export function createFakeSpeciesLookupDbClient() {
  const functionsInvoke = jest.fn().mockResolvedValue({ data: { species: [] }, error: null })
  const rpc = jest.fn().mockResolvedValue({ data: [], error: null })

  const client: SpeciesLookupDbClient = {
    functions: { invoke: functionsInvoke },
    rpc,
  }

  return { client, functionsInvoke, rpc }
}
