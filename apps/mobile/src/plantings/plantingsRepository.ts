import type {
  Planting,
  PlantingPhoto,
  PlantingPhotoRow,
  PlantingRow,
} from '@plant-app/domain'
import {
  plantingFromRow,
  plantingPhotoFromRow,
  plantingPhotoInputToRow,
} from '@plant-app/domain'
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Crypto from 'expo-crypto'

type Row = Record<string, unknown>
type DbResult<T> = { data: T; error: { message: string } | null }

/** The slice of a Postgrest filter builder the repository actually calls. */
interface PlantingsQuery extends PromiseLike<DbResult<unknown>> {
  select(columns?: string): PlantingsQuery
  eq(column: string, value: string): PlantingsQuery
  in(column: string, values: string[]): PlantingsQuery
  order(column: string, options?: { ascending: boolean }): PlantingsQuery
  single(): PlantingsQuery
  maybeSingle(): PlantingsQuery
}

/**
 * The narrow shape of a Supabase client the repository needs — mirrors
 * apps/web's `PlantingsDbClient`, but `storage.upload` takes an
 * `ArrayBuffer` rather than a browser `File` — see this app's own
 * `PlantsDbClient` for why.
 */
export interface PlantingsDbClient {
  from(table: 'plantings' | 'planting_photos'): {
    select(columns?: string): PlantingsQuery
    insert(values: Row): PlantingsQuery
    delete(): PlantingsQuery
  }
  storage: {
    from(bucket: string): {
      upload(
        path: string,
        data: ArrayBuffer,
        options?: { contentType?: string },
      ): Promise<{ data: { path: string } | null; error: { message: string } | null }>
      remove(paths: string[]): Promise<{ error: { message: string } | null }>
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
}

/** See this app's `asPlantsDbClient` for why this cast exists. */
export function asPlantingsDbClient(client: SupabaseClient): PlantingsDbClient {
  return client as unknown as PlantingsDbClient
}

const PLANTINGS_TABLE = 'plantings'
const PLANTING_PHOTOS_TABLE = 'planting_photos'
const PLANTING_PHOTOS_BUCKET = 'planting-photos'

function unwrap<T>({ data, error }: DbResult<unknown>): T {
  if (error) throw new Error(error.message)
  return data as T
}

async function requireUserId(client: PlantingsDbClient): Promise<string> {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('Not authenticated.')
  return data.user.id
}

/** A photo picked via `expo-image-picker` — its `uri` is a local file reference, not upload-ready data. */
export interface PlantingPhotoFile {
  uri: string
  name: string
  mimeType: string
}

export class PlantingsRepository {
  private readonly client: PlantingsDbClient

  constructor(client: PlantingsDbClient) {
    this.client = client
  }

  /** Every Planting across the given Beds — the Registry's access pattern, since a Planting has no direct property_id column of its own. */
  async listByBeds(bedIds: string[]): Promise<Planting[]> {
    if (bedIds.length === 0) return []
    const result = unwrap<PlantingRow[]>(
      await this.client
        .from(PLANTINGS_TABLE)
        .select('*')
        .in('bed_id', bedIds)
        .order('created_at', { ascending: true }),
    )
    return result.map(plantingFromRow)
  }

  async get(id: string): Promise<Planting | null> {
    const row = unwrap<PlantingRow | null>(
      await this.client.from(PLANTINGS_TABLE).select('*').eq('id', id).maybeSingle(),
    )
    return row ? plantingFromRow(row) : null
  }

  /** Storage-first, mirroring apps/web's ordering: if cleaning up the Planting's photo files fails, the row is left untouched rather than half-deleted. */
  async remove(id: string): Promise<void> {
    const photos = unwrap<PlantingPhotoRow[]>(
      await this.client.from(PLANTING_PHOTOS_TABLE).select('*').eq('planting_id', id),
    )
    if (photos.length > 0) {
      const { error } = await this.client.storage
        .from(PLANTING_PHOTOS_BUCKET)
        .remove(photos.map((photo) => photo.storage_path))
      if (error) throw new Error(error.message)
    }
    unwrap(await this.client.from(PLANTINGS_TABLE).delete().eq('id', id))
  }

  async listPhotos(plantingId: string): Promise<PlantingPhoto[]> {
    const result = unwrap<PlantingPhotoRow[]>(
      await this.client
        .from(PLANTING_PHOTOS_TABLE)
        .select('*')
        .eq('planting_id', plantingId)
        .order('taken_on', { ascending: false }),
    )
    return result.map(plantingPhotoFromRow)
  }

  /** Reads the picked photo's local `uri` into an `ArrayBuffer` and uploads it, recording it against the Planting in one step. */
  async addPhoto(
    plantingId: string,
    file: PlantingPhotoFile,
    takenOn: string,
  ): Promise<PlantingPhoto> {
    const [userId, arrayBuffer] = await Promise.all([
      requireUserId(this.client),
      fetch(file.uri).then((res) => res.arrayBuffer()),
    ])
    const path = `${userId}/${plantingId}/${Crypto.randomUUID()}-${file.name}`
    const { error: uploadError } = await this.client.storage
      .from(PLANTING_PHOTOS_BUCKET)
      .upload(path, arrayBuffer, { contentType: file.mimeType })
    if (uploadError) throw new Error(uploadError.message)

    const row = unwrap<PlantingPhotoRow>(
      await this.client
        .from(PLANTING_PHOTOS_TABLE)
        .insert(plantingPhotoInputToRow({ plantingId, path, takenOn }))
        .select()
        .single(),
    )
    return plantingPhotoFromRow(row)
  }

  async getPhotoUrl(path: string): Promise<string> {
    const { data, error } = await this.client.storage
      .from(PLANTING_PHOTOS_BUCKET)
      .createSignedUrl(path, 3600)
    if (error || !data) throw new Error(error?.message ?? 'Could not sign photo URL.')
    return data.signedUrl
  }

  async removePhoto(id: string, path: string): Promise<void> {
    const { error } = await this.client.storage.from(PLANTING_PHOTOS_BUCKET).remove([path])
    if (error) throw new Error(error.message)
    unwrap(await this.client.from(PLANTING_PHOTOS_TABLE).delete().eq('id', id))
  }
}
