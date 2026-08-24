import type { PlantingPhotoRow, PlantingRow } from '@plant-app/domain'
import { vi } from 'vitest'
import type { PlantingsDbClient } from '../plantings/plantingsRepository'

type Row = Record<string, unknown>
type Op = 'select' | 'insert' | 'delete'
type StoredRow = Row & { id: string }
type Table = 'plantings' | 'planting_photos'

const ID_PREFIX: Record<Table, string> = {
  plantings: 'planting',
  planting_photos: 'photo',
}

/**
 * An in-memory stand-in for the slice of Supabase's client
 * PlantingsRepository calls, spanning both tables it reads from. Mirrors
 * fakePlantsDbClient's shape, plus `.in()` for the map view's
 * multi-Bed lookup.
 */
export function createFakePlantingsDbClient(
  initialPlantingRows: PlantingRow[] = [],
  initialPhotoRows: PlantingPhotoRow[] = [],
) {
  const tables: Record<Table, StoredRow[]> = {
    plantings: [...initialPlantingRows] as unknown as StoredRow[],
    planting_photos: [...initialPhotoRows] as unknown as StoredRow[],
  }
  const nextId: Record<Table, number> = {
    plantings: tables.plantings.length + 1,
    planting_photos: tables.planting_photos.length + 1,
  }
  const userId = 'user-1'

  function builder(table: Table, op: Op, payload?: Row) {
    const eqFilters: Record<string, string> = {}
    let inFilter: { column: string; values: string[] } | null = null
    let orderColumn: string | undefined
    let orderAscending = true
    let single = false

    const chain = {
      select() {
        return chain
      },
      eq(column: string, value: string) {
        eqFilters[column] = value
        return chain
      },
      in(column: string, values: string[]) {
        inFilter = { column, values }
        return chain
      },
      order(column: string, options?: { ascending: boolean }) {
        orderColumn = column
        orderAscending = options?.ascending ?? true
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

    function matches(row: StoredRow): boolean {
      if (!Object.entries(eqFilters).every(([column, value]) => row[column] === value)) {
        return false
      }
      if (inFilter && !inFilter.values.includes(row[inFilter.column] as string)) {
        return false
      }
      return true
    }

    function execute() {
      const rows = tables[table]

      if (op === 'select') {
        if (eqFilters.id !== undefined && single) {
          const row = rows.find(matches) ?? null
          return { data: row, error: null }
        }
        const filtered = rows.filter(matches)
        const sorted = orderColumn
          ? [...filtered].sort((a, b) => {
              const av = String(a[orderColumn as string])
              const bv = String(b[orderColumn as string])
              const cmp = av < bv ? -1 : av > bv ? 1 : 0
              return orderAscending ? cmp : -cmp
            })
          : filtered
        return { data: sorted, error: null }
      }
      if (op === 'insert') {
        const row: StoredRow = {
          ...payload,
          id: `${ID_PREFIX[table]}-${nextId[table]++}`,
          created_at: '2026-01-01T00:00:00.000Z',
        }
        rows.push(row)
        return { data: single ? row : [row], error: null }
      }
      // delete
      tables[table] = rows.filter((r) => !matches(r))
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

  const client: PlantingsDbClient = {
    from(table: Table) {
      return {
        select: () => builder(table, 'select'),
        insert: (values: Row) => builder(table, 'insert', values),
        delete: () => builder(table, 'delete'),
      }
    },
    storage: {
      from: () => storage,
    },
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
    },
  }

  return {
    client,
    storage,
    userId,
    plantingRows: () => tables.plantings as unknown as (PlantingRow & Record<string, unknown>)[],
    photoRows: () =>
      tables.planting_photos as unknown as (PlantingPhotoRow & Record<string, unknown>)[],
  }
}
