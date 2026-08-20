import type { Plant } from '@plant-app/domain'
import { describe, expect, it } from 'vitest'
import {
  EMPTY_PLANT_FORM_FIELDS,
  plantFormFieldsFromPlant,
  plantInputFromFormFields,
} from './plantFormFields'

function plant(overrides: Partial<Plant> = {}): Plant {
  return {
    id: 'plant-1',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    commonName: 'Coneflower',
    scientificName: 'Echinacea purpurea',
    referencePhotoPaths: [],
    ...overrides,
  }
}

describe('plantFormFieldsFromPlant', () => {
  it('fills in blank strings for every unset optional field', () => {
    const fields = plantFormFieldsFromPlant(plant())
    expect(fields).toEqual({
      ...EMPTY_PLANT_FORM_FIELDS,
      commonName: 'Coneflower',
      scientificName: 'Echinacea purpurea',
    })
  })

  it('stringifies the bloom window and numeric fields for controlled inputs', () => {
    const fields = plantFormFieldsFromPlant(
      plant({
        bloomWindow: { start: { month: 6, day: 1 }, end: { month: 8, day: 15 } },
        matureHeightInches: 24,
        matureSpreadInches: 18,
        hardinessZone: '5b',
        sunRequirement: 'part-shade',
        foliageType: 'evergreen',
        nativeStatus: 'non-native',
      }),
    )
    expect(fields.bloomStartMonth).toBe('6')
    expect(fields.bloomStartDay).toBe('1')
    expect(fields.bloomEndMonth).toBe('8')
    expect(fields.bloomEndDay).toBe('15')
    expect(fields.matureHeightInches).toBe('24')
    expect(fields.matureSpreadInches).toBe('18')
    expect(fields.hardinessZone).toBe('5b')
    expect(fields.sunRequirement).toBe('part-shade')
    expect(fields.foliageType).toBe('evergreen')
    expect(fields.nativeStatus).toBe('non-native')
  })
})

describe('plantInputFromFormFields', () => {
  it('omits every optional field left blank', () => {
    const input = plantInputFromFormFields(
      { ...EMPTY_PLANT_FORM_FIELDS, commonName: 'Aster', scientificName: 'Symphyotrichum' },
      [],
    )
    expect(input).toEqual({
      commonName: 'Aster',
      scientificName: 'Symphyotrichum',
      referencePhotoPaths: [],
    })
  })

  it('parses numeric and bloom-window fields back into a PlantInput', () => {
    const input = plantInputFromFormFields(
      {
        ...EMPTY_PLANT_FORM_FIELDS,
        commonName: 'Joe Pye Weed',
        scientificName: 'Eutrochium purpureum',
        bloomStartMonth: '7',
        bloomStartDay: '15',
        bloomEndMonth: '9',
        bloomEndDay: '1',
        matureHeightInches: '72',
      },
      ['user-1/plant-1/a.jpg'],
    )
    expect(input.bloomWindow).toEqual({
      start: { month: 7, day: 15 },
      end: { month: 9, day: 1 },
    })
    expect(input.matureHeightInches).toBe(72)
    expect(input.referencePhotoPaths).toEqual(['user-1/plant-1/a.jpg'])
  })

  it('treats a partially filled bloom window as started, producing an invalid (0) day/month elsewhere for validatePlantInput to reject', () => {
    const input = plantInputFromFormFields(
      {
        ...EMPTY_PLANT_FORM_FIELDS,
        commonName: 'Aster',
        scientificName: 'Symphyotrichum',
        bloomStartMonth: '7',
      },
      [],
    )
    expect(input.bloomWindow).toEqual({
      start: { month: 7, day: 0 },
      end: { month: 0, day: 0 },
    })
  })

  it('round-trips through plantFormFieldsFromPlant for every filled-in field', () => {
    const original = plant({
      cultivar: 'Gateway',
      flowerColor: 'mauve pink',
      bloomWindow: { start: { month: 7, day: 15 }, end: { month: 9, day: 1 } },
      sunRequirement: 'full-sun',
      matureHeightInches: 72,
      matureSpreadInches: 48,
      hardinessZone: '4b',
      foliageType: 'deciduous',
      nativeStatus: 'native',
      referencePhotoPaths: ['user-1/plant-1/a.jpg'],
    })

    const input = plantInputFromFormFields(
      plantFormFieldsFromPlant(original),
      original.referencePhotoPaths,
    )

    const { id: _id, createdAt: _createdAt, updatedAt: _updatedAt, ...expected } = original
    expect(input).toEqual(expected)
  })
})
