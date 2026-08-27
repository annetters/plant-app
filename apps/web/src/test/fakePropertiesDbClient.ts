import type { PropertyRow } from '@plant-app/domain'
import { vi } from 'vitest'
import type { PropertiesDbClient } from '../property/propertiesRepository'

type DbResult = { data: unknown; error: { message: string } | null }
type CreatePropertyBody = {
  address: string
  resolvedAddress: string
  latitude: number
  longitude: number
}

/**
 * An in-memory stand-in for the slice of Supabase's client PropertiesRepository
 * calls — select/delete on the `properties` table, plus `functions.invoke`
 * for the `search-addresses` and `create-property` edge functions. Mirrors
 * fakePlantsDbClient's shape.
 */
export function createFakePropertiesDbClient(initialRow: PropertyRow | null = null) {
  let row: PropertyRow | null = initialRow
  let nextId = 1

  const invoke = vi.fn(async (name: string, options: { body: unknown }): Promise<DbResult> => {
    if (name === 'search-addresses') {
      const { query } = options.body as { query: string }
      // A magic substring, not a real geocoder behavior — lets tests exercise
      // the "no matches" state without a separate fake-client mode.
      if (query.includes('noresults')) {
        return { data: { candidates: [] }, error: null }
      }
      // Mirrors a real geocoder response: candidates distinct from the raw
      // query, exercising the picker UI's rendering.
      return {
        data: {
          candidates: [
            { displayName: `${query} (candidate 1)`, latitude: 42.3782, longitude: -71.1266 },
            { displayName: `${query} (candidate 2)`, latitude: 40.7128, longitude: -74.006 },
          ],
        },
        error: null,
      }
    }

    // create-property
    if (row) {
      return { data: { error: 'You already have a Property.' }, error: null }
    }
    const body = options.body as CreatePropertyBody
    const created: PropertyRow = {
      id: `property-${nextId++}`,
      address: body.address,
      resolved_address: body.resolvedAddress,
      latitude: body.latitude,
      longitude: body.longitude,
      imagery_zoom: 20,
      imagery_available: true,
      base_map_source: 'aerial',
      base_map_photo_path: null,
      base_map_drawing: null,
      scale_reference: null,
      created_at: '2026-01-01T00:00:00.000Z',
    }
    row = created
    return { data: created, error: null }
  })

  function builder(op: 'select' | 'update' | 'delete', payload?: Record<string, unknown>) {
    const filters: Record<string, string> = {}

    const chain = {
      select() {
        return chain
      },
      eq(column: string, value: string) {
        filters[column] = value
        return chain
      },
      maybeSingle() {
        return chain
      },
      single() {
        return chain
      },
      then<T1 = unknown, T2 = never>(
        onfulfilled?: ((value: DbResult) => T1 | PromiseLike<T1>) | null,
        onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
      ) {
        return Promise.resolve(execute()).then(onfulfilled, onrejected)
      },
    }

    function matches(): boolean {
      return Object.entries(filters).every(([column, value]) => {
        const rowValue = row ? (row as unknown as Record<string, string>)[column] : undefined
        return rowValue === value
      })
    }

    function execute(): DbResult {
      if (op === 'select') {
        return { data: row, error: null }
      }
      if (op === 'update') {
        if (!row || !matches()) return { data: null, error: { message: 'Property not found.' } }
        row = { ...row, ...payload } as PropertyRow
        return { data: row, error: null }
      }
      // delete
      if (row && matches()) row = null
      return { data: null, error: null }
    }

    return chain
  }

  const storage = {
    upload: vi.fn().mockResolvedValue({ data: { path: 'fake/base-map.jpg' }, error: null }),
    createSignedUrl: vi
      .fn()
      .mockResolvedValue({ data: { signedUrl: 'https://example.com/signed-base-map.jpg' }, error: null }),
  }
  const userId = 'user-1'

  const client: PropertiesDbClient = {
    from(_table: 'properties') {
      return {
        select: () => builder('select'),
        update: (values: Record<string, unknown>) => builder('update', values),
        delete: () => builder('delete'),
      }
    },
    storage: {
      from: () => storage,
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
    },
    functions: { invoke },
  }

  return {
    client,
    invoke,
    storage,
    setRow: (next: PropertyRow | null) => {
      row = next
    },
  }
}
