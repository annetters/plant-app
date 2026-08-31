import { plantingRow } from '../test/plantingRowFixture'
import { createFakePlantingsDbClient } from '../test/fakePlantingsDbClient'
import { PlantingsRepository } from './plantingsRepository'

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
})
