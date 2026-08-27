import type { AddressCandidate, Property, PropertyInput, PropertyRow } from '@plant-app/domain'
import { propertyFromRow } from '@plant-app/domain'
import type { SupabaseClient } from '@supabase/supabase-js'

type Row = Record<string, unknown>
type DbResult<T> = { data: T; error: { message: string } | null }

/** The slice of a Postgrest filter builder the repository actually calls. */
interface PropertiesQuery extends PromiseLike<DbResult<unknown>> {
  select(columns?: string): PropertiesQuery
  eq(column: string, value: string): PropertiesQuery
  maybeSingle(): PropertiesQuery
  single(): PropertiesQuery
}

/** The narrow shape of a Supabase client the repository needs — mirrors PlantsDbClient's pattern. */
export interface PropertiesDbClient {
  from(table: 'properties'): {
    select(columns?: string): PropertiesQuery
    update(values: Row): PropertiesQuery
    delete(): PropertiesQuery
  }
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        file: File,
      ): Promise<{ data: { path: string } | null; error: { message: string } | null }>
      createSignedUrl(
        path: string,
        expiresIn: number,
      ): Promise<{ data: { signedUrl: string } | null; error: { message: string } | null }>
    }
  }
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null }
      error: { message: string } | null
    }>
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
const SEARCH_FUNCTION = 'search-addresses'
const BASE_MAP_PHOTOS_BUCKET = 'property-base-map-photos'

/** Ticket #6's fallback-base-map fields on `PropertyInput` — the payload `updateBaseMap` writes once aerial imagery turns out unavailable. */
export type BaseMapUpdate = Pick<
  PropertyInput,
  'baseMapSource' | 'baseMapPhotoPath' | 'baseMapDrawing' | 'scaleReference'
>

async function requireUserId(client: PropertiesDbClient): Promise<string> {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('Not authenticated.')
  return data.user.id
}

/** Address the user typed in, plus the specific geocoder candidate they picked for it. */
export interface PropertyCreateInput {
  address: string
  candidate: AddressCandidate
}

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
   * Geocoding candidates for an in-progress address search (the
   * `search-addresses` Edge Function — see ADR-0003: an external adapter
   * call runs server-side even though Nominatim itself needs no
   * credential; browsers also can't set the User-Agent header its usage
   * policy requires). Below the function's own minimum query length, this
   * resolves to an empty list rather than erroring — that's a normal
   * "still typing" state, not a failure.
   */
  async search(query: string): Promise<AddressCandidate[]> {
    const { data, error } = await this.client.functions.invoke(SEARCH_FUNCTION, {
      body: { query },
    })
    if (error) throw new Error(error.message)
    const result = data as { error?: string; candidates?: AddressCandidate[] }
    if (result?.error) throw new Error(result.error)
    return result.candidates ?? []
  }

  /**
   * Persists the Property at a candidate the user already picked from
   * `search()` — never re-geocodes freeform text (see `search-addresses`:
   * requiring a specific pick, not stricter input validation, is what
   * keeps a bare street from resolving to an arbitrary global match).
   * Also probes aerial imagery availability server-side before inserting.
   *
   * The function always answers HTTP 200 and carries expected failures
   * (one-Property-per-account already claimed) as a `{ error }` body
   * instead of a non-2xx status — `supabase-js`'s `functions.invoke`
   * doesn't surface a non-2xx response's JSON body as a usable message,
   * only a generic transport-level one.
   */
  async create(input: PropertyCreateInput): Promise<Property> {
    const { data, error } = await this.client.functions.invoke(CREATE_FUNCTION, {
      body: {
        address: input.address,
        resolvedAddress: input.candidate.displayName,
        latitude: input.candidate.latitude,
        longitude: input.candidate.longitude,
      },
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

  /**
   * Switches a Property to a photographed-plan or in-app-drawn base map,
   * with the Scale Reference that calibrates it — the fallback path ticket
   * #6 adds for when aerial imagery isn't available (see CONTEXT.md's
   * Property/Scale Reference entries). No Edge Function needed: unlike
   * `create()`, this touches no external adapter.
   */
  async updateBaseMap(id: string, update: BaseMapUpdate): Promise<Property> {
    const { data, error } = await this.client
      .from(TABLE)
      .update({
        base_map_source: update.baseMapSource,
        base_map_photo_path: update.baseMapPhotoPath,
        base_map_drawing: update.baseMapDrawing,
        scale_reference: update.scaleReference,
      })
      .eq('id', id)
      .select()
      .single()
    if (error) throw new Error(error.message)
    return propertyFromRow(data as PropertyRow)
  }

  /** Uploads a photographed plot plan/survey and returns its storage path — caller persists the path via `updateBaseMap`. */
  async uploadBaseMapPhoto(propertyId: string, file: File): Promise<string> {
    const userId = await requireUserId(this.client)
    const path = `${userId}/${propertyId}/${crypto.randomUUID()}-${file.name}`
    const { error } = await this.client.storage.from(BASE_MAP_PHOTOS_BUCKET).upload(path, file)
    if (error) throw new Error(error.message)
    return path
  }

  async getBaseMapPhotoUrl(path: string): Promise<string> {
    const { data, error } = await this.client.storage
      .from(BASE_MAP_PHOTOS_BUCKET)
      .createSignedUrl(path, 3600)
    if (error || !data) throw new Error(error?.message ?? 'Could not sign photo URL.')
    return data.signedUrl
  }
}
