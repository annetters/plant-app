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
