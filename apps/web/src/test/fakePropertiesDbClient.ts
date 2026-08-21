import type { PropertyRow } from '@plant-app/domain'
import { vi } from 'vitest'
import type { PropertiesDbClient } from '../property/propertiesRepository'

/**
 * An in-memory stand-in for the slice of Supabase's client PropertiesRepository
 * calls — a plain select on the `properties` table, plus `functions.invoke`
 * for the `create-property` edge function. Mirrors fakePlantsDbClient's shape.
 */
export function createFakePropertiesDbClient(initialRow: PropertyRow | null = null) {
  let row: PropertyRow | null = initialRow
  let nextId = 1

  const invoke = vi.fn(
    async (
      _name: string,
      options: { body: { address: string } },
    ): Promise<{ data: unknown; error: { message: string } | null }> => {
      if (row) {
        return { data: { error: 'You already have a Property.' }, error: null }
      }
      const created: PropertyRow = {
        id: `property-${nextId++}`,
        address: options.body.address,
        latitude: 42.3782,
        longitude: -71.1266,
        imagery_zoom: 20,
        imagery_available: true,
        created_at: '2026-01-01T00:00:00.000Z',
      }
      row = created
      return { data: created, error: null }
    },
  )

  const client: PropertiesDbClient = {
    from(_table: 'properties') {
      return {
        select() {
          const chain = {
            select() {
              return chain
            },
            maybeSingle() {
              return chain
            },
            then<T1 = unknown, T2 = never>(
              onfulfilled?:
                | ((value: {
                    data: unknown
                    error: { message: string } | null
                  }) => T1 | PromiseLike<T1>)
                | null,
              onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
            ) {
              return Promise.resolve({ data: row, error: null }).then(onfulfilled, onrejected)
            },
          }
          return chain
        },
      }
    },
    functions: { invoke },
  }

  return {
    client,
    invoke,
    setRow: (next: PropertyRow | null) => {
      row = next
    },
  }
}
