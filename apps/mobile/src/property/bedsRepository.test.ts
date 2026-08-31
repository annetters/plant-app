import { bedRow } from '../test/bedRowFixture'
import { createFakeBedsDbClient } from '../test/fakeBedsDbClient'
import { BedsRepository } from './bedsRepository'

describe('BedsRepository', () => {
  it('lists a Property\'s Beds, ordered by creation', async () => {
    const { client } = createFakeBedsDbClient([
      bedRow({ id: 'bed-2', property_id: 'property-1', name: 'Back border', created_at: '2026-02-01T00:00:00.000Z' }),
      bedRow({ id: 'bed-1', property_id: 'property-1', name: 'Front border', created_at: '2026-01-01T00:00:00.000Z' }),
      bedRow({ id: 'bed-3', property_id: 'property-2', name: 'Other property', created_at: '2026-01-01T00:00:00.000Z' }),
    ])
    const repository = new BedsRepository(client)

    const beds = await repository.list('property-1')

    expect(beds.map((b) => b.name)).toEqual(['Front border', 'Back border'])
  })
})
