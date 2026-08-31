import type { PlantingRow } from '@plant-app/domain'
import type { PlantingsDbClient } from '../plantings/plantingsRepository'

type DbResult<T> = { data: T; error: { message: string } | null }

/** An in-memory stand-in for the read-only slice of Supabase's query builder PlantingsRepository calls. */
export function createFakePlantingsDbClient(initialRows: PlantingRow[] = []) {
  const rows = [...initialRows]

  function select(columns?: string) {
    let inColumn: string | undefined
    let inValues: string[] = []
    let orderColumn: string | undefined
    let orderAscending = true

    const chain = {
      select(_columns?: string) {
        return chain
      },
      in(column: string, values: string[]) {
        inColumn = column
        inValues = values
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
      const filtered = inColumn
        ? rows.filter((row) => inValues.includes(row[inColumn as keyof PlantingRow] as string))
        : rows
      const sorted = orderColumn
        ? [...filtered].sort((a, b) => {
            const comparison = String(a[orderColumn as keyof PlantingRow]).localeCompare(
              String(b[orderColumn as keyof PlantingRow]),
            )
            return orderAscending ? comparison : -comparison
          })
        : filtered
      return { data: sorted, error: null }
    }

    return chain.select(columns)
  }

  const client: PlantingsDbClient = {
    from: () => ({ select }),
  }

  return { client, rows: () => rows }
}
