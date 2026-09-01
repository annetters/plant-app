import type {
  CareTaskTemplate,
  CareTaskTemplateRow,
  Plant,
  PlantInput,
  PlantRow,
} from '@plant-app/domain'
import { careTaskTemplateFromRow, plantFromRow, plantInputToRow } from '@plant-app/domain'
import type { SupabaseClient } from '@supabase/supabase-js'
import * as Crypto from 'expo-crypto'

type Row = Record<string, unknown>
type DbResult<T> = { data: T; error: { message: string } | null }

/** The slice of a Postgrest filter builder the repository actually calls. */
interface PlantsQuery extends PromiseLike<DbResult<unknown>> {
  select(columns?: string): PlantsQuery
  eq(column: string, value: string): PlantsQuery
  order(column: string, options?: { ascending: boolean }): PlantsQuery
  single(): PlantsQuery
  maybeSingle(): PlantsQuery
}

/**
 * The narrow shape of a Supabase client the repository needs — mirrors
 * apps/web's `PlantsDbClient`, but `storage.upload` takes an `ArrayBuffer`
 * rather than a browser `File`: React Native has no `File`/`Blob`-backed
 * file object for a picked photo, only a local `uri` — see `uploadReferencePhoto`,
 * which reads that `uri` into an `ArrayBuffer` itself, the same pattern
 * `TagScanRepository.uploadTagPhoto` already uses.
 */
export interface PlantsDbClient {
  from(table: 'plants' | 'care_task_templates'): {
    select(columns?: string): PlantsQuery
    insert(values: Row): PlantsQuery
    update(values: Row): PlantsQuery
    delete(): PlantsQuery
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

/** See apps/web's `asPlantsDbClient` for why this cast exists — the real client satisfies this interface at runtime, but its generic Postgrest builder types blow TypeScript's structural-check recursion budget. */
export function asPlantsDbClient(client: SupabaseClient): PlantsDbClient {
  return client as unknown as PlantsDbClient
}

const TABLE = 'plants'
const CARE_TASK_TEMPLATES_TABLE = 'care_task_templates'
const REFERENCE_PHOTOS_BUCKET = 'plant-reference-photos'

function unwrap<T>({ data, error }: DbResult<unknown>): T {
  if (error) throw new Error(error.message)
  return data as T
}

async function requireUserId(client: PlantsDbClient): Promise<string> {
  const { data, error } = await client.auth.getUser()
  if (error || !data.user) throw new Error('Not authenticated.')
  return data.user.id
}

/** A photo picked via `expo-image-picker` — its `uri` is a local file reference, not upload-ready data. */
export interface PlantPhotoFile {
  uri: string
  name: string
  mimeType: string
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

  async get(id: string): Promise<Plant | null> {
    const row = unwrap<PlantRow | null>(
      await this.client.from(TABLE).select('*').eq('id', id).maybeSingle(),
    )
    return row ? plantFromRow(row) : null
  }

  async update(id: string, input: PlantInput): Promise<Plant> {
    const row = unwrap<PlantRow>(
      await this.client.from(TABLE).update(plantInputToRow(input)).eq('id', id).select().single(),
    )
    return plantFromRow(row)
  }

  async remove(id: string): Promise<void> {
    unwrap(await this.client.from(TABLE).delete().eq('id', id))
  }

  /** Reads the picked photo's local `uri` into an `ArrayBuffer` and uploads it, returning its storage path — caller persists the path onto the Plant. */
  async uploadReferencePhoto(plantId: string, file: PlantPhotoFile): Promise<string> {
    const [userId, arrayBuffer] = await Promise.all([
      requireUserId(this.client),
      fetch(file.uri).then((res) => res.arrayBuffer()),
    ])
    const path = `${userId}/${plantId}/${Crypto.randomUUID()}-${file.name}`
    const { error } = await this.client.storage
      .from(REFERENCE_PHOTOS_BUCKET)
      .upload(path, arrayBuffer, { contentType: file.mimeType })
    if (error) throw new Error(error.message)
    return path
  }

  async getReferencePhotoUrl(path: string): Promise<string> {
    const { data, error } = await this.client.storage
      .from(REFERENCE_PHOTOS_BUCKET)
      .createSignedUrl(path, 3600)
    if (error || !data) throw new Error(error?.message ?? 'Could not sign photo URL.')
    return data.signedUrl
  }

  async removeReferencePhoto(path: string): Promise<void> {
    const { error } = await this.client.storage.from(REFERENCE_PHOTOS_BUCKET).remove([path])
    if (error) throw new Error(error.message)
  }

  async listCareTaskTemplates(plantId: string): Promise<CareTaskTemplate[]> {
    const result = unwrap<CareTaskTemplateRow[]>(
      await this.client
        .from(CARE_TASK_TEMPLATES_TABLE)
        .select('*')
        .eq('plant_id', plantId)
        .order('created_at', { ascending: true }),
    )
    return result.map(careTaskTemplateFromRow)
  }
}
