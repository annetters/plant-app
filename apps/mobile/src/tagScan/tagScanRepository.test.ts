import { createFakeTagScanDbClient } from '../test/fakeTagScanDbClient'
import { plantRow } from '../test/plantRowFixture'
import { TagScanRepository } from './tagScanRepository'

const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  }) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('TagScanRepository', () => {
  it('lists Plants ordered by common name', async () => {
    const { client } = createFakeTagScanDbClient([
      plantRow({ id: 'plant-2', common_name: 'Zinnia' }),
      plantRow({ id: 'plant-1', common_name: 'Aster' }),
    ])
    const repository = new TagScanRepository(client)

    const plants = await repository.listPlants()

    expect(plants.map((p) => p.commonName)).toEqual(['Aster', 'Zinnia'])
  })

  it('creates a Plant scoped to the authenticated user', async () => {
    const { client, plantRows, userId } = createFakeTagScanDbClient()
    const repository = new TagScanRepository(client)

    const plant = await repository.createPlant({
      commonName: 'Bee balm',
      scientificName: 'Monarda didyma',
    })

    expect(plant.commonName).toBe('Bee balm')
    expect(plantRows()[0]).toMatchObject({ user_id: userId, common_name: 'Bee balm' })
  })

  it('uploads a tag photo and records it, independent of any Plant', async () => {
    const { client, storage, tagPhotoRows, userId } = createFakeTagScanDbClient()
    const repository = new TagScanRepository(client)

    const result = await repository.uploadTagPhoto('scan-1', {
      uri: 'file:///tag.jpg',
      name: 'tag.jpg',
      mimeType: 'image/jpeg',
    })

    expect(storage.upload).toHaveBeenCalledWith(
      expect.stringContaining(`${userId}/scan-1/`),
      expect.any(ArrayBuffer),
      { contentType: 'image/jpeg' },
    )
    expect(tagPhotoRows()).toEqual([
      expect.objectContaining({ id: result.id, storage_path: result.storagePath, user_id: userId }),
    ])
  })

  it('links a tag photo to a Plant after the scan resolves', async () => {
    const { client, tagPhotoRows } = createFakeTagScanDbClient()
    const repository = new TagScanRepository(client)
    const { id: tagPhotoId } = await repository.uploadTagPhoto('scan-1', {
      uri: 'file:///tag.jpg',
      name: 'tag.jpg',
      mimeType: 'image/jpeg',
    })

    await repository.linkTagPhotoToPlant(tagPhotoId, 'plant-1')

    expect(tagPhotoRows()).toEqual([expect.objectContaining({ plant_id: 'plant-1' })])
  })

  it('looks up USDA species by common name', async () => {
    const { client, functionsInvoke } = createFakeTagScanDbClient()
    functionsInvoke.mockResolvedValueOnce({
      data: { species: [{ scientificName: 'Monarda didyma', commonName: 'bee balm' }] },
      error: null,
    })
    const repository = new TagScanRepository(client)

    const species = await repository.lookupUsdaByCommonName('bee balm')

    expect(functionsInvoke).toHaveBeenCalledWith('usda-plant-traits', { body: { commonName: 'bee balm' } })
    expect(species).toEqual([{ scientificName: 'Monarda didyma', commonName: 'bee balm' }])
  })

  it('returns an empty characteristics list when USDA has no match — a routine outcome, not an error', async () => {
    const { client, functionsInvoke } = createFakeTagScanDbClient()
    functionsInvoke.mockResolvedValueOnce({ data: { species: [] }, error: null })
    const repository = new TagScanRepository(client)

    const result = await repository.lookupUsdaByScientificName('Monarda didyma')

    expect(result).toEqual({ species: [], characteristics: [] })
  })

  it('throws the embedded error message when the Edge Function reports one', async () => {
    const { client, functionsInvoke } = createFakeTagScanDbClient()
    functionsInvoke.mockResolvedValueOnce({
      data: { error: 'Could not reach USDA PLANTS. Try again.' },
      error: null,
    })
    const repository = new TagScanRepository(client)

    await expect(repository.lookupUsdaByScientificName('Monarda didyma')).rejects.toThrow(
      'Could not reach USDA PLANTS. Try again.',
    )
  })
})
