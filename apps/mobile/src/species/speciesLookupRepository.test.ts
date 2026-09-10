import { createFakeSpeciesLookupDbClient } from '../test/fakeSpeciesLookupDbClient'
import { SpeciesLookupRepository } from './speciesLookupRepository'

describe('SpeciesLookupRepository', () => {
  it('resolves names against the local index rather than an edge function (#36)', async () => {
    const { client, rpc, functionsInvoke } = createFakeSpeciesLookupDbClient()
    rpc.mockResolvedValueOnce({
      data: [{ scientific_name: 'Monarda didyma', common_name: 'scarlet beebalm' }],
      error: null,
    })
    const repository = new SpeciesLookupRepository(client)

    const species = await repository.lookupUsdaByCommonName('bee balm')

    expect(rpc).toHaveBeenCalledWith('search_usda_plant_names', {
      search_text: 'bee balm',
      result_limit: 25,
    })
    expect(functionsInvoke).not.toHaveBeenCalled()
    expect(species).toEqual([{ scientificName: 'Monarda didyma', commonName: 'scarlet beebalm' }])
  })

  it('keeps a species USDA has no common name for', async () => {
    const { client, rpc } = createFakeSpeciesLookupDbClient()
    rpc.mockResolvedValueOnce({
      data: [{ scientific_name: 'Hosta venusta', common_name: null }],
      error: null,
    })
    const repository = new SpeciesLookupRepository(client)

    expect(await repository.lookupUsdaByCommonName('hosta')).toEqual([
      { scientificName: 'Hosta venusta', commonName: null },
    ])
  })

  it('throws when the name search itself fails', async () => {
    const { client, rpc } = createFakeSpeciesLookupDbClient()
    rpc.mockResolvedValueOnce({ data: null, error: { message: 'connection refused' } })
    const repository = new SpeciesLookupRepository(client)

    await expect(repository.lookupUsdaByCommonName('bee balm')).rejects.toThrow('connection refused')
  })

  it('returns an empty characteristics list when USDA has no trait record — routine, not an error', async () => {
    const { client, functionsInvoke } = createFakeSpeciesLookupDbClient()
    functionsInvoke.mockResolvedValueOnce({
      data: {
        species: [{ scientificName: 'Dahlia pinnata', commonName: 'pinnate dahlia' }],
        profile: { durations: ['Perennial'], growthHabits: ['Forb/herb'], family: 'Asteraceae' },
        characteristics: [],
      },
      error: null,
    })
    const repository = new SpeciesLookupRepository(client)

    const result = await repository.lookupUsdaByScientificName('Dahlia pinnata')

    // The whole point of #36: the species is found even though its traits
    // aren't. Before, an empty characteristics list *was* "no such plant".
    expect(result.species).toEqual([{ scientificName: 'Dahlia pinnata', commonName: 'pinnate dahlia' }])
    expect(result.characteristics).toEqual([])
    expect(result.profile).toEqual({
      durations: ['Perennial'],
      growthHabits: ['Forb/herb'],
      family: 'Asteraceae',
    })
    expect(result.traitSourceUnavailable).toBe(false)
  })

  it('tolerates a response with no profile at all', async () => {
    const { client, functionsInvoke } = createFakeSpeciesLookupDbClient()
    functionsInvoke.mockResolvedValueOnce({ data: { species: [] }, error: null })
    const repository = new SpeciesLookupRepository(client)

    expect(await repository.lookupUsdaByScientificName('Monarda didyma')).toEqual({
      species: [],
      profile: undefined,
      characteristics: [],
      traitSourceUnavailable: false,
    })
  })

  it('distinguishes "USDA was unreachable" from "USDA has nothing" (#36)', async () => {
    // The two used to be the same silence, which is the confusion this whole
    // ticket exists to remove — it must not reappear one layer in.
    const { client, functionsInvoke } = createFakeSpeciesLookupDbClient()
    functionsInvoke.mockResolvedValueOnce({
      data: {
        species: [{ scientificName: 'Dahlia pinnata', commonName: 'pinnate dahlia' }],
        characteristics: [],
        traitSourceUnavailable: true,
      },
      error: null,
    })
    const repository = new SpeciesLookupRepository(client)

    const result = await repository.lookupUsdaByScientificName('Dahlia pinnata')

    expect(result.traitSourceUnavailable).toBe(true)
    // The name still resolved — it came from our own table, not from USDA.
    expect(result.species).toHaveLength(1)
  })

  it('throws the embedded error message when the Edge Function reports one', async () => {
    const { client, functionsInvoke } = createFakeSpeciesLookupDbClient()
    functionsInvoke.mockResolvedValueOnce({
      data: { error: 'Could not reach USDA PLANTS. Try again.' },
      error: null,
    })
    const repository = new SpeciesLookupRepository(client)

    await expect(repository.lookupUsdaByScientificName('Monarda didyma')).rejects.toThrow(
      'Could not reach USDA PLANTS. Try again.',
    )
  })
})
