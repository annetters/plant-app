import type { OneOffTodoRow } from '@plant-app/domain'
import type { OneOffTodosDbClient } from '../tasks/oneOffTodosRepository'

type Row = Record<string, unknown>
type Op = 'select' | 'insert' | 'update' | 'delete'
type StoredRow = Row & { id: string }

/**
 * An in-memory stand-in for the slice of Supabase's query builder
 * OneOffTodosRepository calls. Mirrors apps/web's `createFakeOneOffTodosDbClient`.
 */
export function createFakeOneOffTodosDbClient(initialRows: OneOffTodoRow[] = []) {
  const rows: StoredRow[] = [...initialRows] as unknown as StoredRow[]
  let nextId = rows.length + 1
  const userId = 'user-1'

  function builder(op: Op, payload?: Row) {
    const filters: Record<string, string> = {}
    let orderColumn: string | undefined
    let orderAscending = true
    let single = false

    const chain = {
      select() {
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

    function execute() {
      if (op === 'select') {
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
          id: `todo-${nextId++}`,
          created_at: '2026-01-01T00:00:00.000Z',
        }
        rows.push(row)
        return { data: single ? row : [row], error: null }
      }
      if (op === 'update') {
        const idx = rows.findIndex(matches)
        if (idx === -1) return { data: null, error: { message: 'Row not found.' } }
        rows[idx] = { ...rows[idx], ...payload }
        return { data: single ? rows[idx] : [rows[idx]], error: null }
      }
      // delete
      const remaining = rows.filter((row) => !matches(row))
      rows.length = 0
      rows.push(...remaining)
      return { data: null, error: null }
    }

    return chain
  }

  const client: OneOffTodosDbClient = {
    from() {
      return {
        select: () => builder('select'),
        insert: (values: Row) => builder('insert', values),
        update: (values: Row) => builder('update', values),
        delete: () => builder('delete'),
      }
    },
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
    },
  }

  return {
    client,
    userId,
    rows: () => rows as unknown as (OneOffTodoRow & Record<string, unknown>)[],
  }
}
