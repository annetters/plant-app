import type { PlantInput } from '@plant-app/domain'
import type { SpeciesLookupSource } from './speciesLookup'
import {
  MINIMUM_COMMON_NAME_LOOKUP_LENGTH,
  applySuggestedTraits,
  canLookUpCommonName,
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

    expect(traits.traits.matureHeightInches).toBe(48)
  })

  it('never carries a sun requirement through, whatever Shade Tolerance USDA reports (#44)', async () => {
    const traits = await suggestSpeciesTraits(
      source({
        lookupUsdaByScientificName: jest.fn().mockResolvedValue({
          species: [],
          characteristics: [
            { name: 'Shade Tolerance', value: 'High' },
            { name: 'Height, Mature (feet)', value: '1.0' },
          ],
        }),
      }),
      'Opuntia polyacantha',
    )

    expect(traits.traits).not.toHaveProperty('sunRequirement')
  })

  it('returns nothing to suggest when USDA has no characteristics — the routine outcome', async () => {
    expect(await suggestSpeciesTraits(source(), 'Monarda didyma')).toEqual({
      traits: {},
      profile: { durations: [], growthHabits: [], family: null },
      traitSourceUnavailable: false,
    })
  })

  it('carries the reference-only profile through even when there are no traits at all (#36)', async () => {
    // The case #36 exists for: *Dahlia pinnata* is a real plant with zero
    // conservation characteristics. It used to look like a plant that did not
    // exist; now it comes back with something to show.
    const detail = await suggestSpeciesTraits(
      source({
        lookupUsdaByScientificName: jest.fn().mockResolvedValue({
          species: [{ scientificName: 'Dahlia pinnata', commonName: 'pinnate dahlia' }],
          profile: { durations: ['Perennial'], growthHabits: ['Forb/herb'], family: 'Asteraceae' },
          characteristics: [],
        }),
      }),
      'Dahlia pinnata',
    )

    expect(detail.traits).toEqual({})
    expect(detail.profile).toEqual({
      durations: ['Perennial'],
      growthHabits: ['Forb/herb'],
      family: 'Asteraceae',
    })
  })
})

describe('traitsNotAlreadySetBy', () => {
  it('keeps a suggestion for a field the user left blank', () => {
    const remaining = traitsNotAlreadySetBy({ matureHeightInches: 48 }, plantInput())

    expect(remaining.matureHeightInches).toBe(48)
  })

  it('never proposes overwriting a value the user typed themselves', () => {
    const remaining = traitsNotAlreadySetBy(
      { matureHeightInches: 48 },
      plantInput({ matureHeightInches: 36 }),
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
    expect(hasApplicableTraits({ matureHeightInches: 48 })).toBe(true)
  })
})

describe('applySuggestedTraits', () => {
  it('merges accepted traits onto the input, and never the hardiness zone', () => {
    const merged = applySuggestedTraits(plantInput(), {
      matureHeightInches: 48,
      minimumHardinessZone: 4,
    })

    expect(merged).toEqual(expect.objectContaining({ matureHeightInches: 48 }))
    expect(merged.hardinessZoneRange).toBeUndefined()
  })

  it('leaves the input untouched when there is nothing to apply', () => {
    expect(applySuggestedTraits(plantInput())).toEqual(plantInput())
  })
})

describe('canLookUpCommonName', () => {
  it('rejects a fragment too short to mean anything under substring matching', () => {
    expect(canLookUpCommonName('g')).toBe(false)
    expect(canLookUpCommonName('ro')).toBe(false)
    expect(canLookUpCommonName('')).toBe(false)
  })

  it('ignores surrounding whitespace rather than counting it toward the minimum', () => {
    expect(canLookUpCommonName('  g  ')).toBe(false)
    expect(canLookUpCommonName('  rose  ')).toBe(true)
  })

  it('accepts a name at the minimum length', () => {
    expect(canLookUpCommonName('a'.repeat(MINIMUM_COMMON_NAME_LOOKUP_LENGTH))).toBe(true)
    expect(canLookUpCommonName('rose')).toBe(true)
  })
})
