import type { SpeciesLookupDbClient } from '../species/speciesLookupRepository'

/**
 * An in-memory stand-in for the `usda-plant-traits` edge function.
 * Defaults to "no match" — the routine outcome (see ADR-0004) — so a test
 * only has to `mockResolvedValueOnce` when it cares about the lookup.
 */
export function createFakeSpeciesLookupDbClient() {
  const functionsInvoke = jest.fn().mockResolvedValue({ data: { species: [] }, error: null })

  const client: SpeciesLookupDbClient = {
    functions: { invoke: functionsInvoke },
  }

  return { client, functionsInvoke }
}
