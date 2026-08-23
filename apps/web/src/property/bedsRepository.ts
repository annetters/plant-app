import type { Bed, BedInput, BedRow } from '@plant-app/domain'
import { bedFromRow, bedInputToRow } from '@plant-app/domain'
import type { SupabaseClient } from '@supabase/supabase-js'

type Row = Record<string, unknown>
type DbResult<T> = { data: T; error: { message: string } | null }

/** The slice of a Postgrest filter builder the repository actually calls. */
interface BedsQuery extends PromiseLike<DbResult<unknown>> {
  select(columns?: string): BedsQuery
  eq(column: string, value: string): BedsQuery
  order(column: string, options?: { ascending: boolean }): BedsQuery
  single(): BedsQuery
}

/** The narrow shape of a Supabase client the repository needs — mirrors PropertiesDbClient's pattern. */
export interface BedsDbClient {
  from(table: 'beds'): {
    select(columns?: string): BedsQuery
    insert(values: Row): BedsQuery
    delete(): BedsQuery
  }
}

/**
 * See PlantsDbClient's `asPlantsDbClient` for why this cast exists: the real
 * client satisfies this interface at runtime, but its generic Postgrest
 * builder types blow TypeScript's structural-check recursion budget.
 */
export function asBedsDbClient(client: SupabaseClient): BedsDbClient {
  return client as unknown as BedsDbClient
}

const TABLE = 'beds'

function unwrap<T>({ data, error }: DbResult<unknown>): T {
  if (error) throw new Error(error.message)
  return data as T
}

export class BedsRepository {
  private readonly client: BedsDbClient

  constructor(client: BedsDbClient) {
    this.client = client
  }

  async list(propertyId: string): Promise<Bed[]> {
    const result = unwrap<BedRow[]>(
      await this.client
        .from(TABLE)
        .select('*')
        .eq('property_id', propertyId)
        .order('created_at', { ascending: true }),
    )
    return result.map(bedFromRow)
  }

  async create(input: BedInput): Promise<Bed> {
    const row = unwrap<BedRow>(
      await this.client.from(TABLE).insert(bedInputToRow(input)).select().single(),
    )
    return bedFromRow(row)
  }

  async remove(id: string): Promise<void> {
    unwrap(await this.client.from(TABLE).delete().eq('id', id))
  }
}
