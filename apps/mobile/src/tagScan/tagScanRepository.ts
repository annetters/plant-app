import type { Plant, PlantInput, PlantRow, SpeciesNameSummary, UsdaCharacteristic } from '@plant-app/domain'
import { plantFromRow, plantInputToRow } from '@plant-app/domain'
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Crypto from 'expo-crypto'

type Row = Record<string, unknown>
type DbResult<T> = { data: T; error: { message: string } | null }

/** The slice of a Postgrest filter builder the repository actually calls. */
interface TagScanQuery extends PromiseLike<DbResult<unknown>> {
  select(columns?: string): TagScanQuery
  eq(column: string, value: string): TagScanQuery
  order(column: string, options?: { ascending: boolean }): TagScanQuery
  single(): TagScanQuery
}

/** The narrow shape of a Supabase client the repository needs — mirrors apps/web's PlantsDbClient pattern. */
export interface TagScanDbClient {
  from(table: 'plants' | 'tag_photos'): {
    select(columns?: string): TagScanQuery
    insert(values: Row): TagScanQuery
    update(values: Row): TagScanQuery
  }
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        data: ArrayBuffer,
        options?: { contentType?: string },
      ): Promise<{ data: { path: string } | null; error: { message: string } | null }>
    }
  }
  functions: {
    invoke(
      name: string,
      options: { body: unknown },
    ): Promise<{ data: unknown; error: { message: string } | null }>
  }
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null }
      error: { message: string } | null
    }>
  }
}

/** See apps/web's `asPlantsDbClient` for why this cast exists — the real client satisfies this interface at runtime, but its generic Postgrest builder types blow TypeScript's structural-check recursion budget. */
export function asTagScanDbClient(client: SupabaseClient): TagScanDbClient {
  return client as unknown as TagScanDbClient
}

const PLANTS_TABLE = 'plants'
const TAG_PHOTOS_TABLE = 'tag_photos'
const TAG_PHOTOS_BUCKET = 'tag-photos'
const USDA_FUNCTION = 'usda-plant-traits'

function unwrap<T>({ data, error }: DbResult<unknown>): T {
  if (error) throw new Error(error.message)
  return data as T
}

async function requireUserId(client: TagScanDbClient): Promise<string> {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('Not authenticated.')
  return data.user.id
}

export interface TagPhotoFile {
  uri: string
  name: string
  mimeType: string
}

export interface UploadedTagPhoto {
  id: string
  storagePath: string
}

export class TagScanRepository {
  private readonly client: TagScanDbClient

  constructor(client: TagScanDbClient) {
    this.client = client
  }

  async listPlants(): Promise<Plant[]> {
    const result = unwrap<PlantRow[]>(
      await this.client.from(PLANTS_TABLE).select('*').order('common_name', { ascending: true }),
    )
    return result.map(plantFromRow)
  }

  async createPlant(input: PlantInput): Promise<Plant> {
    const userId = await requireUserId(this.client)
    const row = unwrap<PlantRow>(
      await this.client
        .from(PLANTS_TABLE)
        .insert({ ...plantInputToRow(input), user_id: userId })
        .select()
        .single(),
    )
    return plantFromRow(row)
  }

  /**
   * Uploads a captured tag photo and records it under `tag_photos`, not
   * `plants` — a tag photo is its own category (see CONTEXT.md) and is
   * captured before a Plant necessarily exists. Call `linkTagPhotoToPlant`
   * once the scan resolves to a Plant.
   */
  async uploadTagPhoto(scanId: string, file: TagPhotoFile): Promise<UploadedTagPhoto> {
    const [userId, arrayBuffer] = await Promise.all([
      requireUserId(this.client),
      fetch(file.uri).then((res) => res.arrayBuffer()),
    ])
    const path = `${userId}/${scanId}/${Crypto.randomUUID()}-${file.name}`
    const { error: uploadError } = await this.client.storage
      .from(TAG_PHOTOS_BUCKET)
      .upload(path, arrayBuffer, { contentType: file.mimeType })
    if (uploadError) throw new Error(uploadError.message)

    const row = unwrap<{ id: string }>(
      await this.client
        .from(TAG_PHOTOS_TABLE)
        .insert({ user_id: userId, storage_path: path })
        .select('id')
        .single(),
    )
    return { id: row.id, storagePath: path }
  }

  async linkTagPhotoToPlant(tagPhotoId: string, plantId: string): Promise<void> {
    unwrap(await this.client.from(TAG_PHOTOS_TABLE).update({ plant_id: plantId }).eq('id', tagPhotoId))
  }

  /** A common name can span multiple species — see `resolveCommonName` in `@plant-app/domain`, which this feeds. */
  async lookupUsdaByCommonName(commonName: string): Promise<SpeciesNameSummary[]> {
    const { data, error } = await this.client.functions.invoke(USDA_FUNCTION, {
      body: { commonName },
    })
    if (error) throw new Error(error.message)
    const result = data as { error?: string; species?: SpeciesNameSummary[] }
    if (result?.error) throw new Error(result.error)
    return result.species ?? []
  }

  /** An empty `characteristics` array (no USDA match) is a routine, common outcome — see ADR-0004 — not an error. */
  async lookupUsdaByScientificName(
    scientificName: string,
  ): Promise<{ species: SpeciesNameSummary[]; characteristics: UsdaCharacteristic[] }> {
    const { data, error } = await this.client.functions.invoke(USDA_FUNCTION, {
      body: { scientificName },
    })
    if (error) throw new Error(error.message)
    const result = data as {
      error?: string
      species?: SpeciesNameSummary[]
      characteristics?: UsdaCharacteristic[]
    }
    if (result?.error) throw new Error(result.error)
    return { species: result.species ?? [], characteristics: result.characteristics ?? [] }
  }
}
