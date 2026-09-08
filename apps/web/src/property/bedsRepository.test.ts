import type { BedInput, BedRow } from '@plant-app/domain'
import { describe, expect, it } from 'vitest'
import { createFakeBedsDbClient } from '../test/fakeBedsDbClient'
import { BedsRepository } from './bedsRepository'

const EXISTING_ROW: BedRow = {
  id: 'bed-1',
  property_id: 'property-1',
  name: 'Front border',
  tool: 'freehand',
  points: [
    { x: 0, y: 0 },
    { x: 10, y: 0 },
    { x: 10, y: 5 },
  ],
  smoothing_enabled: false,
  created_at: '2026-01-01T00:00:00.000Z',
}

const OTHER_PROPERTY_ROW: BedRow = { ...EXISTING_ROW, id: 'bed-2', property_id: 'property-2' }

const INPUT: BedInput = {
  propertyId: 'property-1',
  name: 'Back bed',
  tool: 'pen',
  points: [
    { x: 0, y: 0 },
    { x: 4, y: 0 },
    { x: 4, y: 4 },
  ],
  smoothingEnabled: true,
}

describe('BedsRepository.list', () => {
  it('returns only the Beds belonging to the given Property', async () => {
    const { client } = createFakeBedsDbClient([EXISTING_ROW, OTHER_PROPERTY_ROW])
    const repository = new BedsRepository(client)

    const beds = await repository.list('property-1')

    expect(beds).toHaveLength(1)
    expect(beds[0]).toEqual({
      id: 'bed-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      propertyId: 'property-1',
      name: 'Front border',
      tool: 'freehand',
      points: EXISTING_ROW.points,
      smoothingEnabled: false,
    })
  })

  it('returns an empty list when the Property has no Beds yet', async () => {
    const { client } = createFakeBedsDbClient([])
    const repository = new BedsRepository(client)
    expect(await repository.list('property-1')).toEqual([])
  })
})

describe('BedsRepository.create', () => {
  it('inserts the Bed and returns it mapped from its row', async () => {
    const { client, getRows } = createFakeBedsDbClient([])
    const repository = new BedsRepository(client)

    const bed = await repository.create(INPUT)

    expect(bed.propertyId).toBe('property-1')
    expect(bed.name).toBe('Back bed')
    expect(bed.tool).toBe('pen')
    expect(bed.smoothingEnabled).toBe(true)
    expect(getRows()).toHaveLength(1)
  })
})

describe('BedsRepository.remove', () => {
  it('deletes the Bed', async () => {
    const { client } = createFakeBedsDbClient([EXISTING_ROW])
    const repository = new BedsRepository(client)

    await repository.remove('bed-1')

    expect(await repository.list('property-1')).toEqual([])
  })
})

describe('BedsRepository.rename', () => {
  it('updates the name and returns the Bed mapped from its row', async () => {
    const { client } = createFakeBedsDbClient([EXISTING_ROW])
    const repository = new BedsRepository(client)

    const renamed = await repository.rename('bed-1', 'Side border')

    expect(renamed.id).toBe('bed-1')
    expect(renamed.name).toBe('Side border')
    expect((await repository.list('property-1'))[0].name).toBe('Side border')
  })

  it('leaves the outline untouched', async () => {
    const { client } = createFakeBedsDbClient([EXISTING_ROW])
    const repository = new BedsRepository(client)

    const renamed = await repository.rename('bed-1', 'Side border')

    expect(renamed.points).toEqual(EXISTING_ROW.points)
    expect(renamed.tool).toBe('freehand')
  })

  it('throws when the new name collides on the same Property', async () => {
    // The database carries beds_unique_name_per_property; callers validate
    // first, so reaching this is the backstop, not the normal path.
    const { client } = createFakeBedsDbClient([
      EXISTING_ROW,
      { ...EXISTING_ROW, id: 'bed-9', name: 'Side border' },
    ])
    const repository = new BedsRepository(client)

    await expect(repository.rename('bed-1', 'side border')).rejects.toThrow(
      /beds_unique_name_per_property/,
    )
  })
})
