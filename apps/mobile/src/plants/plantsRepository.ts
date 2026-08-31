import type { Plant, PlantRow } from '@plant-app/domain'
import { plantFromRow } from '@plant-app/domain'
import type { SupabaseClient } from '@supabase/supabase-js'

type DbResult<T> = { data: T; error: { message: string } | null }

/** The slice of a Postgrest filter builder the repository actually calls. */
interface PlantsQuery extends PromiseLike<DbResult<unknown>> {
  select(columns?: string): PlantsQuery
  order(column: string, options?: { ascending: boolean }): PlantsQuery
}

/** The narrow, read-only shape of a Supabase client the Registry needs — mirrors apps/web's PlantsDbClient pattern, trimmed to just what listing Plants requires. */
export interface PlantsDbClient {
  from(table: 'plants'): {
    select(columns?: string): PlantsQuery
  }
}

/** See apps/web's `asPlantsDbClient` for why this cast exists — the real client satisfies this interface at runtime, but its generic Postgrest builder types blow TypeScript's structural-check recursion budget. */
export function asPlantsDbClient(client: SupabaseClient): PlantsDbClient {
  return client as unknown as PlantsDbClient
}

const TABLE = 'plants'

function unwrap<T>({ data, error }: DbResult<unknown>): T {
  if (error) throw new Error(error.message)
  return data as T
}

export class PlantsRepository {
  private readonly client: PlantsDbClient

  constructor(client: PlantsDbClient) {
    this.client = client
  }

  async list(): Promise<Plant[]> {
    const result = unwrap<PlantRow[]>(
      await this.client.from(TABLE).select('*').order('common_name', { ascending: true }),
    )
    return result.map(plantFromRow)
  }
}
