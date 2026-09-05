import { createFakeSpeciesLookupDbClient } from '../test/fakeSpeciesLookupDbClient'
import { SpeciesLookupRepository } from './speciesLookupRepository'

describe('SpeciesLookupRepository', () => {
  it('looks up USDA species by common name', async () => {
    const { client, functionsInvoke } = createFakeSpeciesLookupDbClient()
    functionsInvoke.mockResolvedValueOnce({
      data: { species: [{ scientificName: 'Monarda didyma', commonName: 'bee balm' }] },
      error: null,
    })
    const repository = new SpeciesLookupRepository(client)

    const species = await repository.lookupUsdaByCommonName('bee balm')

    expect(functionsInvoke).toHaveBeenCalledWith('usda-plant-traits', { body: { commonName: 'bee balm' } })
    expect(species).toEqual([{ scientificName: 'Monarda didyma', commonName: 'bee balm' }])
  })

  it('returns an empty characteristics list when USDA has no match — a routine outcome, not an error', async () => {
    const { client, functionsInvoke } = createFakeSpeciesLookupDbClient()
    functionsInvoke.mockResolvedValueOnce({ data: { species: [] }, error: null })
    const repository = new SpeciesLookupRepository(client)

    const result = await repository.lookupUsdaByScientificName('Monarda didyma')

    expect(result).toEqual({ species: [], characteristics: [] })
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
