import type { PlantRow } from '@plant-app/domain'
import { vi } from 'vitest'
import type { PlantsDbClient } from '../plants/plantsRepository'

type Row = Record<string, unknown>
type Op = 'select' | 'insert' | 'update' | 'delete'
/** A stored row is a PlantRow plus whatever extra DB-only columns (e.g. user_id) the repository writes. */
type StoredRow = PlantRow & Record<string, unknown>

/**
 * An in-memory stand-in for the slice of Supabase's query builder
 * PlantsRepository calls. Each chain method just records intent onto the
 * same builder object (order-independent) and the real work happens once
 * it's awaited, mirroring Postgrest's thenable builder.
 */
export function createFakePlantsDbClient(initialRows: PlantRow[] = []) {
  let rows: StoredRow[] = [...initialRows] as StoredRow[]
  let nextId = rows.length + 1
  const userId = 'user-1'

  function builder(op: Op, payload?: Row) {
    let filterId: string | undefined
    let single = false

    const chain = {
      select() {
        return chain
      },
      eq(column: string, value: string) {
        if (column === 'id') filterId = value
        return chain
      },
      order() {
        return chain
      },
      single() {
        single = true
        return chain
      },
      maybeSingle() {
        single = true
        return chain
      },
      then<T1 = unknown, T2 = never>(
        onfulfilled?:
          | ((value: { data: unknown; error: { message: string } | null }) => T1 | PromiseLike<T1>)
          | null,
        onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
      ) {
        return Promise.resolve(execute()).then(onfulfilled, onrejected)
      },
    }

    function execute() {
      if (op === 'select') {
        if (filterId !== undefined) {
          const row = rows.find((r) => r.id === filterId) ?? null
          return { data: row, error: null }
        }
        const sorted = [...rows].sort((a, b) => a.common_name.localeCompare(b.common_name))
        return { data: sorted, error: null }
      }
      if (op === 'insert') {
        const row: StoredRow = {
          ...(payload as unknown as Omit<PlantRow, 'id' | 'created_at' | 'updated_at'>),
          id: `plant-${nextId++}`,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        }
        rows.push(row)
        return { data: single ? row : [row], error: null }
      }
      if (op === 'update') {
        const idx = rows.findIndex((r) => r.id === filterId)
        if (idx === -1) return { data: null, error: { message: 'Plant not found.' } }
        rows[idx] = {
          ...rows[idx],
          ...(payload as unknown as Partial<PlantRow>),
          updated_at: '2026-01-02T00:00:00.000Z',
        }
        return { data: single ? rows[idx] : [rows[idx]], error: null }
      }
      // delete
      rows = rows.filter((r) => r.id !== filterId)
      return { data: null, error: null }
    }

    return chain
  }

  const storage = {
    upload: vi.fn().mockResolvedValue({ data: { path: 'fake/path.jpg' }, error: null }),
    remove: vi.fn().mockResolvedValue({ error: null }),
    createSignedUrl: vi
      .fn()
      .mockResolvedValue({ data: { signedUrl: 'https://example.com/signed.jpg' }, error: null }),
  }

  const client: PlantsDbClient = {
    from() {
      return {
        select: () => builder('select'),
        insert: (values: Row) => builder('insert', values),
        update: (values: Row) => builder('update', values),
        delete: () => builder('delete'),
      }
    },
    storage: {
      from: () => storage,
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
    },
  }

  return { client, storage, userId, rows: () => rows }
}
