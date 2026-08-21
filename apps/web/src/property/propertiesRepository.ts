import type { Property, PropertyRow } from '@plant-app/domain'
import { propertyFromRow } from '@plant-app/domain'
import type { SupabaseClient } from '@supabase/supabase-js'

type DbResult<T> = { data: T; error: { message: string } | null }

/** The slice of a Postgrest filter builder the repository actually calls. */
interface PropertiesQuery extends PromiseLike<DbResult<unknown>> {
  select(columns?: string): PropertiesQuery
  eq(column: string, value: string): PropertiesQuery
  maybeSingle(): PropertiesQuery
}

/** The narrow shape of a Supabase client the repository needs — mirrors PlantsDbClient's pattern. */
export interface PropertiesDbClient {
  from(table: 'properties'): {
    select(columns?: string): PropertiesQuery
    delete(): PropertiesQuery
  }
  functions: {
    invoke(
      name: string,
      options: { body: unknown },
    ): Promise<{ data: unknown; error: { message: string } | null }>
  }
}

/**
 * See PlantsDbClient's `asPlantsDbClient` for why this cast exists: the real
 * client satisfies this interface at runtime, but its generic Postgrest
 * builder types blow TypeScript's structural-check recursion budget.
 */
export function asPropertiesDbClient(client: SupabaseClient): PropertiesDbClient {
  return client as unknown as PropertiesDbClient
}

const TABLE = 'properties'
const CREATE_FUNCTION = 'create-property'

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

  /**
   * Geocodes the address and fetches/probes aerial imagery server-side (the
   * `create-property` Edge Function — see ADR-0003: an external adapter call
   * runs server-side even when, as here, neither adapter needs a credential),
   * then persists the resulting Property row.
   *
   * The function always answers HTTP 200 and carries expected failures (no
   * geocoder match, one-Property-per-account already claimed) as a `{
   * error }` body instead of a non-2xx status — `supabase-js`'s
   * `functions.invoke` doesn't surface a non-2xx response's JSON body as a
   * usable message, only a generic transport-level one.
   */
  async create(address: string): Promise<Property> {
    const { data, error } = await this.client.functions.invoke(CREATE_FUNCTION, {
      body: { address },
    })
    if (error) throw new Error(error.message)
    const result = data as { error?: string } & Partial<PropertyRow>
    if (result?.error) throw new Error(result.error)
    return propertyFromRow(result as PropertyRow)
  }

  /** Frees the account's one-Property slot (MVP has no edit — delete and re-create instead). */
  async remove(id: string): Promise<void> {
    const { error } = await this.client.from(TABLE).delete().eq('id', id)
    if (error) throw new Error(error.message)
  }
}
