import type { CareTaskTemplateRow, PlantRow } from '@plant-app/domain'
import type { PlantsDbClient } from '../plants/plantsRepository'

type Row = Record<string, unknown>
type Op = 'select' | 'insert' | 'update' | 'delete'
type StoredRow = Row & { id: string }
type Table = 'plants' | 'care_task_templates'

const ID_PREFIX: Record<Table, string> = {
  plants: 'plant',
  care_task_templates: 'template',
}

/**
 * An in-memory stand-in for the slice of Supabase's query builder
 * PlantsRepository calls, spanning both tables the repository reads from.
 * Mirrors apps/web's `createFakePlantsDbClient`.
 */
export function createFakePlantsDbClient(
  initialPlantRows: PlantRow[] = [],
  initialCareTaskTemplateRows: CareTaskTemplateRow[] = [],
) {
  const tables: Record<Table, StoredRow[]> = {
    plants: [...initialPlantRows] as unknown as StoredRow[],
    care_task_templates: [...initialCareTaskTemplateRows] as unknown as StoredRow[],
  }
  const nextId: Record<Table, number> = {
    plants: tables.plants.length + 1,
    care_task_templates: tables.care_task_templates.length + 1,
  }
  const userId = 'user-1'

  function builder(table: Table, op: Op, payload?: Row) {
    const filters: Record<string, string> = {}
    let orderColumn: string | undefined
    let single = false

    const chain = {
      select() {
        return chain
      },
      eq(column: string, value: string) {
        filters[column] = value
        return chain
      },
      order(column: string) {
        orderColumn = column
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
      return Object.entries(filters).every(([column, value]) => row[column] === value)
    }

    function execute() {
      const rows = tables[table]

      if (op === 'select') {
        if (filters.id !== undefined) {
          const row = rows.find(matches) ?? null
          return { data: row, error: null }
        }
        const filtered = rows.filter(matches)
        const sorted = orderColumn
          ? [...filtered].sort((a, b) =>
              String(a[orderColumn as string]).localeCompare(String(b[orderColumn as string])),
            )
          : filtered
        return { data: sorted, error: null }
      }
      if (op === 'insert') {
        const row: StoredRow = {
          ...payload,
          id: `${ID_PREFIX[table]}-${nextId[table]++}`,
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-01-01T00:00:00.000Z',
        }
        rows.push(row)
        return { data: single ? row : [row], error: null }
      }
      if (op === 'update') {
        const idx = rows.findIndex(matches)
        if (idx === -1) return { data: null, error: { message: 'Row not found.' } }
        rows[idx] = {
          ...rows[idx],
          ...payload,
          updated_at: '2026-01-02T00:00:00.000Z',
        }
        return { data: single ? rows[idx] : [rows[idx]], error: null }
      }
      // delete
      tables[table] = rows.filter((r) => !matches(r))
      return { data: null, error: null }
    }

    return chain
  }

  const storage = {
    upload: jest.fn().mockResolvedValue({ data: { path: 'fake/path.jpg' }, error: null }),
    remove: jest.fn().mockResolvedValue({ error: null }),
    createSignedUrl: jest
      .fn()
      .mockResolvedValue({ data: { signedUrl: 'https://example.com/signed.jpg' }, error: null }),
  }

  const client: PlantsDbClient = {
    from(table: Table) {
      return {
        select: () => builder(table, 'select'),
        insert: (values: Row) => builder(table, 'insert', values),
        update: (values: Row) => builder(table, 'update', values),
        delete: () => builder(table, 'delete'),
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
    rows: () => tables.plants as unknown as (PlantRow & Record<string, unknown>)[],
    careTaskTemplateRows: () =>
      tables.care_task_templates as unknown as (CareTaskTemplateRow & Record<string, unknown>)[],
  }
}
