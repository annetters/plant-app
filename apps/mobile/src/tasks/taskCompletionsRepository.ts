import type { TaskCompletion, TaskCompletionInput, TaskCompletionRow } from '@plant-app/domain'
import { taskCompletionFromRow, taskCompletionInputToRow } from '@plant-app/domain'
import type { SupabaseClient } from '@supabase/supabase-js'

type Row = Record<string, unknown>
type DbResult<T> = { data: T; error: { message: string } | null }

/** The slice of a Postgrest filter builder the repository actually calls. */
interface TaskCompletionsQuery extends PromiseLike<DbResult<unknown>> {
  select(columns?: string): TaskCompletionsQuery
  eq(column: string, value: string): TaskCompletionsQuery
  single(): TaskCompletionsQuery
}

/** The narrow shape of a Supabase client the repository needs — mirrors apps/web's TaskCompletionsDbClient pattern. */
export interface TaskCompletionsDbClient {
  from(table: 'task_completions'): {
    select(columns?: string): TaskCompletionsQuery
    upsert(values: Row, options: { onConflict: string }): TaskCompletionsQuery
  }
}

/** See this app's `asPlantsDbClient` for why this cast exists. */
export function asTaskCompletionsDbClient(client: SupabaseClient): TaskCompletionsDbClient {
  return client as unknown as TaskCompletionsDbClient
}

const TABLE = 'task_completions'

/** Matches task_completions_unique_template_planting_year (0019_task_completions.sql) — the upsert below relies on this exact column combination. */
const UNIQUE_COLUMNS = 'care_task_template_id,planting_id,year'

function unwrap<T>({ data, error }: DbResult<unknown>): T {
  if (error) throw new Error(error.message)
  return data as T
}

export class TaskCompletionsRepository {
  private readonly client: TaskCompletionsDbClient

  constructor(client: TaskCompletionsDbClient) {
    this.client = client
  }

  async listByPlanting(plantingId: string): Promise<TaskCompletion[]> {
    const result = unwrap<TaskCompletionRow[]>(
      await this.client.from(TABLE).select('*').eq('planting_id', plantingId),
    )
    return result.map(taskCompletionFromRow)
  }

  /**
   * Marks a Care task template done/missed for a Planting and year. A single
   * upsert against task_completions' own unique constraint on
   * (care_task_template_id, planting_id, year) — re-marking a task updates
   * the existing row atomically, rather than a separate select-then-insert-
   * or-update, which would race under rapid double-taps.
   */
  async record(input: TaskCompletionInput): Promise<TaskCompletion> {
    const row = unwrap<TaskCompletionRow>(
      await this.client
        .from(TABLE)
        .upsert(taskCompletionInputToRow(input), { onConflict: UNIQUE_COLUMNS })
        .select()
        .single(),
    )
    return taskCompletionFromRow(row)
  }
}
