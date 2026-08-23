import type { BedRow } from '@plant-app/domain'
import type { BedsDbClient } from '../property/bedsRepository'

type DbResult = { data: unknown; error: { message: string } | null }

/**
 * An in-memory stand-in for the slice of Supabase's client BedsRepository
 * calls — select/insert/delete on the `beds` table. Mirrors
 * fakePropertiesDbClient's shape.
 */
export function createFakeBedsDbClient(initialRows: BedRow[] = []) {
  let rows = [...initialRows]
  let nextId = 1

  function builder(op: 'select' | 'insert' | 'delete', insertValues?: Record<string, unknown>) {
    const filters: Record<string, string> = {}
    let ordered: { column: string; ascending: boolean } | null = null

    const chain = {
      select() {
        return chain
      },
      eq(column: string, value: string) {
        filters[column] = value
        return chain
      },
      order(column: string, options?: { ascending: boolean }) {
        ordered = { column, ascending: options?.ascending ?? true }
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

    function matching(): BedRow[] {
      return rows.filter((row) =>
        Object.entries(filters).every(
          ([column, value]) => (row as unknown as Record<string, string>)[column] === value,
        ),
      )
    }

    function execute(): DbResult {
      if (op === 'insert') {
        const created: BedRow = {
          id: `bed-${nextId++}`,
          created_at: '2026-01-01T00:00:00.000Z',
          ...(insertValues as Omit<BedRow, 'id' | 'created_at'>),
        }
        rows.push(created)
        return { data: created, error: null }
      }
      if (op === 'delete') {
        rows = rows.filter(
          (row) =>
            !Object.entries(filters).every(
              ([column, value]) => (row as unknown as Record<string, string>)[column] === value,
            ),
        )
        return { data: null, error: null }
      }
      // select
      let result = matching()
      if (ordered) {
        const { column, ascending } = ordered
        result = [...result].sort((a, b) => {
          const av = (a as unknown as Record<string, string>)[column]
          const bv = (b as unknown as Record<string, string>)[column]
          return ascending ? (av < bv ? -1 : av > bv ? 1 : 0) : av < bv ? 1 : av > bv ? -1 : 0
        })
      }
      return { data: result, error: null }
    }

    return chain
  }

  const client: BedsDbClient = {
    from(_table: 'beds') {
      return {
        select: () => builder('select'),
        insert: (values: Record<string, unknown>) => builder('insert', values),
        delete: () => builder('delete'),
      }
    },
  }

  return {
    client,
    getRows: () => rows,
  }
}
