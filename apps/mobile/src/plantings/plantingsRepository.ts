import type { Planting, PlantingRow } from '@plant-app/domain'
import { plantingFromRow } from '@plant-app/domain'
import type { SupabaseClient } from '@supabase/supabase-js'

type DbResult<T> = { data: T; error: { message: string } | null }

/** The slice of a Postgrest filter builder the repository actually calls. */
interface PlantingsQuery extends PromiseLike<DbResult<unknown>> {
  select(columns?: string): PlantingsQuery
  in(column: string, values: string[]): PlantingsQuery
  order(column: string, options?: { ascending: boolean }): PlantingsQuery
}

/** The narrow, read-only shape of a Supabase client the Registry needs — mirrors apps/web's PlantingsDbClient pattern, trimmed to just what listing Plantings by Bed requires. */
export interface PlantingsDbClient {
  from(table: 'plantings'): {
    select(columns?: string): PlantingsQuery
  }
}

/** See apps/web's `asPlantsDbClient` for why this cast exists. */
export function asPlantingsDbClient(client: SupabaseClient): PlantingsDbClient {
  return client as unknown as PlantingsDbClient
}

const TABLE = 'plantings'

function unwrap<T>({ data, error }: DbResult<unknown>): T {
  if (error) throw new Error(error.message)
  return data as T
}

export class PlantingsRepository {
  private readonly client: PlantingsDbClient

  constructor(client: PlantingsDbClient) {
    this.client = client
  }

  /** Every Planting across the given Beds — a Planting has no direct property_id column of its own. */
  async listByBeds(bedIds: string[]): Promise<Planting[]> {
    if (bedIds.length === 0) return []
    const result = unwrap<PlantingRow[]>(
      await this.client.from(TABLE).select('*').in('bed_id', bedIds).order('created_at', { ascending: true }),
    )
    return result.map(plantingFromRow)
  }
}
