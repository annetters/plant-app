import { careTaskTemplateRow } from '../test/careTaskTemplateRowFixture'
import { createFakePlantsDbClient } from '../test/fakePlantsDbClient'
import { plantRow } from '../test/plantRowFixture'
import { PlantsRepository } from './plantsRepository'

const originalFetch = globalThis.fetch

beforeEach(() => {
  globalThis.fetch = jest.fn().mockResolvedValue({
    arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
  }) as unknown as typeof fetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

describe('PlantsRepository', () => {
  it('lists Plants ordered by common name', async () => {
    const { client } = createFakePlantsDbClient([
      plantRow({ id: 'plant-2', common_name: 'Zinnia' }),
      plantRow({ id: 'plant-1', common_name: 'Aster' }),
    ])
    const repository = new PlantsRepository(client)

    const plants = await repository.list()

    expect(plants.map((p) => p.commonName)).toEqual(['Aster', 'Zinnia'])
  })

  it('returns an empty list when the account has no Plants yet', async () => {
    const { client } = createFakePlantsDbClient([])
    const repository = new PlantsRepository(client)

    expect(await repository.list()).toEqual([])
  })

  it('gets a single Plant by id, mapped from the row', async () => {
    const { client } = createFakePlantsDbClient([plantRow({ id: 'p1', common_name: 'Coneflower' })])
    const repository = new PlantsRepository(client)

    const plant = await repository.get('p1')

    expect(plant?.commonName).toBe('Coneflower')
  })

  it('returns null when getting a Plant that does not exist', async () => {
    const { client } = createFakePlantsDbClient([])
    const repository = new PlantsRepository(client)

    expect(await repository.get('missing')).toBeNull()
  })

  it('updates an existing Plant in place', async () => {
    const { client } = createFakePlantsDbClient([plantRow({ id: 'p1', common_name: 'Coneflower' })])
    const repository = new PlantsRepository(client)

    const updated = await repository.update('p1', {
      commonName: 'Purple Coneflower',
      scientificName: 'Echinacea purpurea',
      referencePhotoPaths: [],
    })

    expect(updated.commonName).toBe('Purple Coneflower')
  })

  it('deletes a Plant', async () => {
    const { client, rows } = createFakePlantsDbClient([plantRow({ id: 'p1' })])
    const repository = new PlantsRepository(client)

    await repository.remove('p1')

    expect(rows()).toHaveLength(0)
  })

  it('uploads a reference photo under the user/plant folder and returns its path', async () => {
    const { client, storage } = createFakePlantsDbClient()
    const repository = new PlantsRepository(client)

    const path = await repository.uploadReferencePhoto('plant-1', {
      uri: 'file:///tmp/leaf.jpg',
      name: 'leaf.jpg',
      mimeType: 'image/jpeg',
    })

    expect(path.startsWith('user-1/plant-1/')).toBe(true)
    expect(storage.upload).toHaveBeenCalledWith(path, expect.any(ArrayBuffer), {
      contentType: 'image/jpeg',
    })
  })

  it('signs a reference photo URL for display', async () => {
    const { client } = createFakePlantsDbClient()
    const repository = new PlantsRepository(client)

    const url = await repository.getReferencePhotoUrl('user-1/plant-1/a.jpg')

    expect(url).toBe('https://example.com/signed.jpg')
  })

  it('removes a reference photo by path', async () => {
    const { client, storage } = createFakePlantsDbClient()
    const repository = new PlantsRepository(client)

    await repository.removeReferencePhoto('user-1/plant-1/a.jpg')

    expect(storage.remove).toHaveBeenCalledWith(['user-1/plant-1/a.jpg'])
  })

  it("lists a Plant's Care task templates, ordered by creation", async () => {
    const { client } = createFakePlantsDbClient(
      [],
      [
        careTaskTemplateRow({ id: 't1', plant_id: 'plant-1', name: 'Fertilize' }),
        careTaskTemplateRow({ id: 't2', plant_id: 'plant-2', name: 'Prune' }),
      ],
    )
    const repository = new PlantsRepository(client)

    const templates = await repository.listCareTaskTemplates('plant-1')

    expect(templates.map((t) => t.id)).toEqual(['t1'])
  })
})
