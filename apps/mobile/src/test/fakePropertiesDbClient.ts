import type { PropertyRow } from '@plant-app/domain'
import type { PropertiesDbClient } from '../property/propertiesRepository'

type DbResult<T> = { data: T; error: { message: string } | null }

/** An in-memory stand-in for the read-only slice of Supabase's query builder PropertiesRepository calls. */
export function createFakePropertiesDbClient(initialRow: PropertyRow | null = null) {
  let row = initialRow

  function select(columns?: string) {
    const chain = {
      select(_columns?: string) {
        return chain
      },
      maybeSingle() {
        return chain
      },
      then<T1 = unknown, T2 = never>(
        onfulfilled?: ((value: DbResult<unknown>) => T1 | PromiseLike<T1>) | null,
        onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
      ) {
        return Promise.resolve({ data: row, error: null }).then(onfulfilled, onrejected)
      },
    }
    return chain.select(columns)
  }

  const client: PropertiesDbClient = {
    from: () => ({ select }),
  }

  return {
    client,
    setRow: (next: PropertyRow | null) => {
      row = next
    },
  }
}
