import type { Property, PropertyRow } from '@plant-app/domain'
import { propertyFromRow } from '@plant-app/domain'
import type { SupabaseClient } from '@supabase/supabase-js'

type DbResult<T> = { data: T; error: { message: string } | null }

/** The slice of a Postgrest filter builder the repository actually calls. */
interface PropertiesQuery extends PromiseLike<DbResult<unknown>> {
  select(columns?: string): PropertiesQuery
  maybeSingle(): PropertiesQuery
}

/** The narrow, read-only shape of a Supabase client the Registry needs — mirrors apps/web's PropertiesDbClient pattern, trimmed to just what reading the account's one Property requires. */
export interface PropertiesDbClient {
  from(table: 'properties'): {
    select(columns?: string): PropertiesQuery
  }
}

/** See apps/web's `asPlantsDbClient` for why this cast exists. */
export function asPropertiesDbClient(client: SupabaseClient): PropertiesDbClient {
  return client as unknown as PropertiesDbClient
}

const TABLE = 'properties'

export class PropertiesRepository {
  private readonly client: PropertiesDbClient

  constructor(client: PropertiesDbClient) {
    this.client = client
  }

  /** The account's one Property (MVP: at most one), or `null` if none exists yet. */
  async get(): Promise<Property | null> {
    const { data, error } = await this.client.from(TABLE).select('*').maybeSingle()
    if (error) throw new Error(error.message)
    return data ? propertyFromRow(data as PropertyRow) : null
  }
}
