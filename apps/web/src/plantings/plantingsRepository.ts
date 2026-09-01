import type {
  Planting,
  PlantingInput,
  PlantingPhoto,
  PlantingPhotoRow,
  PlantingRow,
} from '@plant-app/domain'
import {
  plantingFromRow,
  plantingInputToRow,
  plantingPhotoFromRow,
  plantingPhotoInputToRow,
} from '@plant-app/domain'
import type { SupabaseClient } from '@supabase/supabase-js'

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

/** The narrow shape of a Supabase client the repository needs — mirrors PlantsDbClient's pattern. */
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
        file: File,
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

/** See PlantsDbClient's `asPlantsDbClient` for why this cast exists. */
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

export class PlantingsRepository {
  private readonly client: PlantingsDbClient

  constructor(client: PlantingsDbClient) {
    this.client = client
  }

  /** Every Planting across the given Beds — the map view's access pattern, since a Planting has no direct property_id column of its own. */
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

  async create(input: PlantingInput): Promise<Planting> {
    const row = unwrap<PlantingRow>(
      await this.client.from(PLANTINGS_TABLE).insert(plantingInputToRow(input)).select().single(),
    )
    return plantingFromRow(row)
  }

  /** Removes the Planting's photo files from storage before deleting its row — the row's own delete cascades planting_photos (0015_planting_photos.sql), but nothing else would ever clean up the files those rows pointed at, orphaning them in the bucket forever. Storage first, mirroring PlantsRepository.removeReferencePhoto's ordering: if storage cleanup fails, the Planting and its rows are left untouched rather than half-deleted. */
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

  /** Uploads a dated photo and records it against the Planting in one step — unlike Plant's reference photos, a photo log entry's row is its own record, not a path appended onto the parent. */
  async addPhoto(plantingId: string, file: File, takenOn: string): Promise<PlantingPhoto> {
    const userId = await requireUserId(this.client)
    const path = `${userId}/${plantingId}/${crypto.randomUUID()}-${file.name}`
    const { error: uploadError } = await this.client.storage
      .from(PLANTING_PHOTOS_BUCKET)
      .upload(path, file)
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
