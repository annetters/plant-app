import type { Bed, BedInput, BedRow } from '@plant-app/domain'
import { bedFromRow, bedInputToRow, deleteMapObject } from '@plant-app/domain'
import type { MapObjectDeleteClient } from '@plant-app/domain'
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

/**
 * The narrow shape of a Supabase client the repository needs — mirrors
 * PropertiesDbClient's pattern. It extends `MapObjectDeleteClient` because a
 * Bed delete runs server-side, so this needs the function invoker as well as
 * the table (#47).
 */
export interface BedsDbClient extends MapObjectDeleteClient {
  from(table: 'beds'): {
    select(columns?: string): BedsQuery
    insert(values: Row): BedsQuery
    update(values: Row): BedsQuery
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

  /**
   * Renames a Bed. Deliberately narrow rather than a general `update`: the
   * name is the only part of a Bed that can be edited in place. An outline
   * can't be adjusted after the fact — changing it means drawing a new Bed —
   * so a wider update method would imply an affordance that doesn't exist.
   *
   * Callers must validate first (`validateBedInput` with `editingBedId`) so a
   * collision is reported in the gardener's own words. The database's
   * `beds_unique_name_per_property` index is the backstop, and surfaces as a
   * raw 23505 if it ever gets here first.
   */
  async rename(id: string, name: string): Promise<Bed> {
    const row = unwrap<BedRow>(
      await this.client.from(TABLE).update({ name }).eq('id', id).select().single(),
    )
    return bedFromRow(row)
  }

  /**
   * Removes a Bed, and the planting photo *files* belonging to the Plantings
   * inside it — which the FK cascade never reaches, because it only deletes
   * `planting_photos` rows and leaves the files orphaned in the bucket (#47).
   *
   * Runs through the `delete-map-object` Edge Function for the same two
   * reasons `PropertiesRepository.remove` does: emptying a bucket is an
   * external-adapter call (ADR-0003), and one shared path can't drift the way
   * a copy per surface does. It also reports a delete that matched no rows,
   * instead of returning as though it had worked.
   */
  async remove(id: string): Promise<void> {
    await deleteMapObject(this.client, 'bed', id)
  }
}
