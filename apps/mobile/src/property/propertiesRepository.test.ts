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

  it('signs a URL for a photographed base map, so the Map screen can show it', async () => {
    const { client, storage } = createFakePropertiesDbClient(
      propertyRow({ base_map_source: 'photo', base_map_photo_path: 'user-1/plan.jpg' }),
    )
    const repository = new PropertiesRepository(client)

    const url = await repository.getBaseMapPhotoUrl('user-1/plan.jpg')

    expect(url).toBe('https://example.com/signed.jpg')
    expect(storage.createSignedUrl).toHaveBeenCalledWith('user-1/plan.jpg', 3600)
  })

  it('throws when the base-map photo URL cannot be signed', async () => {
    const { client, storage } = createFakePropertiesDbClient(propertyRow())
    storage.createSignedUrl.mockResolvedValueOnce({ data: null, error: { message: 'boom' } })
    const repository = new PropertiesRepository(client)

    await expect(repository.getBaseMapPhotoUrl('user-1/plan.jpg')).rejects.toThrow('boom')
  })
})
