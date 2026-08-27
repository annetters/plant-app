import type { AddressCandidate, PropertyRow } from '@plant-app/domain'
import { describe, expect, it } from 'vitest'
import { createFakePropertiesDbClient } from '../test/fakePropertiesDbClient'
import { PropertiesRepository } from './propertiesRepository'

const EXISTING_ROW: PropertyRow = {
  id: 'property-1',
  address: '10 Main St, Cambridge, MA',
  resolved_address: '10 Main Street, Cambridge, Middlesex County, Massachusetts, 02142',
  latitude: 42.3782,
  longitude: -71.1266,
  imagery_zoom: 20,
  imagery_available: true,
  base_map_source: 'aerial',
  base_map_photo_path: null,
  base_map_drawing: null,
  scale_reference: null,
  created_at: '2026-01-01T00:00:00.000Z',
}

const CANDIDATE: AddressCandidate = {
  displayName: '10 Main Street, Cambridge, Middlesex County, Massachusetts, 02142',
  latitude: 42.3782,
  longitude: -71.1266,
}

describe('PropertiesRepository.get', () => {
  it('returns null when the account has no Property yet', async () => {
    const { client } = createFakePropertiesDbClient(null)
    const repository = new PropertiesRepository(client)
    expect(await repository.get()).toBeNull()
  })

  it('returns the account Property, mapped from its row', async () => {
    const { client } = createFakePropertiesDbClient(EXISTING_ROW)
    const repository = new PropertiesRepository(client)
    const property = await repository.get()
    expect(property).toEqual({
      id: 'property-1',
      createdAt: '2026-01-01T00:00:00.000Z',
      address: '10 Main St, Cambridge, MA',
      resolvedAddress: '10 Main Street, Cambridge, Middlesex County, Massachusetts, 02142',
      latitude: 42.3782,
      longitude: -71.1266,
      imageryZoom: 20,
      imageryAvailable: true,
      baseMapSource: 'aerial',
      baseMapPhotoPath: null,
      baseMapDrawing: null,
      scaleReference: null,
    })
  })
})

describe('PropertiesRepository.search', () => {
  it('invokes search-addresses and returns its candidates', async () => {
    const { client, invoke } = createFakePropertiesDbClient(null)
    const repository = new PropertiesRepository(client)

    const candidates = await repository.search('10 main st')

    expect(invoke).toHaveBeenCalledWith('search-addresses', { body: { query: '10 main st' } })
    expect(candidates.length).toBeGreaterThan(0)
    expect(candidates[0]).toHaveProperty('displayName')
  })

  it('surfaces an edge function error', async () => {
    const { client, invoke } = createFakePropertiesDbClient(null)
    invoke.mockResolvedValueOnce({
      data: { error: 'Could not reach the geocoding service. Try again.' },
      error: null,
    })
    const repository = new PropertiesRepository(client)

    await expect(repository.search('10 main st')).rejects.toThrow(
      'Could not reach the geocoding service. Try again.',
    )
  })
})

describe('PropertiesRepository.create', () => {
  it('invokes create-property with the picked candidate, not raw text, and maps the returned row', async () => {
    const { client, invoke } = createFakePropertiesDbClient(null)
    const repository = new PropertiesRepository(client)

    const property = await repository.create({ address: '10 main st', candidate: CANDIDATE })

    expect(invoke).toHaveBeenCalledWith('create-property', {
      body: {
        address: '10 main st',
        resolvedAddress: CANDIDATE.displayName,
        latitude: CANDIDATE.latitude,
        longitude: CANDIDATE.longitude,
      },
    })
    expect(property.address).toBe('10 main st')
    expect(property.resolvedAddress).toBe(CANDIDATE.displayName)
    expect(property.imageryAvailable).toBe(true)
  })

  it('surfaces the edge function error (e.g. one Property per account already exists)', async () => {
    const { client } = createFakePropertiesDbClient(EXISTING_ROW)
    const repository = new PropertiesRepository(client)

    await expect(
      repository.create({ address: '20 Elm St', candidate: CANDIDATE }),
    ).rejects.toThrow('You already have a Property.')
  })
})

describe('PropertiesRepository.remove', () => {
  it('deletes the Property, freeing the account up to create another', async () => {
    const { client } = createFakePropertiesDbClient(EXISTING_ROW)
    const repository = new PropertiesRepository(client)

    await repository.remove('property-1')

    expect(await repository.get()).toBeNull()
  })
})

describe('PropertiesRepository.updateBaseMap', () => {
  it('switches a Property to a photo base map with its Scale Reference', async () => {
    const { client } = createFakePropertiesDbClient({
      ...EXISTING_ROW,
      imagery_zoom: null,
      imagery_available: false,
    })
    const repository = new PropertiesRepository(client)

    const property = await repository.updateBaseMap('property-1', {
      baseMapSource: 'photo',
      baseMapPhotoPath: 'user-1/property-1/plan.jpg',
      baseMapDrawing: null,
      scaleReference: {
        pointA: { x: 0, y: 0 },
        pointB: { x: 300, y: 0 },
        realDistanceFeet: 25,
        mode: 'known-measurement',
      },
    })

    expect(property.baseMapSource).toBe('photo')
    expect(property.baseMapPhotoPath).toBe('user-1/property-1/plan.jpg')
    expect(property.scaleReference).toEqual({
      pointA: { x: 0, y: 0 },
      pointB: { x: 300, y: 0 },
      realDistanceFeet: 25,
      mode: 'known-measurement',
    })
  })

  it('switches a Property to a drawn base map', async () => {
    const { client } = createFakePropertiesDbClient({
      ...EXISTING_ROW,
      imagery_zoom: null,
      imagery_available: false,
    })
    const repository = new PropertiesRepository(client)

    const property = await repository.updateBaseMap('property-1', {
      baseMapSource: 'drawn',
      baseMapPhotoPath: null,
      baseMapDrawing: [[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]],
      scaleReference: {
        pointA: { x: 0, y: 0 },
        pointB: { x: 100, y: 0 },
        realDistanceFeet: 10,
        mode: 'measured-object',
      },
    })

    expect(property.baseMapSource).toBe('drawn')
    expect(property.baseMapDrawing).toEqual([[{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }]])
  })
})

describe('PropertiesRepository.uploadBaseMapPhoto / getBaseMapPhotoUrl', () => {
  it('uploads a photo under the account/property path and returns the storage path', async () => {
    const { client, storage } = createFakePropertiesDbClient(EXISTING_ROW)
    const repository = new PropertiesRepository(client)
    const file = new File(['fake'], 'plan.jpg', { type: 'image/jpeg' })

    const path = await repository.uploadBaseMapPhoto('property-1', file)

    expect(storage.upload).toHaveBeenCalledWith(expect.stringMatching(/^user-1\/property-1\//), file)
    expect(path).toMatch(/^user-1\/property-1\/.+-plan\.jpg$/)
  })

  it('signs a URL for an uploaded photo', async () => {
    const { client } = createFakePropertiesDbClient(EXISTING_ROW)
    const repository = new PropertiesRepository(client)

    const url = await repository.getBaseMapPhotoUrl('user-1/property-1/plan.jpg')

    expect(url).toBe('https://example.com/signed-base-map.jpg')
  })
})
