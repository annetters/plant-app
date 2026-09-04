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

  describe('base-map photo upload (#15)', () => {
    const photo = { uri: 'file:///tmp/plan.jpg', name: 'plan.jpg', mimeType: 'image/jpeg' }

    beforeEach(() => {
      globalThis.fetch = jest.fn().mockResolvedValue({
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      }) as unknown as typeof fetch
    })

    afterEach(() => {
      jest.restoreAllMocks()
    })

    it("uploads under the owner's folder so the bucket's RLS policy accepts it", async () => {
      const { client, storage, userId } = createFakePropertiesDbClient(null)
      const repository = new PropertiesRepository(client)

      const path = await repository.uploadBaseMapPhoto('property-1', photo)

      expect(path).toMatch(new RegExp(`^${userId}/property-1/.+-plan\\.jpg$`))
      const [uploadedPath, body, options] = storage.upload.mock.calls[0]
      expect(uploadedPath).toBe(path)
      expect(body).toBeInstanceOf(ArrayBuffer)
      expect(options).toEqual({ contentType: 'image/jpeg' })
    })

    it('throws when the upload is rejected', async () => {
      const { client, storage } = createFakePropertiesDbClient(null)
      storage.upload.mockResolvedValueOnce({ data: null, error: { message: 'denied' } })
      const repository = new PropertiesRepository(client)

      await expect(repository.uploadBaseMapPhoto('property-1', photo)).rejects.toThrow('denied')
    })
  })

  describe('createWithBaseMap (#15)', () => {
    const scaleReference = {
      pointA: { x: 10, y: 10 },
      pointB: { x: 110, y: 10 },
      realDistanceFeet: 25,
      mode: 'known-measurement' as const,
    }

    it('creates a Property from a photo with no address, keeping the id the photo was filed under', async () => {
      const fake = createFakePropertiesDbClient(null)
      const repository = new PropertiesRepository(fake.client)

      const property = await repository.createWithBaseMap({
        id: 'property-7',
        name: 'Back garden',
        baseMapSource: 'photo',
        baseMapPhotoPath: 'user-1/property-7/plan.jpg',
        scaleReference,
      })

      expect(property.id).toBe('property-7')
      expect(fake.row()).toMatchObject({
        id: 'property-7',
        user_id: 'user-1',
        name: 'Back garden',
        address: null,
        latitude: null,
        longitude: null,
        imagery_available: false,
        base_map_source: 'photo',
        base_map_photo_path: 'user-1/property-7/plan.jpg',
        scale_reference: scaleReference,
      })
    })

    it('reports the one-Property-per-account collision in the words a gardener can act on', async () => {
      const fake = createFakePropertiesDbClient(null)
      fake.failNextWrite({ message: 'duplicate key value', code: '23505' })
      const repository = new PropertiesRepository(fake.client)

      await expect(
        repository.createWithBaseMap({
          id: 'property-7',
          name: 'Back garden',
          baseMapSource: 'photo',
          baseMapPhotoPath: 'user-1/property-7/plan.jpg',
          scaleReference,
        }),
      ).rejects.toThrow('You already have a Property.')
    })
  })

  describe('updateBaseMap (#15)', () => {
    it('switches an aerial Property with no imagery onto a calibrated photo', async () => {
      const scaleReference = {
        pointA: { x: 0, y: 0 },
        pointB: { x: 200, y: 0 },
        realDistanceFeet: 40,
        mode: 'measured-object' as const,
      }
      const fake = createFakePropertiesDbClient(
        propertyRow({ id: 'property-1', base_map_source: 'aerial' }),
      )
      const repository = new PropertiesRepository(fake.client)

      const updated = await repository.updateBaseMap('property-1', {
        baseMapSource: 'photo',
        baseMapPhotoPath: 'user-1/property-1/plan.jpg',
        baseMapDrawing: null,
        scaleReference,
      })

      expect(updated.baseMapSource).toBe('photo')
      expect(fake.row()).toMatchObject({
        base_map_source: 'photo',
        base_map_photo_path: 'user-1/property-1/plan.jpg',
        base_map_drawing: null,
        scale_reference: scaleReference,
      })
    })

    it('throws when the update fails', async () => {
      const fake = createFakePropertiesDbClient(propertyRow({ id: 'property-1' }))
      fake.failNextWrite({ message: 'boom' })
      const repository = new PropertiesRepository(fake.client)

      await expect(
        repository.updateBaseMap('property-1', {
          baseMapSource: 'photo',
          baseMapPhotoPath: 'user-1/property-1/plan.jpg',
          baseMapDrawing: null,
          scaleReference: {
            pointA: { x: 0, y: 0 },
            pointB: { x: 200, y: 0 },
            realDistanceFeet: 40,
            mode: 'known-measurement',
          },
        }),
      ).rejects.toThrow('boom')
    })
  })
})
