import type { PlantRow } from '@plant-app/domain'
import type { PlantsDbClient } from '../plants/plantsRepository'

type DbResult<T> = { data: T; error: { message: string } | null }

/** An in-memory stand-in for the read-only slice of Supabase's query builder PlantsRepository calls. */
export function createFakePlantsDbClient(initialRows: PlantRow[] = []) {
  const rows = [...initialRows]

  function select(columns?: string) {
    let orderColumn: string | undefined
    let orderAscending = true

    const chain = {
      select(_columns?: string) {
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
      const sorted = orderColumn
        ? [...rows].sort((a, b) => {
            const comparison = String(a[orderColumn as keyof PlantRow]).localeCompare(
              String(b[orderColumn as keyof PlantRow]),
            )
            return orderAscending ? comparison : -comparison
          })
        : rows
      return { data: sorted, error: null }
    }

    return chain.select(columns)
  }

  const client: PlantsDbClient = {
    from: () => ({ select }),
  }

  return { client, rows: () => rows }
}
