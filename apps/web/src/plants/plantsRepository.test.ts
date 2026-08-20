import { describe, expect, it } from 'vitest'
import { careTaskTemplateRow } from '../test/careTaskTemplateRowFixture'
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

  it('lists care task templates for a plant, ordered by creation', async () => {
    const { client } = createFakePlantsDbClient(
      [],
      [
        careTaskTemplateRow({
          id: 't1',
          plant_id: 'plant-1',
          name: 'Fertilize',
          created_at: '2026-02-01T00:00:00.000Z',
        }),
        careTaskTemplateRow({
          id: 't2',
          plant_id: 'plant-1',
          name: 'Prune',
          created_at: '2026-01-01T00:00:00.000Z',
        }),
        careTaskTemplateRow({ id: 't3', plant_id: 'plant-2', name: 'Water' }),
      ],
    )
    const repo = new PlantsRepository(client)

    const templates = await repo.listCareTaskTemplates('plant-1')

    expect(templates.map((t) => t.name)).toEqual(['Prune', 'Fertilize'])
  })

  it('creates a date-range care task template', async () => {
    const { client, careTaskTemplateRows } = createFakePlantsDbClient()
    const repo = new PlantsRepository(client)

    const template = await repo.createCareTaskTemplate({
      plantId: 'plant-1',
      name: 'Prune',
      trigger: { type: 'date-range', start: { month: 4, day: 1 }, end: { month: 4, day: 15 } },
    })

    expect(template.name).toBe('Prune')
    expect(template.trigger).toEqual({
      type: 'date-range',
      start: { month: 4, day: 1 },
      end: { month: 4, day: 15 },
    })
    expect(careTaskTemplateRows()[0].plant_id).toBe('plant-1')
  })

  it('creates a seasonal-marker care task template', async () => {
    const { client } = createFakePlantsDbClient()
    const repo = new PlantsRepository(client)

    const template = await repo.createCareTaskTemplate({
      plantId: 'plant-1',
      name: 'Winterize',
      trigger: { type: 'seasonal-marker', text: 'After first hard frost' },
    })

    expect(template.trigger).toEqual({ type: 'seasonal-marker', text: 'After first hard frost' })
  })

  it('removes a care task template', async () => {
    const { client, careTaskTemplateRows } = createFakePlantsDbClient(
      [],
      [careTaskTemplateRow({ id: 't1' })],
    )
    const repo = new PlantsRepository(client)

    await repo.removeCareTaskTemplate('t1')

    expect(careTaskTemplateRows()).toHaveLength(0)
  })
})
