import type { PlantInput } from '@plant-app/domain'
import type { SpeciesLookupSource } from './speciesLookup'
import {
  applySuggestedTraits,
  hasApplicableTraits,
  lookupSpeciesByCommonName,
  suggestSpeciesTraits,
  traitsNotAlreadySetBy,
} from './speciesLookup'

function plantInput(overrides: Partial<PlantInput> = {}): PlantInput {
  return {
    commonName: 'Bee balm',
    scientificName: 'Monarda didyma',
    referencePhotoPaths: [],
    ...overrides,
  }
}

function source(overrides: Partial<SpeciesLookupSource> = {}): SpeciesLookupSource {
  return {
    lookupUsdaByCommonName: jest.fn().mockResolvedValue([]),
    lookupUsdaByScientificName: jest.fn().mockResolvedValue({ species: [], characteristics: [] }),
    ...overrides,
  }
}

describe('lookupSpeciesByCommonName', () => {
  it('resolves a common name that maps to exactly one species', async () => {
    const resolution = await lookupSpeciesByCommonName(
      source({
        lookupUsdaByCommonName: jest
          .fn()
          .mockResolvedValue([{ scientificName: 'Monarda didyma', commonName: 'bee balm' }]),
      }),
      'bee balm',
    )

    expect(resolution).toEqual({
      status: 'resolved',
      species: { scientificName: 'Monarda didyma', commonName: 'bee balm' },
    })
  })

  it('never guesses when a common name spans several species', async () => {
    const resolution = await lookupSpeciesByCommonName(
      source({
        lookupUsdaByCommonName: jest.fn().mockResolvedValue([
          { scientificName: 'Liatris spicata', commonName: 'liatris' },
          { scientificName: 'Liatris aspera', commonName: 'liatris' },
        ]),
      }),
      'liatris',
    )

    expect(resolution.status).toBe('ambiguous')
  })

  it('reports no match rather than throwing when USDA knows nothing', async () => {
    expect(await lookupSpeciesByCommonName(source(), 'not a plant')).toEqual({ status: 'unresolved' })
  })
})

describe('suggestSpeciesTraits', () => {
  it('projects USDA characteristics into the traits worth suggesting', async () => {
    const traits = await suggestSpeciesTraits(
      source({
        lookupUsdaByScientificName: jest.fn().mockResolvedValue({
          species: [],
          characteristics: [
            { name: 'Shade Tolerance', value: 'None' },
            { name: 'Height, Mature (feet)', value: '4.0' },
          ],
        }),
      }),
      'Monarda didyma',
    )

    expect(traits.sunRequirement).toBe('full-sun')
    expect(traits.matureHeightInches).toBe(48)
  })

  it('returns nothing to suggest when USDA has no characteristics — the routine outcome', async () => {
    expect(await suggestSpeciesTraits(source(), 'Monarda didyma')).toEqual({})
  })
})

describe('traitsNotAlreadySetBy', () => {
  it('keeps a suggestion for a field the user left blank', () => {
    const remaining = traitsNotAlreadySetBy({ sunRequirement: 'full-sun' }, plantInput())

    expect(remaining.sunRequirement).toBe('full-sun')
  })

  it('never proposes overwriting a value the user typed themselves', () => {
    const remaining = traitsNotAlreadySetBy(
      { sunRequirement: 'full-sun', matureHeightInches: 48 },
      plantInput({ sunRequirement: 'full-shade', matureHeightInches: 36 }),
    )

    expect(remaining).toEqual({})
  })

  it('keeps the reference-only hardiness zone either way — it is never written', () => {
    const remaining = traitsNotAlreadySetBy(
      { minimumHardinessZone: 4 },
      plantInput({ hardinessZoneRange: { min: 6, max: 8 } }),
    )

    expect(remaining.minimumHardinessZone).toBe(4)
  })
})

describe('hasApplicableTraits', () => {
  it('is false when only the reference-only hardiness zone is left, since accepting would change nothing', () => {
    expect(hasApplicableTraits({ minimumHardinessZone: 4 })).toBe(false)
    expect(hasApplicableTraits({})).toBe(false)
  })

  it('is true for a trait that would actually be written', () => {
    expect(hasApplicableTraits({ sunRequirement: 'full-sun' })).toBe(true)
    expect(hasApplicableTraits({ matureHeightInches: 48 })).toBe(true)
  })
})

describe('applySuggestedTraits', () => {
  it('merges accepted traits onto the input, and never the hardiness zone', () => {
    const merged = applySuggestedTraits(plantInput(), {
      sunRequirement: 'full-sun',
      matureHeightInches: 48,
      minimumHardinessZone: 4,
    })

    expect(merged).toEqual(
      expect.objectContaining({ sunRequirement: 'full-sun', matureHeightInches: 48 }),
    )
    expect(merged.hardinessZoneRange).toBeUndefined()
  })

  it('leaves the input untouched when there is nothing to apply', () => {
    expect(applySuggestedTraits(plantInput())).toEqual(plantInput())
  })
})
