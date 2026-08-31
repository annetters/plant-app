import type { Bed, BedRow } from '@plant-app/domain'
import { bedFromRow } from '@plant-app/domain'
import type { SupabaseClient } from '@supabase/supabase-js'

type DbResult<T> = { data: T; error: { message: string } | null }

/** The slice of a Postgrest filter builder the repository actually calls. */
interface BedsQuery extends PromiseLike<DbResult<unknown>> {
  select(columns?: string): BedsQuery
  eq(column: string, value: string): BedsQuery
  order(column: string, options?: { ascending: boolean }): BedsQuery
}

/** The narrow, read-only shape of a Supabase client the Registry needs — mirrors apps/web's BedsDbClient pattern, trimmed to just what listing Beds requires. */
export interface BedsDbClient {
  from(table: 'beds'): {
    select(columns?: string): BedsQuery
  }
}

/** See apps/web's `asPlantsDbClient` for why this cast exists. */
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
}
