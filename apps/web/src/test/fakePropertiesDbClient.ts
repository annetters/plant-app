import type { PropertyRow } from '@plant-app/domain'
import { vi } from 'vitest'
import type { PropertiesDbClient } from '../property/propertiesRepository'

type DbResult = { data: unknown; error: { message: string } | null }

/**
 * An in-memory stand-in for the slice of Supabase's client PropertiesRepository
 * calls — select/delete on the `properties` table, plus `functions.invoke`
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
        // Deliberately distinct from the typed address, mirroring a real
        // geocoder response — exercises the UI's side-by-side display.
        resolved_address: `${options.body.address} (resolved)`,
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

  function builder(op: 'select' | 'delete') {
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
      // delete
      if (row && matches()) row = null
      return { data: null, error: null }
    }

    return chain
  }

  const client: PropertiesDbClient = {
    from(_table: 'properties') {
      return {
        select: () => builder('select'),
        delete: () => builder('delete'),
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
