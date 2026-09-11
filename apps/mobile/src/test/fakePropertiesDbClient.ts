import { NOTHING_DELETED_CODE, type PropertyRow } from '@plant-app/domain'
import type { PropertiesDbClient } from '../property/propertiesRepository'

type Row = Record<string, unknown>
type Op = 'select' | 'insert' | 'update' | 'delete'
type DbResult<T> = { data: T; error: { message: string } | null }

/**
 * An in-memory stand-in for the slice of Supabase's query builder
 * PropertiesRepository calls. Mirrors `fakePlantsDbClient`'s builder, with
 * one difference: an inserted row keeps the `id` it was given rather than
 * being assigned one, because `createWithBaseMap` picks the id up front so an
 * already-uploaded photo's storage path matches the row it ends up under.
 *
 * The account holds at most one Property (MVP), so this stores a single row
 * rather than a table.
 */
export function createFakePropertiesDbClient(initialRow: PropertyRow | null = null) {
  let row: Row | null = initialRow as Row | null
  const userId = 'user-1'
  /** Set to make the next write fail, e.g. Postgres' 23505 for the one-Property-per-account unique index. */
  let nextWriteError: { message: string; code?: string } | null = null

  function builder(op: Op, payload?: Row) {
    const filters: Record<string, string> = {}

    const chain = {
      select() {
        return chain
      },
      eq(column: string, value: string) {
        filters[column] = value
        return chain
      },
      single() {
        return chain
      },
      maybeSingle() {
        return chain
      },
      then<T1 = unknown, T2 = never>(
        onfulfilled?: ((value: DbResult<unknown>) => T1 | PromiseLike<T1>) | null,
        onrejected?: ((reason: unknown) => T2 | PromiseLike<T2>) | null,
      ) {
        return Promise.resolve(execute()).then(onfulfilled, onrejected)
      },
    }

    function matches(candidate: Row): boolean {
      return Object.entries(filters).every(([column, value]) => candidate[column] === value)
    }

    function execute(): DbResult<unknown> {
      if (op === 'select') {
        return { data: row, error: null }
      }

      if (nextWriteError) {
        const error = nextWriteError
        nextWriteError = null
        return { data: null, error }
      }

      if (op === 'insert') {
        row = { created_at: '2026-01-01T00:00:00.000Z', ...payload }
        return { data: row, error: null }
      }

      if (op === 'delete') {
        if (row && !matches(row)) {
          return { data: null, error: { message: 'Row not found.' } }
        }
        row = null
        return { data: null, error: null }
      }

      // update
      if (!row || !matches(row)) {
        return { data: null, error: { message: 'Row not found.' } }
      }
      row = { ...row, ...payload }
      return { data: row, error: null }
    }

    return chain
  }

  const storage = {
    upload: jest.fn().mockResolvedValue({ data: { path: 'fake/path.jpg' }, error: null }),
    createSignedUrl: jest
      .fn()
      .mockResolvedValue({ data: { signedUrl: 'https://example.com/signed.jpg' }, error: null }),
  }

  /**
   * Stands in for the `delete-map-object` Edge Function (#47), which a
   * Property delete now goes through so its planting photo *files* are cleared
   * server-side. The cascade itself is covered by
   * `supabase/functions/_shared/plantingPhotoCascade.test.ts`; what this
   * reproduces is the contract the repository depends on — the row goes, and
   * an expected failure arrives as a 200 with an `{ error }` body.
   */
  const invoke = jest.fn(async (name: string, options: { body: unknown }) => {
    if (name !== 'delete-map-object') return { data: null, error: null }
    // `failNextWrite` reaches the delete too, now that it runs through the
    // Edge Function rather than a table write — the function reports an
    // expected failure as a 200 with an `{ error }` body.
    if (nextWriteError) {
      const error = nextWriteError
      nextWriteError = null
      return { data: { error: error.message }, error: null }
    }
    const { id } = options.body as { kind: string; id: string }
    if (!row || (row as Row).id !== id) {
      return {
        data: {
          error: 'This Property could not be deleted — it may already be gone.',
          code: NOTHING_DELETED_CODE,
        },
        error: null,
      }
    }
    row = null
    return { data: { deleted: true }, error: null }
  })

  const client: PropertiesDbClient = {
    from: () => ({
      select: () => builder('select'),
      insert: (values: Row) => builder('insert', values),
      update: (values: Row) => builder('update', values),
      delete: () => builder('delete'),
    }),
    storage: {
      from: () => storage,
    },
    auth: {
      getUser: jest.fn().mockResolvedValue({ data: { user: { id: userId } }, error: null }),
    },
    functions: { invoke },
  }

  return {
    client,
    invoke,
    storage,
    userId,
    row: () => row as (PropertyRow & Row) | null,
    setRow: (next: PropertyRow | null) => {
      row = next as Row | null
    },
    failNextWrite: (error: { message: string; code?: string }) => {
      nextWriteError = error
    },
  }
}
