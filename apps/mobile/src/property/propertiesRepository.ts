import type { Property, PropertyRow } from '@plant-app/domain'
import { propertyFromRow } from '@plant-app/domain'
import type { SupabaseClient } from '@supabase/supabase-js'

type DbResult<T> = { data: T; error: { message: string } | null }

/** The slice of a Postgrest filter builder the repository actually calls. */
interface PropertiesQuery extends PromiseLike<DbResult<unknown>> {
  select(columns?: string): PropertiesQuery
  maybeSingle(): PropertiesQuery
}

/** The narrow, read-only shape of a Supabase client the Registry and Map screen need — mirrors apps/web's PropertiesDbClient pattern, trimmed to reading the account's one Property and signing its base-map photo. No upload here yet: base-map photo upload is due full phone parity (ADR-0003), it's just still unbuilt natively (#15). */
export interface PropertiesDbClient {
  from(table: 'properties'): {
    select(columns?: string): PropertiesQuery
  }
  storage: {
    from(bucket: string): {
      createSignedUrl(
        path: string,
        expiresIn: number,
      ): Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>
    }
  }
}

/** See apps/web's `asPlantsDbClient` for why this cast exists. */
export function asPropertiesDbClient(client: SupabaseClient): PropertiesDbClient {
  return client as unknown as PropertiesDbClient
}

const TABLE = 'properties'
const BASE_MAP_PHOTOS_BUCKET = 'property-base-map-photos'

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

  /** A signed URL for a `'photo'` Property's base map — the bucket is private, so the Map screen can't just point an `<Image>` at the stored path. Mirrors apps/web's identical method. */
  async getBaseMapPhotoUrl(path: string): Promise<string> {
    const { data, error } = await this.client.storage
      .from(BASE_MAP_PHOTOS_BUCKET)
      .createSignedUrl(path, 3600)
    if (error || !data) throw new Error(error?.message ?? 'Could not sign photo URL.')
    return data.signedUrl
  }
}
