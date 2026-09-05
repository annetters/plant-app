import type { PlantRow } from '@plant-app/domain'
import type { TagScanDbClient } from '../tagScan/tagScanRepository'

type Row = Record<string, unknown>
type Op = 'select' | 'insert' | 'update'
type StoredRow = Row & { id: string }
type Table = 'plants' | 'tag_photos'

const ID_PREFIX: Record<Table, string> = {
  plants: 'plant',
  tag_photos: 'tag-photo',
}

/**
 * An in-memory stand-in for the slice of Supabase's query builder
 * TagScanRepository calls — mirrors apps/web's `createFakePlantsDbClient`.
 * Each chain method records intent onto the same builder object
 * (order-independent) and the real work happens once it's awaited.
 */
export function createFakeTagScanDbClient(
  initialPlantRows: PlantRow[] = [],
  initialTagPhotoRows: Row[] = [],
) {
  const tables: Record<Table, StoredRow[]> = {
    plants: [...initialPlantRows] as unknown as StoredRow[],
    tag_photos: [...initialTagPhotoRows] as StoredRow[],
  }
  const nextId: Record<Table, number> = {
    plants: tables.plants.length + 1,
    tag_photos: tables.tag_photos.length + 1,
  }
  const userId = 'user-1'

  function builder(table: Table, op: Op, payload?: Row) {
    const filters: Record<string, string> = {}
    let orderColumn: string | undefined
    let orderAscending = true
    let selectedColumns: string | undefined
    let single = false

    const chain = {
      select(columns?: string) {
        selectedColumns = columns
        return chain
      },
      eq(column: string, value: string) {
        filters[column] = value
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
      return Object.entries(filters).every(([column, value]) => row[column] === value)
    }

    function project(row: StoredRow): StoredRow {
      if (!selectedColumns || selectedColumns === '*') return row
      const columns = selectedColumns.split(',').map((c) => c.trim())
      return Object.fromEntries(columns.map((c) => [c, row[c]])) as StoredRow
    }

    function execute() {
      const rows = tables[table]

      if (op === 'select') {
        const filtered = rows.filter(matches)
        const sorted = orderColumn
          ? [...filtered].sort((a, b) => {
              const comparison = String(a[orderColumn as string]).localeCompare(
                String(b[orderColumn as string]),
              )
              return orderAscending ? comparison : -comparison
            })
          : filtered
        if (single) {
          const row = sorted[0] ?? null
          return { data: row ? project(row) : null, error: null }
        }
        return { data: sorted.map(project), error: null }
      }
      if (op === 'insert') {
        const row: StoredRow = {
          ...payload,
          id: `${ID_PREFIX[table]}-${nextId[table]++}`,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        }
        rows.push(row)
        return { data: single ? project(row) : [project(row)], error: null }
      }
      // update
      const idx = rows.findIndex(matches)
      if (idx === -1) return { data: null, error: { message: 'Row not found.' } }
      rows[idx] = { ...rows[idx], ...payload }
      return { data: single ? project(rows[idx]) : [project(rows[idx])], error: null }
    }

    return chain
  }

  const storage = {
    upload: jest
      .fn()
      .mockResolvedValue({ data: { path: 'fake/path.jpg' }, error: null }),
  }

  const client: TagScanDbClient = {
    from(table: Table) {
      return {
        select: (columns?: string) => builder(table, 'select').select(columns),
        insert: (values: Row) => builder(table, 'insert', values),
        update: (values: Row) => builder(table, 'update', values),
      }
    },
    storage: {
      from: () => storage,
    },
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
    },
  }

  return {
    client,
    storage,
    userId,
    plantRows: () => tables.plants as unknown as (PlantRow & Record<string, unknown>)[],
    tagPhotoRows: () => tables.tag_photos,
  }
}
