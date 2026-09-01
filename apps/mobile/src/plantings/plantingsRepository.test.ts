import { createFakePlantingsDbClient } from '../test/fakePlantingsDbClient'
import { plantingRow } from '../test/plantingRowFixture'
import { PlantingsRepository } from './plantingsRepository'

const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  }) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('PlantingsRepository', () => {
  it('lists every Planting across the given Beds', async () => {
    const { client } = createFakePlantingsDbClient([
      plantingRow({ id: 'planting-1', bed_id: 'bed-1' }),
      plantingRow({ id: 'planting-2', bed_id: 'bed-2' }),
      plantingRow({ id: 'planting-3', bed_id: 'bed-3' }),
    ])
    const repository = new PlantingsRepository(client)

    const plantings = await repository.listByBeds(['bed-1', 'bed-2'])

    expect(plantings.map((p) => p.id)).toEqual(['planting-1', 'planting-2'])
  })

  it('returns an empty list without querying when there are no Beds', async () => {
    const { client } = createFakePlantingsDbClient([plantingRow({ bed_id: 'bed-1' })])
    const repository = new PlantingsRepository(client)

    expect(await repository.listByBeds([])).toEqual([])
  })

  it('gets a single Planting by id, mapped from the row', async () => {
    const { client } = createFakePlantingsDbClient([plantingRow({ id: 'planting-1', quantity: 3 })])
    const repository = new PlantingsRepository(client)

    const planting = await repository.get('planting-1')

    expect(planting?.quantity).toBe(3)
  })

  it('returns null when getting a Planting that does not exist', async () => {
    const { client } = createFakePlantingsDbClient([])
    const repository = new PlantingsRepository(client)

    expect(await repository.get('missing')).toBeNull()
  })

  it("removes a Planting's photo files from storage before deleting its row", async () => {
    const { client, storage, plantingRows } = createFakePlantingsDbClient(
      [plantingRow({ id: 'planting-1' })],
      [{ id: 'photo-1', planting_id: 'planting-1', storage_path: 'user-1/planting-1/a.jpg', taken_on: '2026-05-01', created_at: '2026-01-01T00:00:00.000Z' }],
    )
    const repository = new PlantingsRepository(client)

    await repository.remove('planting-1')

    expect(storage.remove).toHaveBeenCalledWith(['user-1/planting-1/a.jpg'])
    expect(plantingRows()).toHaveLength(0)
  })

  it("lists a Planting's dated photo log, most recent first", async () => {
    const { client } = createFakePlantingsDbClient(
      [],
      [
        { id: 'photo-1', planting_id: 'planting-1', storage_path: 'a.jpg', taken_on: '2026-05-01', created_at: '2026-01-01T00:00:00.000Z' },
        { id: 'photo-2', planting_id: 'planting-1', storage_path: 'b.jpg', taken_on: '2026-06-01', created_at: '2026-01-01T00:00:00.000Z' },
      ],
    )
    const repository = new PlantingsRepository(client)

    const photos = await repository.listPhotos('planting-1')

    expect(photos.map((p) => p.id)).toEqual(['photo-2', 'photo-1'])
  })

  it('uploads a dated photo and records it against the Planting', async () => {
    const { client, storage } = createFakePlantingsDbClient()
    const repository = new PlantingsRepository(client)

    const photo = await repository.addPhoto(
      'planting-1',
      { uri: 'file:///tmp/bloom.jpg', name: 'bloom.jpg', mimeType: 'image/jpeg' },
      '2026-06-01',
    )

    expect(photo.takenOn).toBe('2026-06-01')
    expect(storage.upload).toHaveBeenCalledWith(
      expect.stringContaining('user-1/planting-1/'),
      expect.any(ArrayBuffer),
      { contentType: 'image/jpeg' },
    )
  })

  it('signs a photo URL for display', async () => {
    const { client } = createFakePlantingsDbClient()
    const repository = new PlantingsRepository(client)

    const url = await repository.getPhotoUrl('user-1/planting-1/a.jpg')

    expect(url).toBe('https://example.com/signed.jpg')
  })

  it('removes a photo from storage and its row', async () => {
    const { client, storage, photoRows } = createFakePlantingsDbClient(
      [],
      [{ id: 'photo-1', planting_id: 'planting-1', storage_path: 'a.jpg', taken_on: '2026-05-01', created_at: '2026-01-01T00:00:00.000Z' }],
    )
    const repository = new PlantingsRepository(client)

    await repository.removePhoto('photo-1', 'a.jpg')

    expect(storage.remove).toHaveBeenCalledWith(['a.jpg'])
    expect(photoRows()).toHaveLength(0)
  })
})
