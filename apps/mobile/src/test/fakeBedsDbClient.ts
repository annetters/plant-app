import type { BedRow } from '@plant-app/domain'
import type { BedsDbClient } from '../property/bedsRepository'

type DbResult<T> = { data: T; error: { message: string } | null }

/** An in-memory stand-in for the read-only slice of Supabase's query builder BedsRepository calls. */
export function createFakeBedsDbClient(initialRows: BedRow[] = []) {
  const rows = [...initialRows]

  function select(columns?: string) {
    const filters: Record<string, string> = {}
    let orderColumn: string | undefined
    let orderAscending = true

    const chain = {
      select(_columns?: string) {
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
      then<T1 = unknown, T2 = never>(
        onfulfilled?: ((value: DbResult<unknown>) => T1 | PromiseLike<T1>) | null,
        onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
      ) {
        return Promise.resolve(execute()).then(onfulfilled, onrejected)
      },
    }

    function execute(): DbResult<unknown> {
      const filtered = rows.filter((row) =>
        Object.entries(filters).every(([column, value]) => row[column as keyof BedRow] === value),
      )
      const sorted = orderColumn
        ? [...filtered].sort((a, b) => {
            const comparison = String(a[orderColumn as keyof BedRow]).localeCompare(
              String(b[orderColumn as keyof BedRow]),
            )
            return orderAscending ? comparison : -comparison
          })
        : filtered
      return { data: sorted, error: null }
    }

    return chain.select(columns)
  }

  const client: BedsDbClient = {
    from: () => ({ select }),
  }

  return { client, rows: () => rows }
}
