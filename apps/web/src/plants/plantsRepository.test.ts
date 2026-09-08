import { describe, expect, it } from 'vitest'
import { createFakePlantsDbClient } from '../test/fakePlantsDbClient'
import { plantRow as row } from '../test/plantRowFixture'
import { PlantsRepository } from './plantsRepository'

describe('PlantsRepository', () => {
  it('lists plants ordered by common name', async () => {
    const { client } = createFakePlantsDbClient([
      row({ id: 'p1', common_name: 'Zinnia' }),
      row({ id: 'p2', common_name: 'Aster' }),
    ])
    const repo = new PlantsRepository(client)

    const plants = await repo.list()

    expect(plants.map((p) => p.commonName)).toEqual(['Aster', 'Zinnia'])
  })

  it('creates a plant tagged with the signed-in user and returns the mapped domain object', async () => {
    const { client, rows } = createFakePlantsDbClient()
    const repo = new PlantsRepository(client)

    const plant = await repo.create({
      commonName: 'Joe Pye Weed',
      scientificName: 'Eutrochium purpureum',
      cultivar: 'Gateway',
    })

    expect(plant.commonName).toBe('Joe Pye Weed')
    expect(plant.cultivar).toBe('Gateway')
    expect(plant.id).toBeDefined()
    expect(rows()[0].user_id).toBe('user-1')
  })

  it('gets a single plant by id, mapped from the row', async () => {
    const { client } = createFakePlantsDbClient([row({ id: 'p1', common_name: 'Coneflower' })])
    const repo = new PlantsRepository(client)

    const plant = await repo.get('p1')

    expect(plant?.commonName).toBe('Coneflower')
  })

  it('returns null when getting a plant that does not exist', async () => {
    const { client } = createFakePlantsDbClient([])
    const repo = new PlantsRepository(client)

    expect(await repo.get('missing')).toBeNull()
  })

  it('updates an existing plant in place', async () => {
    const { client } = createFakePlantsDbClient([row({ id: 'p1', common_name: 'Coneflower' })])
    const repo = new PlantsRepository(client)

    const updated = await repo.update('p1', {
      commonName: 'Purple Coneflower',
      scientificName: 'Echinacea purpurea',
    })

    expect(updated.commonName).toBe('Purple Coneflower')
  })

  it('deletes a plant', async () => {
    const { client, rows } = createFakePlantsDbClient([row({ id: 'p1' })])
    const repo = new PlantsRepository(client)

    await repo.remove('p1')

    expect(rows()).toHaveLength(0)
  })

  it('uploads a reference photo under the user/plant folder and returns its path', async () => {
    const { client, storage } = createFakePlantsDbClient()
    const repo = new PlantsRepository(client)
    const file = new File(['data'], 'tag.jpg', { type: 'image/jpeg' })

    const path = await repo.uploadReferencePhoto('plant-1', file)

    expect(path.startsWith('user-1/plant-1/')).toBe(true)
    expect(storage.upload).toHaveBeenCalledWith(path, file)
  })

  it('removes a reference photo by path', async () => {
    const { client, storage } = createFakePlantsDbClient()
    const repo = new PlantsRepository(client)

    await repo.removeReferencePhoto('user-1/plant-1/a.jpg')

    expect(storage.remove).toHaveBeenCalledWith(['user-1/plant-1/a.jpg'])
  })
})
