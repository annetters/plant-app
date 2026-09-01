import type { OneOffTodo, OneOffTodoInput, OneOffTodoRow } from '@plant-app/domain'
import { oneOffTodoFromRow, oneOffTodoInputToRow } from '@plant-app/domain'
import type { SupabaseClient } from '@supabase/supabase-js'

type Row = Record<string, unknown>
type DbResult<T> = { data: T; error: { message: string } | null }

/** The slice of a Postgrest filter builder the repository actually calls. */
interface OneOffTodosQuery extends PromiseLike<DbResult<unknown>> {
  select(columns?: string): OneOffTodosQuery
  eq(column: string, value: string): OneOffTodosQuery
  order(column: string, options?: { ascending: boolean }): OneOffTodosQuery
  single(): OneOffTodosQuery
}

/** The narrow shape of a Supabase client the repository needs — mirrors apps/web's OneOffTodosDbClient pattern. */
export interface OneOffTodosDbClient {
  from(table: 'one_off_todos'): {
    select(columns?: string): OneOffTodosQuery
    insert(values: Row): OneOffTodosQuery
    update(values: Row): OneOffTodosQuery
    delete(): OneOffTodosQuery
  }
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null }
      error: { message: string } | null
    }>
  }
}

/** See this app's `asPlantsDbClient` for why this cast exists. */
export function asOneOffTodosDbClient(client: SupabaseClient): OneOffTodosDbClient {
  return client as unknown as OneOffTodosDbClient
}

const TABLE = 'one_off_todos'

function unwrap<T>({ data, error }: DbResult<unknown>): T {
  if (error) throw new Error(error.message)
  return data as T
}

async function requireUserId(client: OneOffTodosDbClient): Promise<string> {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('Not authenticated.')
  return data.user.id
}

export class OneOffTodosRepository {
  private readonly client: OneOffTodosDbClient

  constructor(client: OneOffTodosDbClient) {
    this.client = client
  }

  async list(): Promise<OneOffTodo[]> {
    const result = unwrap<OneOffTodoRow[]>(
      await this.client.from(TABLE).select('*').order('created_at', { ascending: true }),
    )
    return result.map(oneOffTodoFromRow)
  }

  async create(input: OneOffTodoInput): Promise<OneOffTodo> {
    const userId = await requireUserId(this.client)
    const row = unwrap<OneOffTodoRow>(
      await this.client
        .from(TABLE)
        .insert({ ...oneOffTodoInputToRow(input), user_id: userId, done: false })
        .select()
        .single(),
    )
    return oneOffTodoFromRow(row)
  }

  async setDone(id: string, done: boolean): Promise<OneOffTodo> {
    const row = unwrap<OneOffTodoRow>(
      await this.client.from(TABLE).update({ done }).eq('id', id).select().single(),
    )
    return oneOffTodoFromRow(row)
  }

  async remove(id: string): Promise<void> {
    unwrap(await this.client.from(TABLE).delete().eq('id', id))
  }
}
