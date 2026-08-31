import { createFakePropertiesDbClient } from '../test/fakePropertiesDbClient'
import { propertyRow } from '../test/propertyRowFixture'
import { PropertiesRepository } from './propertiesRepository'

describe('PropertiesRepository', () => {
  it("gets the account's one Property", async () => {
    const { client } = createFakePropertiesDbClient(propertyRow({ id: 'property-1' }))
    const repository = new PropertiesRepository(client)

    const property = await repository.get()

    expect(property?.id).toBe('property-1')
  })

  it('returns null when the account has no Property yet', async () => {
    const { client } = createFakePropertiesDbClient(null)
    const repository = new PropertiesRepository(client)

    expect(await repository.get()).toBeNull()
  })
})
