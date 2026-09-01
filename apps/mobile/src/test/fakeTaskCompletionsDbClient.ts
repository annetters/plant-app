import type { TaskCompletionRow } from '@plant-app/domain'
import type { TaskCompletionsDbClient } from '../tasks/taskCompletionsRepository'

type Row = Record<string, unknown>
type StoredRow = Row & { id: string }

/**
 * An in-memory stand-in for the slice of Supabase's query builder
 * TaskCompletionsRepository calls — select plus upsert (keyed on the same
 * care_task_template_id/planting_id/year combination as the real unique
 * constraint) on the `task_completions` table. Mirrors apps/web's
 * `createFakeTaskCompletionsDbClient`.
 */
export function createFakeTaskCompletionsDbClient(initialRows: TaskCompletionRow[] = []) {
  const rows: StoredRow[] = [...initialRows] as unknown as StoredRow[]
  let nextId = rows.length + 1

  function builder(op: 'select' | 'upsert', payload?: Row) {
    const filters: Record<string, unknown> = {}
    let single = false

    const chain = {
      select() {
        return chain
      },
      eq(column: string, value: string) {
        filters[column] = value
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
        return { data: rows.filter(matches), error: null }
      }
      // upsert, matching task_completions_unique_template_planting_year
      const idx = rows.findIndex(
        (row) =>
          row.care_task_template_id === payload!.care_task_template_id &&
          row.planting_id === payload!.planting_id &&
          row.year === payload!.year,
      )
      if (idx === -1) {
        const row: StoredRow = {
          ...payload,
          id: `completion-${nextId++}`,
          created_at: '2026-01-01T00:00:00.000Z',
        }
        rows.push(row)
        return { data: single ? row : [row], error: null }
      }
      rows[idx] = { ...rows[idx], ...payload }
      return { data: single ? rows[idx] : [rows[idx]], error: null }
    }

    return chain
  }

  const client: TaskCompletionsDbClient = {
    from() {
      return {
        select: () => builder('select'),
        upsert: (values: Row) => builder('upsert', values),
      }
    },
  }

  return {
    client,
    rows: () => rows as unknown as (TaskCompletionRow & Record<string, unknown>)[],
  }
}
