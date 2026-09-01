import type { PlantingInput, PlantingPhotoRow, PlantingRow } from '@plant-app/domain'
import { describe, expect, it } from 'vitest'
import { createFakePlantingsDbClient } from '../test/fakePlantingsDbClient'
import { PlantingsRepository } from './plantingsRepository'

const ROW_IN_BED_1: PlantingRow = {
  id: 'planting-1',
  plant_id: 'plant-1',
  bed_id: 'bed-1',
  quantity: 3,
  year_acquired: 2022,
  source_nursery: 'Weston Nurseries',
  pin_x: 2,
  pin_y: 4,
  created_at: '2026-01-01T00:00:00.000Z',
}

const ROW_IN_BED_2: PlantingRow = { ...ROW_IN_BED_1, id: 'planting-2', bed_id: 'bed-2' }

const INPUT: PlantingInput = {
  plantId: 'plant-1',
  bedId: 'bed-1',
  quantity: 24,
  pin: { x: 5, y: 5 },
}

describe('PlantingsRepository.get', () => {
  it('returns the matching Planting', async () => {
    const { client } = createFakePlantingsDbClient([ROW_IN_BED_1, ROW_IN_BED_2])
    const repository = new PlantingsRepository(client)

    const result = await repository.get('planting-2')

    expect(result?.id).toBe('planting-2')
  })

  it('returns null when no Planting matches', async () => {
    const { client } = createFakePlantingsDbClient([ROW_IN_BED_1])
    const repository = new PlantingsRepository(client)

    const result = await repository.get('does-not-exist')

    expect(result).toBeNull()
  })
})

describe('PlantingsRepository.listByBeds', () => {
  it('returns only the Plantings belonging to the given Beds', async () => {
    const { client } = createFakePlantingsDbClient([ROW_IN_BED_1, ROW_IN_BED_2])
    const repository = new PlantingsRepository(client)

    const result = await repository.listByBeds(['bed-1'])

    expect(result).toHaveLength(1)
    expect(result[0]).toEqual({
      id: 'planting-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      plantId: 'plant-1',
      bedId: 'bed-1',
      quantity: 3,
      yearAcquired: 2022,
      sourceNursery: 'Weston Nurseries',
      pin: { x: 2, y: 4 },
    })
  })

  it('returns Plantings across multiple Beds', async () => {
    const { client } = createFakePlantingsDbClient([ROW_IN_BED_1, ROW_IN_BED_2])
    const repository = new PlantingsRepository(client)

    expect(await repository.listByBeds(['bed-1', 'bed-2'])).toHaveLength(2)
  })

  it('returns an empty list without querying when given no Bed ids', async () => {
    const { client } = createFakePlantingsDbClient([ROW_IN_BED_1])
    const repository = new PlantingsRepository(client)

    expect(await repository.listByBeds([])).toEqual([])
  })
})

describe('PlantingsRepository.create', () => {
  it('inserts the Planting as a single record, quantity included, and returns it mapped from its row', async () => {
    const { client, plantingRows } = createFakePlantingsDbClient([])
    const repository = new PlantingsRepository(client)

    const planting = await repository.create(INPUT)

    expect(planting.plantId).toBe('plant-1')
    expect(planting.bedId).toBe('bed-1')
    expect(planting.quantity).toBe(24)
    expect(planting.pin).toEqual({ x: 5, y: 5 })
    // The literal acceptance criterion: one row, not 24.
    expect(plantingRows()).toHaveLength(1)
    expect(plantingRows()[0].quantity).toBe(24)
  })
})

describe('PlantingsRepository.remove', () => {
  it('deletes the Planting', async () => {
    const { client } = createFakePlantingsDbClient([ROW_IN_BED_1])
    const repository = new PlantingsRepository(client)

    await repository.remove('planting-1')

    expect(await repository.listByBeds(['bed-1'])).toEqual([])
  })

  it('removes the Planting’s photo files from storage, not just its rows', async () => {
    const photoRow: PlantingPhotoRow = {
      id: 'photo-1',
      planting_id: 'planting-1',
      storage_path: 'user-1/planting-1/a.jpg',
      taken_on: '2026-06-01',
      created_at: '2026-01-01T00:00:00.000Z',
    }
    const { client, storage } = createFakePlantingsDbClient([ROW_IN_BED_1], [photoRow])
    const repository = new PlantingsRepository(client)

    await repository.remove('planting-1')

    expect(storage.remove).toHaveBeenCalledWith([photoRow.storage_path])
  })

  it('skips the storage call when the Planting has no photos', async () => {
    const { client, storage } = createFakePlantingsDbClient([ROW_IN_BED_1])
    const repository = new PlantingsRepository(client)

    await repository.remove('planting-1')

    expect(storage.remove).not.toHaveBeenCalled()
  })
})

const PHOTO_ROW: PlantingPhotoRow = {
  id: 'photo-1',
  planting_id: 'planting-1',
  storage_path: 'user-1/planting-1/a.jpg',
  taken_on: '2026-06-01',
  created_at: '2026-01-01T00:00:00.000Z',
}

describe('PlantingsRepository photo log', () => {
  it('lists a Planting`s dated photos, most recent first', async () => {
    const olderRow = { ...PHOTO_ROW, id: 'photo-2', taken_on: '2025-01-01' }
    const { client } = createFakePlantingsDbClient([], [PHOTO_ROW, olderRow])
    const repository = new PlantingsRepository(client)

    const photos = await repository.listPhotos('planting-1')

    expect(photos.map((p) => p.id)).toEqual(['photo-1', 'photo-2'])
  })

  it('uploads a photo and records a dated row against the Planting', async () => {
    const { client, storage, photoRows } = createFakePlantingsDbClient([])
    const repository = new PlantingsRepository(client)

    const photo = await repository.addPhoto('planting-1', new File(['x'], 'a.jpg'), '2026-06-01')

    expect(storage.upload).toHaveBeenCalled()
    expect(photo.plantingId).toBe('planting-1')
    expect(photo.takenOn).toBe('2026-06-01')
    expect(photoRows()).toHaveLength(1)
  })

  it('removes a photo from storage and its row', async () => {
    const { client, storage } = createFakePlantingsDbClient([], [PHOTO_ROW])
    const repository = new PlantingsRepository(client)

    await repository.removePhoto('photo-1', PHOTO_ROW.storage_path)

    expect(storage.remove).toHaveBeenCalledWith([PHOTO_ROW.storage_path])
    expect(await repository.listPhotos('planting-1')).toEqual([])
  })
})
