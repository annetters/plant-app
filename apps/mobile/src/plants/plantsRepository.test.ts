import { createFakePlantsDbClient } from '../test/fakePlantsDbClient'
import { plantRow } from '../test/plantRowFixture'
import { PlantsRepository } from './plantsRepository'

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
})
