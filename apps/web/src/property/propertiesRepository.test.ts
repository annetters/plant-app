import type { PropertyRow } from '@plant-app/domain'
import { describe, expect, it } from 'vitest'
import { createFakePropertiesDbClient } from '../test/fakePropertiesDbClient'
import { PropertiesRepository } from './propertiesRepository'

const EXISTING_ROW: PropertyRow = {
  id: 'property-1',
  address: '10 Main St, Cambridge, MA',
  latitude: 42.3782,
  longitude: -71.1266,
  imagery_zoom: 20,
  imagery_available: true,
  created_at: '2026-01-01T00:00:00.000Z',
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
      latitude: 42.3782,
      longitude: -71.1266,
      imageryZoom: 20,
      imageryAvailable: true,
    })
  })
})

describe('PropertiesRepository.create', () => {
  it('invokes the create-property edge function and maps the returned row', async () => {
    const { client, invoke } = createFakePropertiesDbClient(null)
    const repository = new PropertiesRepository(client)

    const property = await repository.create('10 Main St, Cambridge, MA')

    expect(invoke).toHaveBeenCalledWith('create-property', {
      body: { address: '10 Main St, Cambridge, MA' },
    })
    expect(property.address).toBe('10 Main St, Cambridge, MA')
    expect(property.imageryAvailable).toBe(true)
  })

  it('surfaces the edge function error (e.g. one Property per account already exists)', async () => {
    const { client } = createFakePropertiesDbClient(EXISTING_ROW)
    const repository = new PropertiesRepository(client)

    await expect(repository.create('20 Elm St')).rejects.toThrow(
      'You already have a Property.',
    )
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
